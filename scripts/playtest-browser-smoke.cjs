"use strict";

// Real Chromium smoke: viewport, map discovery, landmark siege and save/reload.
// No model/API key or GPS access is needed; this uses the game's own demo flow.
const assert = require("node:assert/strict");
const { spawn } = require("node:child_process");
const fs = require("node:fs/promises");
const path = require("node:path");

function listenForPort(server) {
  return new Promise((resolve, reject) => {
    let output = "";
    const timer = setTimeout(() => reject(new Error("local game server did not start")), 10000);
    server.stdout.setEncoding("utf8");
    server.stderr.pipe(process.stderr);
    server.stdout.on("data", chunk => {
      output += chunk;
      const match = output.match(/http:\/\/localhost:(\d+)/);
      if (match) { clearTimeout(timer); resolve(Number(match[1])); }
    });
    server.once("error", err => { clearTimeout(timer); reject(err); });
    server.once("exit", code => { clearTimeout(timer); reject(new Error("game server exited: " + code)); });
  });
}

async function walkForestToWolf(page) {
  // Walk the REAL on-screen trail to the optional wolf encounter.
  for(const pos of [21,22,23,18,13,8]){
    const next=page.locator('.forest-field [data-action="field-step"][data-value="'+pos+'"]');
    await next.click();
  }
}

// Use the actual classic expedition entry on both the older map and the
// action-forest-first map. Opening detail is only needed on the latter.
async function departClassicForest(page) {
  const legacy=page.locator('.action-forest-preview [data-action="depart"][data-value="wood"]');
  const mapDepart=page.locator('.nearby-card-actions [data-action="depart"][data-value="wood"]');
  if (await mapDepart.count()) {
    await mapDepart.click();
    return;
  }
  if (!await legacy.count()) {
    await page.locator('.nearby-card-actions [data-action="nearby-view"][data-value="detail"]').click();
  }
  await legacy.click();
}

async function main() {
  let chromium;
  try {
    ({ chromium } = require("playwright"));
  } catch {
    throw new Error("Install the test-only browser dependency: npm install --no-save --package-lock=false playwright@1.56.1 && npx playwright install chromium");
  }
  const output = path.resolve(__dirname, "../.qa/browser");
  await fs.mkdir(output, { recursive: true });
  const server = spawn(process.execPath, ["scripts/serve-slice.cjs"], {
    cwd: path.resolve(__dirname, ".."), env: { ...process.env, PORT: "0" },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let browser;
  try {
    const port = await listenForPort(server);
    browser = await chromium.launch({ headless: true });
    const url = "http://127.0.0.1:" + port + "/expedition.html";

    for (const width of [390, 360]) {
      const height = width === 390 ? 844 : 800;
      const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1, isMobile: true, hasTouch: true });
      const page = await context.newPage();
      const errors = [];
      page.on("pageerror", error => errors.push(error.message));
      try {
        await page.goto(url);
        await page.locator('[data-action="mode"][data-value="demo"]').click();
        assert.equal(await page.locator(".nearby-paper-map").count(), 1, "demo should show the map");
        assert.equal(await page.locator('.nearby-track-tile').count(),25,'the neighborhood is a 5x5 connected tile board');
        assert.equal(await page.locator('.nearby-track-tile.selected').count(),1,'the current destination is centered and selected');
        assert((await page.locator('.nearby-world-canvas .world-road-surface path').count())>=2,'known lands are linked by rendered roads on the shared world canvas');
        const layout = await page.evaluate(() => {
          const rect = selector => {
            const r = document.querySelector(selector).getBoundingClientRect();
            return {top:r.top,bottom:r.bottom,height:r.height,left:r.left,right:r.right};
          };
          const selectors=['.nearby-track-tile.selected','.nearby-top-action','.nearby-card-actions button.primary','.nearby-card-actions button.secondary'];
          const blocked=selectors.filter(selector=>{
            const e=document.querySelector(selector);
            if (!e || e.disabled) return false;
            const r=e.getBoundingClientRect(),top=document.elementFromPoint(r.left+r.width/2,r.top+r.height/2);
            return !(top===e || e.contains(top));
          });
          return {map:rect('.nearby-scene'),card:rect('.nearby-card'),dock:rect('.bottom-navigation'),
            blocked,viewport:innerHeight,mapOverflow:document.querySelector('.nearby-paper-map').scrollHeight-document.querySelector('.nearby-paper-map').clientHeight};
        });
        assert(Math.abs(layout.map.bottom-layout.card.top)<=2,'map and card must occupy distinct, adjacent rows: '+JSON.stringify(layout));
        assert(Math.abs(layout.card.bottom-layout.dock.top)<=2,'card and thumb dock must occupy distinct, adjacent rows: '+JSON.stringify(layout));
        assert(layout.map.height >= height*.4,'map must remain the visual focus, not a tiny strip: '+JSON.stringify(layout));
        assert(height-layout.dock.bottom<=24 && layout.dock.bottom<=height+2,'dock must sit at the thumb bottom without old reserved gap: '+JSON.stringify(layout));
        assert.deepEqual(layout.blocked,[],'all primary map/card controls must receive their real tap centers: '+JSON.stringify(layout));
        assert(layout.mapOverflow<=2,'map never scrolls below the card');
        assert.equal(await page.locator(".bottom-navigation").isVisible(), true, "bottom navigation should be visible");
        const nav = await page.locator(".bottom-navigation").boundingBox();
        assert(nav && nav.y >= -1 && nav.y + nav.height <= height + 2, "bottom navigation must fit the viewport");
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true, "no document-wide horizontal overflow");
        await page.screenshot({ path: path.join(output, "map-" + width + ".png") });

        // The character screen is a real phone scene, not an inert document.
        assert.equal(await page.locator('[data-action="settings"].nearby-map-settings').isVisible(),true,
          'map must retain access to settings after adding character navigation');
        const statusBefore=await page.evaluate(()=>localStorage.getItem('crownless-expedition-v1-demo'));
        await page.locator('.bottom-navigation [data-action="tab"][data-value="status"]').click();
        assert.equal(await page.locator('.character-status-layout').count(),1,'character sheet opens via thumb dock');
        assert.match(await page.locator('.character-status-panel').innerText(),/獣道読み/);
        assert.match(await page.locator('.character-status-panel').innerText(),/未習得/);
        const statusFit=await page.evaluate(()=>{
          const panel=document.querySelector('.status-panel-content').getBoundingClientRect();
          const dock=document.querySelector('.bottom-navigation').getBoundingClientRect();
          const roles=[...document.querySelectorAll('.status-role')].map(el=>el.getBoundingClientRect());
          return {panelBottom:panel.bottom,dockTop:dock.top,roleWidths:roles.map(b=>b.width),
            pageOverflow:document.documentElement.scrollWidth-innerWidth};
        });
        assert(statusFit.panelBottom <= statusFit.dockTop+4,
          'status details may scroll internally but cannot hide behind the dock: '+JSON.stringify(statusFit));
        assert(statusFit.roleWidths.every(w=>w>=60),'character view choices must be tappable: '+JSON.stringify(statusFit));
        assert(statusFit.pageOverflow<=1,'status screen must not cause horizontal overflow');
        await page.screenshot({path:path.join(output,'character-status-'+width+'.png')});
        await page.locator('.status-role[data-value="1"]').click();
        assert.match(await page.locator('.character-status-panel').innerText(),/鍛冶の仕事/);
        assert.equal(await page.evaluate(()=>localStorage.getItem('crownless-expedition-v1-demo')),statusBefore,
          'reading other characters never changes the active role or save');
        await page.locator('.bottom-navigation [data-action="tab"][data-value="explore"]').click();
        assert.equal(await page.locator('.nearby-paper-map').count(),1,'status viewing returns to playable map');

        
        // Real touch interaction, not DOM-dispatched click: every primary camp
        // destination and every Chronicle subtab must remain operable on 360/390px.
        await page.locator('.bottom-navigation [data-action="tab"][data-value="gear"]').click();
        assert.equal(await page.locator('.gear-home').count(), 1, "equipment tab must open");
        await page.locator('[data-action="character"][data-value="1"]').click();
        assert.match(await page.locator('.gear-home').innerText(), /操作中/);
        await page.locator('[data-action="character"][data-value="0"]').click();
        await page.locator('.bottom-navigation [data-action="tab"][data-value="home"]').click();
        assert.equal(await page.locator('.homestead-home').count(), 1, "homestead tab must open");
        await page.locator('.bottom-navigation [data-action="tab"][data-value="codex"]').click();
        assert.equal(await page.locator('.codex-panel').count(), 1, "journal tab must open");
        await page.locator('.bottom-navigation [data-action="tab"][data-value="chronicle"]').click();
        assert.equal(await page.locator('.chronicle-subtabs .subtab-btn').count(), 5, "all five travel subtabs must be present");
        for (const subtab of ["stamps", "relics", "outposts", "travelog", "footprints"]) {
          const button = page.locator('.chronicle-subtabs .subtab-btn[data-subtab="' + subtab + '"]');
          await button.click();
          assert.equal(await button.evaluate(el => el.classList.contains("active")), true,
            "travel subtab " + subtab + " must respond to a real tap");
        }
        const travelTabs = await page.locator('.chronicle-subtabs .subtab-btn').evaluateAll(nodes =>
          nodes.map(el => { const box = el.getBoundingClientRect(); return { top: box.top, height: box.height, left: box.left, right: box.right }; }));
        assert(travelTabs.every(x => x.height >= 44), "travel subtabs need 44px touch height");
        assert(travelTabs.every(x => Math.abs(x.top - travelTabs[0].top) < 2),
          "all five travel subtabs must remain on one row at phone widths");
        assert(travelTabs.every(x => x.left >= 0 && x.right <= width + 1),
          "travel subtab controls must fit the device width");
        await page.screenshot({ path: path.join(output, "travel-controls-" + width + ".png") });
        await page.locator('.bottom-navigation [data-action="tab"][data-value="explore"]').click();
        assert.equal(await page.locator(".nearby-paper-map").count(), 1, "travel tabs must return to map");


        // Real pointer/touch regression: a normal expedition must lead into
        // combat and a resolved first fight, not merely set a path save.
        await departClassicForest(page);
        assert.equal(await page.locator(".expedition-layout.path-stage").count(), 0);
        assert.equal(await page.locator(".expedition-layout:not(.battle-layout)").count(), 1);
        const world = page.locator('.forest-field');
        assert.equal(await world.count(),1,'forest has an actual playable local field');
        assert.equal(await page.locator('.forest-field.world-painted canvas.forest-world-canvas').count(),1,
          'the active world is actually painted using a continuous canvas, not colored tile controls');
        const canvasProof=await page.evaluate(()=>{
          const canvas=document.querySelector('.forest-field.world-painted canvas.forest-world-canvas');
          const ctx=canvas?.getContext('2d');
          if(!ctx)return {supported:false};
          const img=ctx.getImageData(0,0,canvas.width,canvas.height);
          const samples=[[60,540],[180,540],[300,540],[60,60],[300,300]].map(([x,y])=>{
            const i=(y*canvas.width+x)*4;
            return [...img.data.slice(i,i+3)].join(',');
          });
          const tiles=[...document.querySelectorAll('.forest-field button.can-step')];
          return {supported:true,width:canvas.width,height:canvas.height,
            samples,distinct:new Set(samples).size,stepFacesHidden:tiles.every(el=>
              getComputedStyle(el).borderTopWidth==='0px' &&
              getComputedStyle(el).fontSize==='0px' && el.offsetWidth>=44),
            transparentHitAreas:tiles.every(el=>{
              const css=getComputedStyle(el);
              return css.backgroundImage==='none' &&
                (css.backgroundColor==='rgba(0, 0, 0, 0)' || css.backgroundColor==='transparent') &&
                css.animationName==='none';
            }),
            guidedCells:tiles.filter(el=>el.classList.contains('walk-nav')).map(el=>Number(el.dataset.value)),
            nonAdjacentNav:tiles.filter(el=>el.classList.contains('walk-nav')).filter(el=>{
              const here=document.querySelector('.forest-field .field-cell.here');
              return Math.abs(Number(el.style.gridColumn)-Number(here.style.gridColumn))+
                Math.abs(Number(el.style.gridRow)-Number(here.style.gridRow))!==1;
            }).map(el=>Number(el.dataset.value)),
            visibleWaypoint:tiles.filter(el=>el.classList.contains('walk-nav')).every(el=>{
              const hint=getComputedStyle(el,'::after');
              return hint.content!=='none' && parseFloat(hint.width)>=10 && hint.borderTopStyle==='dashed';
            }),
            unexpectedNav:[...document.querySelectorAll('.forest-field .field-cell.walk-nav')]
              .filter(el=>el.classList.contains('wall')||el.classList.contains('secret')||el.classList.contains('veiled'))
              .map(el=>el.className) };
        });
        assert(canvasProof.supported&&canvasProof.width>=512&&canvasProof.distinct>=3
          &&canvasProof.stepFacesHidden,
          'the new forest has actual non-flat pixel art and invisible grid faces: '+JSON.stringify(canvasProof));
        assert(canvasProof.transparentHitAreas,
          'walkable tap cells must remain full-sized transparent inputs: '+JSON.stringify(canvasProof));
        assert.deepEqual(canvasProof.guidedCells.slice().sort((a,b)=>a-b),[15,21],
          'only the two ordinary walkable neighbors of the camp get visible waypoints');
        assert.deepEqual(canvasProof.nonAdjacentNav,[],
          'every visible forest waypoint must be exactly one map cell from the traveler');
        assert(canvasProof.visibleWaypoint && canvasProof.unexpectedNav.length===0,
          'CSS waypoints visible on standard paths only; neither walls, secrets nor fog get marked: '+JSON.stringify(canvasProof));
        assert(!/宝箱.*未発見|森の秘密/.test(await page.locator('.forest-field-footer').innerText()),
          'unfound treasure or hidden discoveries must not be advertised in the footer');
        assert.equal(await page.locator('.forest-field .field-cell').count(),49,'larger woodland renders forty-nine real cells');
        assert.equal(await page.locator('.forest-field .field-cell.wall').count(),19,
          'impenetrable tree masses are part of the field, not decorative background');
        assert((await page.locator('.forest-field .field-cell.veiled').count())>14,
          'most of the land must actually be hidden at the beginning');
        const fogObscuresWall=await page.evaluate(()=>{
          const blocked=document.querySelector('.forest-field .field-cell.veiled.wall');
          const blank=document.querySelector('.forest-field .field-cell.veiled.trail');
          return blocked&&blank&&getComputedStyle(blocked).backgroundImage===getComputedStyle(blank).backgroundImage;
        });
        assert.equal(fogObscuresWall,true,'undiscovered obstacles must not be revealed through fog');
        assert.equal(await world.getAttribute('data-field-pos'),'20');
        const startingPosition='20';
        const journeyFrame=await page.evaluate(()=>{
          const world=document.querySelector('.forest-field').getBoundingClientRect();
          const card=document.querySelector('.field-panel').getBoundingClientRect();
          const selectors=['.forest-field button.can-step','.field-choices button:not(:disabled)'];
          const actions=selectors.flatMap(selector=>[...document.querySelectorAll(selector)].map(el=>{
            const r=el.getBoundingClientRect(),hit=document.elementFromPoint(r.left+r.width/2,r.top+r.height/2);
            return {selector,top:r.top,bottom:r.bottom,hit:hit===el||el.contains(hit),height:r.height};
          }));
          return {worldHeight:world.height,worldBottom:world.bottom,cardTop:card.top,actions,viewport:innerHeight};
        });
        assert(journeyFrame.worldHeight>=height*.49,'the traversable field should dominate the viewport: '+JSON.stringify(journeyFrame));
        assert(journeyFrame.worldBottom<=journeyFrame.cardTop+2,'field and thumb controls must not overlap: '+JSON.stringify(journeyFrame));
        assert(journeyFrame.actions.length>=3 && journeyFrame.actions.every(x=>x.hit&&x.top>=0&&x.bottom<=height+2&&x.height>=44),
          'all field moves and return actions are real accessible tap targets: '+JSON.stringify(journeyFrame));
        await page.screenshot({path:path.join(output,'forest-fog-start-'+width+'.png')});
        await page.locator('.forest-field [data-action="field-step"][data-value="21"]').click();
        assert.equal(await world.getAttribute('data-field-pos'),'21','walking visibly moves the hero one tile');
        const knownAfterStep=await page.locator('.forest-field .field-cell.revealed').count();
        assert(knownAfterStep>3,'moving reveals genuinely new local ground');
        await page.screenshot({path:path.join(output,'forest-fog-revealed-'+width+'.png')});
        for(const pos of [22,23,18,13]){
          await page.locator('.forest-field [data-action="field-step"][data-value="'+pos+'"]').click();
        }
        const wolfGate=page.locator('.forest-field [data-action="field-step"][data-value="8"]');
        assert.equal(await wolfGate.count(),1,'wolf encounter remains an adjacent tappable choice');
        assert.equal(await wolfGate.evaluate(el=>el.classList.contains('walk-nav')),false,
          'a live wolf den must never look like an ordinary safe walking waypoint');
        // A wolf sighting adds warning copy: keep both thumb actions visible.
        const wolfChoiceBounds = await page.evaluate(() => [...document.querySelectorAll(
          '#game > .field-layout .field-choices button'
        )].map(el => {
          const r = el.getBoundingClientRect();
          const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
          return { label: el.textContent.trim().slice(0, 35), top: r.top,
            bottom: r.bottom, height: r.height,
            reachable: r.top >= 0 && r.bottom <= innerHeight - 2 && r.height >= 44 &&
              (el.disabled || hit === el || el.contains(hit)) };
        }));
        assert(wolfChoiceBounds.length >= 2 && wolfChoiceBounds.every(x => x.reachable),
          'wolf sighting must leave both thumb actions entirely on-screen: ' + JSON.stringify(wolfChoiceBounds));
        await page.screenshot({path:path.join(output,'forest-wolf-risk-no-waypoint-'+width+'.png')});
        await wolfGate.click();
        assert.equal(await page.locator(".battle-layout .combat-enemy-summary").count(), 1, "the wolf den must render exactly one actual battle");
        const battleLayout=await page.evaluate(()=>{
          const names=['.combat-situation','.combat-decision','.combat-support'];
          const items=names.map(selector=>{
            const el=document.querySelector(selector), r=el.getBoundingClientRect();
            return {selector,top:r.top,bottom:r.bottom,height:r.height};
          });
          const buttons=['strike','heavy','guard','dodge','auto-fight'].map(action=>{
            const el=document.querySelector('[data-action="'+action+'"]');
            const r=el.getBoundingClientRect(),cx=r.left+r.width/2,cy=r.top+r.height/2,at=document.elementFromPoint(cx,cy);
            return {action,visible:r.width>0&&r.height>=43&&r.top>=0&&r.bottom<=innerHeight+2,tappable:el.disabled || at===el || el.contains(at)};
          });
          return {items,buttons,viewport:innerHeight};
        });
        assert(battleLayout.items.every((item,i)=>item.height>=44 && (i===0||item.top>=battleLayout.items[i-1].bottom-2)),
          'battle readout, choice card and optional support are separate, nonoverlapping rows: '+JSON.stringify(battleLayout));
        assert(battleLayout.buttons.every(btn=>btn.visible&&btn.tappable),
          'the four tactics and one-click auto must be real thumb-reachable controls: '+JSON.stringify(battleLayout));
        await page.screenshot({ path: path.join(output, "combat-tactics-" + width + ".png") });
        const supportTappable=await page.locator('.combat-support > summary').evaluate(el=>{
          const r=el.getBoundingClientRect(),point=document.elementFromPoint(r.left+r.width/2,r.top+r.height/2);
          return r.top>=0 && r.bottom<=innerHeight+2 && (point===el || el.contains(point));
        });
        assert(supportTappable,'optional supply/log summary must receive a real tap');
        await page.locator('.combat-support > summary').click();
        assert.equal(await page.locator('.combat-support').getAttribute('open'),'','supplies are readable on demand');
        assert.equal(await page.locator('.combat-decision').isVisible(),false,'reading support never competes with the tactical buttons');
        assert.equal(await page.locator('[data-action="flee"]').isVisible(),true,'retreat is visible in the reading scene');
        const supportReader=await page.locator('.combat-support').boundingBox();
        assert(supportReader&&supportReader.y<height*.55&&supportReader.height>150,'support detail becomes its own readable viewport instead of blank space');
        await page.screenshot({ path: path.join(output, "combat-support-" + width + ".png") });
        await page.locator('.combat-support > summary').click();
        await page.screenshot({ path: path.join(output, "combat-start-" + width + ".png") });
        if(width===390){
          const beforeTurn=await page.evaluate(()=>JSON.parse(localStorage.getItem('crownless-expedition-v1-demo')).expedition.enemy.turn);
          await page.locator('.combat-choice-grid [data-action="strike"]').click();
          const afterTurn=await page.evaluate(()=>JSON.parse(localStorage.getItem('crownless-expedition-v1-demo')).expedition.enemy.turn);
          assert(afterTurn>beforeTurn,'manual strike must execute a real combat turn');
          await page.screenshot({path:path.join(output,'combat-after-manual-strike-390.png')});
        }
        await page.locator('[data-action="auto-fight"]').click();
        assert.equal(await page.locator('.forest-field[data-field-wolf="true"]').count(),1,
          'after the only wolf battle, hero returns to the SAME forest, with wolf gone');
        assert.match(await page.locator('.field-moment').innerText(),/狼は倒れた/,
          'forest exploration success must be explained before the auto-combat statistics');
        const afterFirstBattle = await page.evaluate(() => JSON.parse(localStorage.getItem("crownless-expedition-v1-demo")));
        assert.equal(afterFirstBattle.expedition?.room,0,'wolf victory does not start a five-fight corridor');
        assert.equal(afterFirstBattle.expedition?.field.pos,8,'hero resumes exactly where the fight happened');
        assert.equal(afterFirstBattle.expedition?.field.wolf,true,'wolf stays permanently defeated for this expedition');
        assert(afterFirstBattle.expedition?.materials.wolfFang>=1,'first wolf loot is actually carried');
        await page.screenshot({path:path.join(output,'forest-after-wolf-'+width+'.png')});
        await page.reload();
        assert.equal(await page.locator('.forest-field[data-field-wolf="true"]').count(),1,
          'defeated wolf state survives saved reload');
        // Re-entering the now-empty den must NEVER launch a second wolf fight.
        await page.locator('.forest-field [data-action="field-step"][data-value="13"]').click();
        assert.equal(await page.locator('.forest-field .field-cell.den.walk-nav').count(),1,
          'the defeated wolf den becomes ordinary safe navigation again');
        await page.locator('.forest-field [data-action="field-step"][data-value="8"]').click();
        assert.equal(await page.locator('.battle-layout').count(),0,'wolf can be fought only once');
        for(const id of [13,18,17]){
          await page.locator('.forest-field [data-action="field-step"][data-value="'+id+'"]').click();
        }
        const chest=await page.evaluate(()=>JSON.parse(localStorage.getItem('crownless-expedition-v1-demo')));
        assert.equal(chest.expedition.field.treasure,true,'hidden real treasure can be discovered after the wolf fight');
        assert(chest.expedition.scrap>=8,'chest contents and wolf rewards stay in the pack');
        assert(chest.expedition.materials.wolfFang>=2,'chest and wolf yield smith-craftable materials');
        await page.screenshot({path:path.join(output,'forest-treasure-found-'+width+'.png')});
        await page.reload();
        assert.equal(await page.locator('.forest-field[data-field-treasure="true"][data-field-wolf="true"]').count(),1,
          'both chest and defeated wolf persist on re-entry');
        assert.equal(await page.locator('.forest-field button[data-action="field-step"][data-value="12"]').count(),0,
          'unknown secret entrance must not reveal an exact map tile at '+width+'px');
        const inspectVines=page.locator('.field-choices [data-action="field-step"][data-value="12"]');
        assert.equal(await inspectVines.count(),1,'chest rustle offers a deliberate investigation');
        const inspectBounds=await inspectVines.boundingBox();
        assert(inspectBounds&&inspectBounds.y>=0&&inspectBounds.y+inspectBounds.height<=height+2,
          'investigation remains touch-reachable on '+width+'px');
        await inspectVines.click();
        const openedVines=await page.evaluate(()=>JSON.parse(localStorage.getItem('crownless-expedition-v1-demo')));
        assert.equal(openedVines.expedition.field.secret,true,'investigation opens the secret');
        assert.equal(openedVines.expedition.field.pos,17,'investigation does not teleport');
        assert.equal(await page.locator('.forest-field button[data-action="field-step"][data-value="12"]').count(),1,
          'the discovered entrance is now a walkable cell');
        assert.equal(await page.locator('.forest-field .field-cell.secret.walk-nav').count(),0,
          'even discovered secrets are not ordinary walking guidance');
        await page.locator('.forest-field button[data-action="field-step"][data-value="12"]').click();
        await page.reload();
        const enteredVines=await page.evaluate(()=>JSON.parse(localStorage.getItem('crownless-expedition-v1-demo')));
        assert.equal(enteredVines.expedition.field.pos,12,'discovered passage survives reload');
        assert.equal(enteredVines.expedition.field.secret,true,'opened route survives reload');
        await page.locator('.forest-field [data-action="field-step"][data-value="17"]').click();
        // The exit portal finishes the single scene with safe loot banking.
        for(const id of [18,13,8,9,4]){
          await page.locator('.forest-field [data-action="field-step"][data-value="'+id+'"]').click();
        }
        assert.equal(await page.locator('.report-layout').count(),1,'gate returns from forest without a second combat');
        const banked=await page.evaluate(()=>JSON.parse(localStorage.getItem('crownless-expedition-v1-demo')));
        assert(banked.materials.wolfFang>=2,'both wolf and treasure materials were banked');
        await page.screenshot({path:path.join(output,'return-from-combat-'+width+'.png')});
        await page.locator('[data-action="continue"]').click();
        // The normal return may prioritize the gear/home tab. Restore the map
        // before running the older discovery and landmark smoke scenarios.
        await page.locator('.bottom-navigation [data-action="tab"][data-value="explore"]').click();
        assert.equal(await page.locator(".nearby-paper-map").count(), 1);
        await page.screenshot({ path: path.join(output, "return-from-combat-" + width + ".png") });


        if (width === 390) {
          // The map must reveal distinct shop/event sprites by player discovery,
          // not by artificially stamping a record into localStorage.
          assert.equal(await page.locator('.nearby-track-tile[data-poi-family="event"] .district-pixel-art').count(), 1);
          await page.locator('[data-action="nearby-view"][data-value="scout"]').click();
          await page.locator('[data-action="scout"][data-value="tower"]').click();
          await page.locator('[data-action="nearby-view"][data-value="scout"]').click();
          await page.locator('[data-action="scout"][data-value="tower"]').click();
          assert(await page.locator('.nearby-track-tile[data-poi-family="shop"] .district-pixel-art').count() >= 1);
          assert(await page.locator('.nearby-track-tile[data-poi-family="event"] .district-pixel-art').count() >= 1);
          // A numbered discovery pager must not wrap into a vertical fraction
          // or hide its buttons at 390px. Check the actual computed geometry.
          const pager=await page.locator('.nearby-track-switch').evaluate(el=>{
            const counter=el.querySelector('.nearby-track-position');
            const bounds=counter.getBoundingClientRect();
            const buttons=[...el.querySelectorAll('button')].map(btn=>{
              const r=btn.getBoundingClientRect();
              return {width:r.width,height:r.height};
            });
            return {text:counter.textContent,whiteSpace:getComputedStyle(counter).whiteSpace,
              counterHeight:bounds.height,counterWidth:bounds.width,
              pagerWidth:el.getBoundingClientRect().width,buttons};
          });
          assert.match(pager.text,/\d+ \/ \d+/);
          assert(pager.whiteSpace==='nowrap'&&pager.counterHeight<=22&&pager.counterWidth>=38,
            'discovery count must stay horizontal: '+JSON.stringify(pager));
          assert(pager.buttons.length===2&&pager.buttons.every(btn=>btn.height>=42&&btn.width>=84),
            'previous and next destinations need full tap targets: '+JSON.stringify(pager));
          const selectedBefore=await page.locator('.nearby-track-tile.selected').getAttribute('data-value');
          await page.locator('.nearby-track-switch button').first().click();
          assert.notEqual(await page.locator('.nearby-track-tile.selected').getAttribute('data-value'),selectedBefore,
            'previous discovered land should react to a real touch');
          await page.locator('.nearby-track-switch button').last().click();
          assert.equal(await page.locator('.nearby-track-tile.selected').getAttribute('data-value'),selectedBefore,
            'next discovered land should return to the original site');
          await page.screenshot({ path: path.join(output, "hybrid-discovery-390.png") });
          await page.locator('.nearby-track-tile[data-poi-family="shop"]').last().click();
          assert.match(await page.locator(".district-detail").innerText(), /見張り跡/);
          await page.locator('[data-action="nearby-view"][data-value="detail"]').click();
      assert.match(await page.locator(".district-poi-card").innerText(), /鐘守の鍛冶台/);
      await page.locator('[data-action="nearby-view"][data-value="map"]').click();
          await page.locator('[data-action="nearby-view"][data-value="scout"]').click();
          await page.locator('[data-action="travel-demo"][data-value="skytree"]').click();
          assert.match(await page.locator(".chronicle-panel").innerText(), /天穿つ白塔/, "new fantasy landmark should appear");
          await page.screenshot({ path: path.join(output, "landmark-390.png") });
          await page.reload();
          await page.locator('.bottom-navigation [data-action="tab"][data-value="chronicle"]').click();
          const siege = page.locator('[data-action="landmark-siege"][data-value="tokyo-skytree"]');
          assert.equal(await siege.isEnabled(), true, "discovered landmark should allow a siege");
          await siege.click();
          const siegeId = await page.evaluate(() => JSON.parse(localStorage.getItem("crownless-expedition-v1-demo")).expedition?.landmarkId);
          assert.equal(siegeId, "tokyo-skytree", "siege must be saved with the specific landmark ID");
          await page.reload();
          assert.match(await page.locator("#game").innerText(), /天穿つ白塔/, "saved siege must survive a reload");
        }
        assert.deepEqual(errors, [], "no browser script errors");
      } catch (error) {
        await page.screenshot({ path: path.join(output, "failure-" + width + ".png") }).catch(() => {});
        throw error;
      } finally {
        await context.close();
      }
    }

    // ADR 0013 / Argon: genuine combat-free exploration -> safe return ->
    // smith-made tool -> a deliberate new clue on a second expedition.
    // Fresh context keeps all prior combat/browser scenarios unchanged.
    {
      const context=await browser.newContext({viewport:{width:390,height:844},deviceScaleFactor:1,isMobile:true,hasTouch:true});
      const page=await context.newPage();
      try{
        await page.goto(url);
        await page.locator('[data-action="mode"][data-value="demo"]').click();
        await departClassicForest(page);
        for(const pos of [21,22,23,18,17])
          await page.locator('.forest-field [data-action="field-step"][data-value="'+pos+'"]').click();
        assert.equal(await page.locator('.forest-field').getAttribute('data-field-wolf'),'false',
          'first tool is obtained without combat');
        await page.locator('.field-choices [data-action="return"]').click();
        assert.match(await page.locator('.report-panel').innerText(),/狼牙/);
        assert.match(await page.locator('.report-panel').innerText(),/斥候の灯/);
        await page.locator('[data-action="continue"]').click();
        await page.locator('.bottom-navigation [data-action="tab"][data-value="gear"]').click();
        assert.match(await page.locator('.argon-tool-spec').innerText(),/狼牙 1 \/ 1/);
        await page.locator('[data-action="character"][data-value="1"]').click();
        const craft=page.locator('.argon-tool-spec [data-action="craft-tool"]');
        assert.equal(await craft.isEnabled(),true,'saved gathered ingredients enable the smith action');
        await page.screenshot({path:path.join(output,'scout-lantern-craft-before-390.png')});
        await craft.click();
        assert.match(await page.locator('.argon-tool-spec').innerText(),/製作済み/);
        await page.reload();
        await page.locator('.bottom-navigation [data-action="tab"][data-value="gear"]').click();
        assert.match(await page.locator('.argon-tool-spec').innerText(),/製作済み/,
          'crafted tool survives save/reload');
        await page.locator('[data-action="character"][data-value="0"]').click();
        await page.locator('.bottom-navigation [data-action="tab"][data-value="explore"]').click();
        await departClassicForest(page);
        for(const pos of [21,22,23,18])
          await page.locator('.forest-field [data-action="field-step"][data-value="'+pos+'"]').click();
        assert.equal(await page.locator('.forest-field').getAttribute('data-field-secret'),'false');
        await page.locator('.field-choices [data-action="lantern-examine"]').click();
        assert.match(await page.locator('.scout-lantern-clue').innerText(),/倒木/);
        assert.match(await page.locator('.field-choices [data-action="return"]').innerText(),/鉄片を持って生還/,
          'lantern discovery must make its provisional scrap clear before leaving');
        assert.equal(await page.locator('.forest-field').getAttribute('data-field-secret'),'false',
          'lamp cannot automatically unseal secret route');
        await page.screenshot({path:path.join(output,'scout-lantern-second-trip-390.png')});
      }finally{await context.close();}
    }

    // ADR 0015: the forest risk fork must remain touch-reachable on phones.
    for (const [width,height] of [[360,800],[390,844]]) {
      const context=await browser.newContext({viewport:{width,height},isMobile:true,hasTouch:true});
      const page=await context.newPage();
      try {
        await page.goto(url);
        await page.locator('[data-action="mode"][data-value="demo"]').click();
        await departClassicForest(page);
        for (const pos of [21,22,23,18])
          await page.locator('.forest-field [data-action="field-step"][data-value="'+pos+'"]').click();
        const fork=page.locator('.forest-tracks-fork');
        assert.equal(await fork.isVisible(),true,'forest fork is visible on '+width+'px');
        assert.equal(await fork.locator('[data-action="lantern-examine"]').count(),0,'no lantern option without the crafted tool');
        assert.equal(await page.locator('.field-choices > [data-action="lantern-examine"]').count(),0,'lantern option never escapes the fork group');
        assert.doesNotMatch(await fork.innerText(),/狼牙 \+1/,'exact loot stays a discovery');
        const risk=fork.locator('[data-action="forest-tracks-risk"]');
        assert.equal(await risk.isEnabled(),true);
        await risk.scrollIntoViewIfNeeded();
        const box=await risk.boundingBox();
        assert(box&&box.x>=0&&box.x+box.width<=width+2&&box.y>=0&&box.y+box.height<=height+2,
          'risk choice must be tappable at '+width+'px');
        await page.screenshot({path:path.join(output,'forest-risk-fork-'+width+'.png')});
        await risk.click();
        const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('crownless-expedition-v1-demo')));
        assert.equal(saved.expedition.materials.wolfFang,1,'reward remains in expedition bag');
        assert.equal(saved.materials.wolfFang,0,'no banked loot before safe return');
        assert.match(await page.locator('.field-choices [data-action="return"]').innerText(),/狼牙を持って生還/,
          'earned fang changes the safe-return decision on '+width+'px');
        await page.reload();
        assert.equal(await page.locator('.forest-tracks-fork').count(),0,'fork cannot be farmed after reload');
        assert.match(await page.locator('.field-choices [data-action="return"]').innerText(),/狼牙を持って生還/,
          'save/reload retains the earned safe-return label');
        await page.locator('.field-choices [data-action="return"]').click();
        const banked=await page.evaluate(()=>JSON.parse(localStorage.getItem('crownless-expedition-v1-demo')));
        assert.equal(banked.materials.wolfFang,1,'safe return banks the fang');
      } finally { await context.close(); }
    }

    // Separate compact and desktop viewport checks, without repeating the
    // expensive multi-stage adventure tests for each added breakpoint.
    for (const [width,height] of [[430,932],[1280,900]]) {
      const context=await browser.newContext({viewport:{width,height},isMobile:width<481,hasTouch:width<481});
      const page=await context.newPage();
      try {
        await page.goto(url);
        await page.locator('[data-action="mode"][data-value="demo"]').click();
        const map=await page.locator('.nearby-scene').boundingBox();
        const card=await page.locator('.nearby-card').boundingBox();
        const dock=await page.locator('.bottom-navigation').boundingBox();
        assert(map&&card&&dock && Math.abs(map.y+map.height-card.y)<3 && Math.abs(card.y+card.height-dock.y)<3,
          width+'px: no scroll-sheet may paint over the map');
        assert(map.height>300,width+'px: map must be large enough to explore');
        await page.screenshot({path:path.join(output,'map-production-'+width+'.png')});
        await departClassicForest(page);
        await walkForestToWolf(page);
        assert.equal(await page.locator('.combat-choice-grid .choice').count(),4,'wide phones/desktop share the same tactical options');
        assert.equal(await page.locator('.combat-choice-grid [data-action="guard"]').isVisible(),true);
        await page.screenshot({path:path.join(output,'combat-production-'+width+'.png')});
        await page.locator('.combat-choice-grid [data-action="guard"]').click();
        const guarded=await page.evaluate(()=>JSON.parse(localStorage.getItem('crownless-expedition-v1-demo')));
        assert(guarded.expedition?.enemy?.turn>0,width+'px: manual combat must advance a real turn');
      } finally {await context.close();}
    }

    // A discovered POI must change REAL banked resources and expedition choices.
    let forgedSaved=null, towerRumorSaved=null;
    const poiContext = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    const poiPage = await poiContext.newPage();
    try {
      await poiPage.goto(url);
      await poiPage.locator('[data-action="mode"][data-value="demo"]').click();
      // Earn the other region's required material in an actual forest combat.
      await poiPage.locator('.nearby-card-actions [data-action="depart"][data-value="wood"]').click();
      await walkForestToWolf(poiPage);
      await poiPage.locator('[data-action="auto-fight"]').click();
      await poiPage.locator('.field-choices [data-action="return"]').click();
      await poiPage.locator('[data-action="continue"]').click();
      await poiPage.locator('[data-action="tab"][data-value="explore"]').click();
      const earnedFang=await poiPage.evaluate(()=>JSON.parse(localStorage.getItem('crownless-expedition-v1-demo')).materials.wolfFang);
      assert(earnedFang>=1,'forest combat must provide the second region ingredient');
      await poiPage.locator('[data-action="nearby-view"][data-value="scout"]').click();
      await poiPage.locator('[data-action="scout"][data-value="tower"]').click();
      await poiPage.locator('[data-action="nearby-view"][data-value="scout"]').click();
      await poiPage.locator('[data-action="scout"][data-value="tower"]').click();
      await poiPage.evaluate(() => {
        const key="crownless-expedition-v1-demo";
        const saved=JSON.parse(localStorage.getItem(key));
        saved.scrap=7; // Earned currency fixture: isolate the discovery→shop mechanic.
        localStorage.setItem(key,JSON.stringify(saved));
      });
      await poiPage.reload();
      await poiPage.locator('[data-action="nearby-view"][data-value="detail"]').click();
      await poiPage.screenshot({ path: path.join(output, "poi-shop-390.png") });
      await poiPage.locator('[data-action="poi"][data-value="trade-material"]').click();
      const trade=await poiPage.evaluate(() => JSON.parse(localStorage.getItem("crownless-expedition-v1-demo")));
      assert.equal(trade.scrap,4);
      assert.equal(trade.materials.watchIron,1);
      await poiPage.locator('[data-action="nearby-view"][data-value="map"]').click();
      await poiPage.locator('.nearby-track-tile[data-value="0,1"]').click();
      await poiPage.locator('[data-action="nearby-view"][data-value="detail"]').click();
      const towerEntry=poiPage.locator('.district-poi-card');
      assert.match(await towerEntry.innerText(),/鐘の手掛かりを追って出発/);
      assert.doesNotMatch(await towerEntry.innerText(),/返し棘の盾|固有の発見|討伐で鐘鉄/,
        'tower event entry keeps the safe discovery and guardian reward surprising');
      await poiPage.screenshot({ path: path.join(output, "poi-clue-390.png") });
      await poiPage.locator('[data-action="poi"][data-value="clue"]').click();
      const explored=await poiPage.evaluate(() => JSON.parse(localStorage.getItem("crownless-expedition-v1-demo")));
      assert.equal(explored.expedition.stage,'path','bell rumor starts real exploration, not instant combat');
      assert.equal(explored.expedition.tower.rumor,true);
      towerRumorSaved=explored;
      await poiPage.screenshot({path:path.join(output,'tower-mystery-entrance-390.png')});
      for(const id of [21,22])
        await poiPage.locator('.tower-field [data-action="tower-step"][data-value="'+id+'"]').click();
      const fork=poiPage.locator('.tower-rumor-fork');
      assert.match(await fork.innerText(),/鐘の音|鎧の足音/);
      assert.doesNotMatch(await fork.innerText(),/戦わず発見を持ち帰れる|盾の製法|鐘鉄 \+/, 'the choice must not spoil the reward or safe route');
      assert.equal(await fork.locator('button').count(),2,'both real adjacent branches must be selectable');
      const fit=await fork.evaluate(el=>{
        const r=el.getBoundingClientRect(),btns=[...el.querySelectorAll('button')].map(b=>b.getBoundingClientRect());
        return {left:r.left,right:r.right,buttons:btns.map(b=>({left:b.left,right:b.right,width:b.width}))};
      });
      assert(fit.left>=-1&&fit.right<=391&&fit.buttons.every(b=>b.left>=-1&&b.right<=391&&b.width>=120),
        'two actions fit at 390px: '+JSON.stringify(fit));
      await poiPage.screenshot({path:path.join(output,'tower-mystery-fork-390.png')});
      await poiPage.setViewportSize({width:360,height:800});
      const narrow=await fork.evaluate(el=>{
        const dock=document.querySelector('.bottom-navigation')?.getBoundingClientRect();
        // Expedition scenes have no global dock: use the actual phone viewport.
        const bottomLimit=dock?dock.top:innerHeight;
        return [...el.querySelectorAll('button')].map(b=>{
          const r=b.getBoundingClientRect(),hit=document.elementFromPoint(r.left+r.width/2,r.top+r.height/2);
          return {left:r.left,right:r.right,bottom:r.bottom,bottomLimit,width:r.width,
            tappable:hit===b||b.contains(hit)};
        });
      });
      assert(narrow.every(b=>b.left>=-1&&b.right<=361&&b.width>=110&&b.tappable&&b.bottom<=b.bottomLimit+2),
        'both fork choices must fit and receive touch above the 360px dock: '+JSON.stringify(narrow));
      await poiPage.screenshot({path:path.join(output,'tower-mystery-fork-360.png')});
      await fork.locator('[data-action="tower-step"][data-value="23"]').click();
      assert.match(await poiPage.locator('.field-moment').innerText(),/盾の影.*引き返せる/,
        'choosing the footsteps must reveal new danger without starting a fight');
      const stillWalking=await poiPage.evaluate(()=>JSON.parse(localStorage.getItem('crownless-expedition-v1-demo')));
      assert.equal(stillWalking.expedition.stage,'path','the player may still retreat after choosing danger');
      await poiPage.setViewportSize({width:390,height:844});
      for(const id of [18,19,14,9])
        await poiPage.locator('.tower-field [data-action="tower-step"][data-value="'+id+'"]').click();
      const fight=await poiPage.evaluate(() => JSON.parse(localStorage.getItem("crownless-expedition-v1-demo")));
      assert.equal(fight.expedition.enemy.clue,true);
      assert.equal(fight.expedition.stage,"fight");
      assert.equal(await poiPage.locator('.combat-clue-outcome').count(),0,
        'the direct guardian route must not display an unearned relic resonance');
      await poiPage.reload();
      assert.match(await poiPage.locator("#game").innerText(), /鐘守の亡兵/);
      await poiPage.evaluate(()=>{
        const key='crownless-expedition-v1-demo', saved=JSON.parse(localStorage.getItem(key));
        saved.expedition.enemy.hp=1; // Shorten battle only; victory/banking/forge remain real clicks.
        localStorage.setItem(key,JSON.stringify(saved));
      });
      await poiPage.reload();
      await poiPage.locator('[data-action="auto-fight"]').click();
      const found=await poiPage.evaluate(()=>JSON.parse(localStorage.getItem('crownless-expedition-v1-demo')));
      assert.equal(found.expedition?.foundDesign,'shield_thorn','tower event victory reveals a carried design');
      assert.equal(found.designs.shield_thorn,undefined,'unreturned design must not be banked');
      await poiPage.screenshot({path:path.join(output,'blueprint-risk-390.png')});
      await poiPage.locator('.field-choices [data-action="return"]').click();
      assert.match(await poiPage.locator('.report-layout').innerText(),/新しい製作レシピを解放：返し棘の盾/);
      await poiPage.locator('[data-action="continue"]').click();
      await poiPage.locator('[data-action="tab"][data-value="gear"]').click();
      await poiPage.screenshot({path:path.join(output,'blueprint-unlocked-390.png')});
      await poiPage.locator('[data-action="character"][data-value="1"]').click();
      const smithButton=poiPage.locator('.gear-quick-craft [data-action="craft-item"][data-value="shield_thorn"]');
      assert.equal(await smithButton.count(),1,'newly unlocked, truly craftable blueprint gets the single fast smith action');
      assert.equal(await smithButton.isEnabled(),true,'cross-region materials and design enable smithing');
      const firstScreenCraft=await smithButton.evaluate(button=>{
        const r=button.getBoundingClientRect(), dock=document.querySelector('.bottom-navigation').getBoundingClientRect();
        const at=document.elementFromPoint(r.left+r.width/2,r.top+r.height/2);
        return {top:r.top,bottom:r.bottom,dockTop:dock.top,tappable:at===button||button.contains(at)};
      });
      assert(firstScreenCraft.top>=0 && firstScreenCraft.bottom<firstScreenCraft.dockTop-4 && firstScreenCraft.tappable,
        'a real ready-to-craft action must be visibly tappable above the thumb dock without scrolling: '+JSON.stringify(firstScreenCraft));
      await poiPage.screenshot({path:path.join(output,'smith-ready-first-screen-390.png')});
      await smithButton.click();
      assert.equal(await poiPage.locator('.gear-quick-craft [data-action="craft-item"][data-value="shield_thorn"]').count(),0,
        'crafted item must not remain in the quick-craft queue');
      await poiPage.locator('[data-action="character"][data-value="0"]').click();
      await poiPage.locator('[data-action="equip"][data-value="shield_thorn"]').click();
      await poiPage.screenshot({path:path.join(output,'smith-crafted-equipped-390.png')});
      const forged=await poiPage.evaluate(()=>JSON.parse(localStorage.getItem('crownless-expedition-v1-demo')));
      forgedSaved=forged;
      assert.equal(forged.equipped,'shield_thorn');
      assert.equal(forged.designs.shield_thorn,'0,1','recipe remembers actual tower origin');
      assert(forged.owned.includes('shield_thorn'));
      assert(forged.materials.wolfFang<earnedFang,'smith consumes forest fang as well as tower iron');
      await poiPage.reload();
      await poiPage.locator('[data-action="tab"][data-value="gear"]').click();
      assert.match(await poiPage.locator('#game').innerText(),/返し棘の盾/);
      await poiPage.locator('[data-action="tab"][data-value="explore"]').click();
      await poiPage.locator('.nearby-track-tile[data-value="-1,0"]').click();
      await poiPage.locator('.nearby-card-actions [data-action="depart"][data-value="wood"]').click();
      await walkForestToWolf(poiPage);
      assert.equal(await poiPage.locator('.combat-manual').getAttribute('open'),'','four choices should appear by default');
      assert.match(await poiPage.locator('.combat-manual').innerText(),/反撃/,'new shield changes the available guard decision');
      await poiPage.screenshot({path:path.join(output,'crafted-shield-combat-390.png')});
    } finally {
      await poiContext.close();
    }


    // Re-enter from the real discovered POI, then earn the relic manually.
    const relicContext=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
    const relicPage=await relicContext.newPage();
    try {
      assert(towerRumorSaved?.expedition?.tower?.rumor);
      await relicPage.addInitScript(saved=>{
        const key='crownless-expedition-v1-demo';
        if(!localStorage.getItem(key)){
          localStorage.setItem('crownless-expedition-mode','demo');
          localStorage.setItem(key,JSON.stringify(saved));
        }
      },towerRumorSaved);
      await relicPage.goto(url);
      for(const id of [21,22,17])
        await relicPage.locator('.tower-field [data-action="tower-step"][data-value="'+id+'"]').click();
      assert.equal(await relicPage.locator('.tower-field [data-action="tower-step"][data-value="12"]').count(),0,
        'hidden stair must not appear as normal navigation');
      await relicPage.locator('.tower-echo-investigate').click();
      const opened=await relicPage.evaluate(()=>JSON.parse(localStorage.getItem('crownless-expedition-v1-demo')));
      assert.equal(opened.expedition.tower.pos,17,'investigation must not teleport');
      assert.equal(opened.expedition.tower.open,true);
      // Returning to the fork after a deliberate investigation must remember
      // the earned staircase without prematurely revealing the reliquary loot.
      for(const id of [18,23,22])
        await relicPage.locator('.tower-field [data-action="tower-step"][data-value="'+id+'"]').click();
      await relicPage.reload();
      for(const width of [390,360]){
        await relicPage.setViewportSize({width,height:width===360?800:844});
        const openedFork=relicPage.locator('.tower-rumor-fork');
        assert.match(await openedFork.innerText(),/隠し階段を見つけた/);
        assert.match(await openedFork.innerText(),/見つけた階段を確かめる/);
        assert.doesNotMatch(await openedFork.innerText(),/床下の鐘の音を追う|鐘鉄を守って生還|盾の製法/);
        assert.equal(await openedFork.locator('button').count(),2);
        const fit=await openedFork.locator('button').evaluateAll(btns=>btns.map(b=>{
          const r=b.getBoundingClientRect(),hit=document.elementFromPoint(r.left+r.width/2,r.top+r.height/2);
          return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,tappable:hit===b||b.contains(hit)};
        }));
        assert(fit.every(b=>b.left>=-1&&b.right<=width+1&&b.top>=0&&b.bottom<=(width===360?800:844)+2&&b.tappable),
          width+'px discovered-stair fork must fit and receive touch: '+JSON.stringify(fit));
        await relicPage.screenshot({path:path.join(output,'tower-stair-found-fork-'+width+'.png')});
      }
      await relicPage.locator('.tower-rumor-fork [data-action="tower-step"][data-value="17"]').click();
      for(const id of [12,7,12,17,18,23,22])
        await relicPage.locator('.tower-field [data-action="tower-step"][data-value="'+id+'"]').click();
      await relicPage.reload();
      const found=await relicPage.evaluate(()=>JSON.parse(localStorage.getItem('crownless-expedition-v1-demo')));
      assert.equal(found.expedition.tower.relic,true,'relic survives reload');
      assert.equal(found.expedition.materials.watchIron,1,'unbanked bell iron remains at risk');
      assert.equal(found.materials.watchIron,towerRumorSaved.materials.watchIron,'relic cannot bank before return');
      for(const width of [390,360]){
        await relicPage.setViewportSize({width,height:width===360?800:844});
        const fork=relicPage.locator('.tower-rumor-fork');
        assert.match(await fork.innerText(),/鐘鉄を守って生還/);
        assert.match(await fork.innerText(),/鎧の足音を追う/);
        assert.match(await fork.innerText(),/鐘鉄の共鳴で初手 \+1/,'earned resonance is visible before committing to risk');
        assert.match(await fork.innerText(),/勝てば盾の製法、敗れれば背嚢を失う/,'the discovered fork states reward and loss');
        assert.equal(await fork.locator('button').count(),2);
        assert.equal(await relicPage.locator('.field-choices [data-action="return"]').count(),1,
          'only one return button at the relic fork');
        const boxes=await fork.locator('button').evaluateAll(btns=>btns.map(b=>{
          const r=b.getBoundingClientRect(),at=document.elementFromPoint(r.left+r.width/2,r.top+r.height/2);
          return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,
            tappable:at===b||b.contains(at),height:innerHeight};
        }));
        assert(boxes.every(b=>b.left>=-1&&b.right<=width+1&&b.width>=110&&
          b.top>=0&&b.bottom<=b.height+2&&b.tappable),
          width+'px relic choices must fit and receive touch: '+JSON.stringify(boxes));
        await relicPage.screenshot({path:path.join(output,'tower-relic-return-fork-'+width+'.png')});
      }
      // Branch from the same unbanked discovery to verify its earned combat payoff.
      // Keep the original page at the fork to test safe banking independently.
      const riskContext=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
      try {
        const riskPage=await riskContext.newPage();
        await riskPage.addInitScript(saved=>{
          localStorage.setItem('crownless-expedition-mode','demo');
          localStorage.setItem('crownless-expedition-v1-demo',JSON.stringify(saved));
        },found);
        await riskPage.goto(url);
        for(const id of [23,18,19,14,9])
          await riskPage.locator('.tower-field [data-action="tower-step"][data-value="'+id+'"]').click();
        const risky=await riskPage.evaluate(()=>JSON.parse(localStorage.getItem('crownless-expedition-v1-demo')));
        assert.equal(risky.expedition.stage,'fight');
        assert.equal(risky.expedition.focus,1,'discovered relic earns opening focus');
        for(const width of [390,360]) {
          const height=width===360?800:844;
          await riskPage.setViewportSize({width,height});
          const feedback=riskPage.locator('.combat-clue-outcome');
          assert.match(await feedback.innerText(),/鐘鉄の共鳴.*次の攻撃 \+1/);
          const box=await feedback.boundingBox();
          assert(box&&box.y>=0&&box.y+box.height<=height+2,
            width+'px earned resonance must be visible at the opening choice');
          await riskPage.screenshot({path:path.join(output,'tower-relic-combat-'+width+'.png')});
        }
      } finally {await riskContext.close();}
      await relicPage.locator('.tower-rumor-fork [data-action="return"]').click();
      const banked=await relicPage.evaluate(()=>JSON.parse(localStorage.getItem('crownless-expedition-v1-demo')));
      assert.equal(banked.expedition,null);
      assert.equal(banked.materials.watchIron,towerRumorSaved.materials.watchIron+1,'safe return banks only new iron');
      assert.equal(banked.designs.shield_thorn,undefined,'noncombat route never grants shield recipe');
    } finally {await relicContext.close();}

    // Continue with the REAL crafted character from the successful play loop in
    // an independent browser to test the solved place, not a fabricated unlock.
    const bellContext = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile:true, hasTouch:true });
    const bellPage = await bellContext.newPage();
    try {
      assert(forgedSaved?.designs?.shield_thorn, 'saved provenance from actual play');
      await bellPage.addInitScript(saved => {
        // Seed once. Overwriting saved state on every reload would silently
        // erase the NPC expedition we are specifically trying to verify.
        const key='crownless-expedition-v1-demo';
        if (!localStorage.getItem(key)) {
          localStorage.setItem('crownless-expedition-mode','demo');
          localStorage.setItem(key,JSON.stringify(saved));
        }
      },forgedSaved);
      await bellPage.goto(url);
      await bellPage.locator('[data-action="tab"][data-value="explore"]').click();
      await bellPage.locator('.nearby-track-tile[data-value="0,2"]').click();
      assert.equal(await bellPage.locator('.restored-bell-notice').count(),0,'the neighboring tower shop did not change');
      await bellPage.locator('.nearby-track-tile[data-value="0,1"]').click();
      assert.equal(await bellPage.locator('.nearby-track-tile.restored-bell').count(),1,'exact source tower is visibly changed');
      await bellPage.locator('[data-action="nearby-view"][data-value="detail"]').click();
      assert.match(await bellPage.locator('.restored-bell-notice').innerText(),/鐘守の弟子・ユノ/);
      await bellPage.screenshot({path:path.join(output,'bell-restored-revisit-390.png')});
      await bellPage.locator('[data-action="bell-depart"]').click();
      const signaled=await bellPage.evaluate(()=>JSON.parse(localStorage.getItem('crownless-expedition-v1-demo')));
      assert.equal(signaled.expedition.focus,3,'optional local NPC signal affects a real expedition');
      await bellPage.reload();
      assert.match(await bellPage.locator('#game').innerText(),/修復された鐘が鳴る/);
      // The restored-bell ally still helps in combat, but the entrance is
      // now a real walkable tower. Walk to the guardian instead of skipping it
      // through the old text-only "careful" button.
      for(const id of [21,22,23,24,19,14,9]){
        await bellPage.locator('.tower-field [data-action="tower-step"][data-value="'+id+'"]').click();
      }
      assert.equal(await bellPage.locator('.battle-layout').count(),1);
      const signalDamage=await bellPage.evaluate(()=>{
        const saved=JSON.parse(localStorage.getItem('crownless-expedition-v1-demo'));
        const baseline=JSON.parse(JSON.stringify(saved)); baseline.expedition.focus=0;
        return window.CrownlessSlice.attackPreview(saved,'strike')-window.CrownlessSlice.attackPreview(baseline,'strike');
      });
      assert.equal(signalDamage,3,'bell NPC changes the next tactical strike, not just flavor text');
      await bellPage.screenshot({path:path.join(output,'bell-signal-combat-390.png')});
    } finally {
      await bellContext.close();
    }

    // Architecture spike: existing real saved state → an isolated, single-owner UI
    // → selecting a changed place → departing with existing engine → combat.
    // This comparison page may never write the source game's saved progress.
    for (const width of [360,390]) {
      const labContext = await browser.newContext({viewport:{width,height:width===360?800:844},isMobile:true,hasTouch:true});
      const labPage = await labContext.newPage();
      const labErrors=[];
      labPage.on('pageerror',e=>labErrors.push(e.message));
      try {
        assert(forgedSaved?.designs?.shield_thorn,'a real playthrough provided the lab save');
        await labPage.addInitScript(saved=>{
          localStorage.setItem('crownless-expedition-mode','demo');
          localStorage.setItem('crownless-expedition-v1-demo',JSON.stringify(saved));
        },forgedSaved);
        await labPage.goto(url.replace('/expedition.html','/architecture-lab.html'));
        assert.equal(await labPage.locator('.lab-place').count()>0,true);
        assert.match(await labPage.locator('.lab-card').innerText(),/北の見張り跡|西の木立/);
        const original=await labPage.evaluate(()=>localStorage.getItem('crownless-expedition-v1-demo'));
        const map=await labPage.locator('.lab-map').boundingBox();
        const card=await labPage.locator('.lab-card').boundingBox();
        assert(map && card && Math.abs(map.y+map.height-card.y)<=2,'the card is a separate grid row and cannot overlap the map');
        const dimensions=await labPage.evaluate(()=>({height:innerHeight,innerWidth,scrollHeight:document.documentElement.scrollHeight,clientHeight:document.documentElement.clientHeight,body:document.body.scrollHeight,frame:document.querySelector('.lab-frame').getBoundingClientRect().height,visualViewport:window.visualViewport?.height}));
        assert.equal(dimensions.scrollHeight<=dimensions.clientHeight+1,true,'no page-level vertical scroll: '+JSON.stringify(dimensions));
        assert.equal(await labPage.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),true,'no horizontal overflow');
        await labPage.locator('.lab-place[data-value="0,1"]').click();
        assert.match(await labPage.locator('.lab-card').innerText(),/ユノの合図で出発/);
        await labPage.screenshot({path:path.join(output,'architecture-lab-map-'+width+'.png')});
        await labPage.locator('[data-action="bell"]').click();
        assert.match(await labPage.locator('.lab-card').innerText(),/最初の足跡をたどる/);
        await labPage.locator('[data-action="careful"]').click();
        assert.match(await labPage.locator('.lab-card').innerText(),/ENCOUNTER/);
        await labPage.locator('[data-action="strike"]').click();
        assert.equal(await labPage.evaluate(()=>localStorage.getItem('crownless-expedition-v1-demo')),original,'technical preview must never write live saves');
        assert.deepEqual(labErrors,[],'architecture comparison has no JS errors');
        await labPage.screenshot({path:path.join(output,'architecture-lab-fight-'+width+'.png')});
      } finally { await labContext.close(); }
    }

    // Regression: after smithing the role remains "smith"; the previous map
    // rendered a disabled departure with no explanation. Check both a desktop
    // pointer and actual phone-sized tap and save, not just a CSS snapshot.
    for (const [width,height] of [[360,800],[390,844],[1280,800]]) {
      const roleContext=await browser.newContext({viewport:{width,height},isMobile:width<480,hasTouch:width<480});
      const rolePage=await roleContext.newPage();
      const roleErrors=[];
      rolePage.on('pageerror',error=>roleErrors.push(error.message));
      try {
        await rolePage.goto(url);
        await rolePage.locator('[data-action="mode"][data-value="demo"]').click();
        const defaultDepart=rolePage.locator('.nearby-card-actions [data-action="depart"][data-value="wood"]');
        assert.equal(await defaultDepart.isEnabled(),true,'normal adventurer departure must remain enabled on '+width);
        const centerHit=async locator=>locator.evaluate(el=>{
          const r=el.getBoundingClientRect();
          const hit=document.elementFromPoint(r.left+r.width/2,r.top+r.height/2);
          return {hit:hit===el||el.contains(hit),rect:{left:r.left,top:r.top,right:r.right,bottom:r.bottom},viewport:{w:innerWidth,h:innerHeight}};
        });
        const defaultHit=await centerHit(defaultDepart);
        assert(defaultHit.hit,'normal map departure must receive pointer at '+width+': '+JSON.stringify(defaultHit));
        await rolePage.locator('.bottom-navigation [data-action="tab"][data-value="gear"]').click();
        await rolePage.locator('[data-action="character"][data-value="1"]').click();
        const asSmith=await rolePage.evaluate(()=>JSON.parse(localStorage.getItem('crownless-expedition-v1-demo')));
        assert.equal(asSmith.activeCharacter,1,'smith role is the actual saved state');
        await rolePage.locator('.bottom-navigation [data-action="tab"][data-value="explore"]').click();
        const readyDepart=rolePage.locator('.nearby-card-actions [data-action="depart-as-adventurer"][data-value="wood"]');
        assert.equal(await readyDepart.count(),1,'smith can see the explicit role-switching departure');
        assert.equal(await readyDepart.isEnabled(),true,'smith departure must not be a dead disabled control');
        assert.match(await readyDepart.innerText(),/冒険者に交代して遠征/);
        const smithHit=await centerHit(readyDepart);
        assert(smithHit.hit && smithHit.rect.top>=0 && smithHit.rect.bottom<=height+2,
          'smith departure must be a real unobscured first-screen tap on '+width+': '+JSON.stringify(smithHit));
        await rolePage.screenshot({path:path.join(output,'smith-depart-ready-'+width+'.png')});
        await readyDepart.click();
        const leftSmith=await rolePage.evaluate(()=>JSON.parse(localStorage.getItem('crownless-expedition-v1-demo')));
        assert.equal(leftSmith.activeCharacter,0,'departing switches to real adventurer, not a simulated role');
        assert.equal(leftSmith.expedition?.place,'wood','one click begins the selected real expedition');
        assert.equal(leftSmith.runs,1,'only one expedition starts');
        assert.equal(leftSmith.characters[1].equipped,asSmith.characters[1].equipped,
          'one-tap departure preserves smith equipment state');
        await rolePage.reload();
        assert.equal(await rolePage.locator('.expedition-layout:not(.battle-layout)').count(),1,
          'reloaded save must resume adventurer expedition after single tap');
        assert.deepEqual(roleErrors,[],'role-switching departure must not cause runtime errors on '+width);
      } finally {await roleContext.close();}
    }

    // Product's central new agency: a detour under a tree yields real,
    // loseable loot; turning back safely banks it, including after reload.
    for(const width of [360,390]){
      const context=await browser.newContext({viewport:{width,height:width===360?800:844},isMobile:true,hasTouch:true});
      const page=await context.newPage();
      const errors=[];page.on('pageerror',e=>errors.push(e.message));
      try{
        await page.goto(url);
        await page.locator('[data-action="mode"][data-value="demo"]').click();
        await departClassicForest(page);
        const fog=await page.locator('.field-cell.veiled').count();
        await page.locator('.field-cell[data-value="21"]').click();
        assert((await page.locator('.field-cell.veiled').count())<fog,
          'the fog clears as the traveler chooses a new step');
        await page.locator('.field-cell[data-value="16"]').click();
        const offered=await page.evaluate(()=>JSON.parse(localStorage.getItem('crownless-expedition-v1-demo')));
        assert.equal(offered.expedition.field.cache,false,'entering the cache does not collect');
        assert.equal(offered.expedition.hp,30,'no forced damage on movement');
        assert.equal(offered.expedition.scrap,0,'loot requires deliberate search');
        const search=page.locator('.field-choices [data-action="forest-cache-search"]');
        assert.equal(await search.count(),1,'optional cache risk is visible on phone');
        const bounds=await search.boundingBox();
        assert(bounds && bounds.width>=44 && bounds.height>=44,'risk choice is thumb reachable');
        await search.click();
        const found=await page.evaluate(()=>JSON.parse(localStorage.getItem('crownless-expedition-v1-demo')));
        assert.equal(found.expedition.field.cache,true);
        assert.equal(found.expedition.hp,27);
        assert.equal(found.expedition.scrap,4);
        await page.screenshot({path:path.join(output,'forest-cache-found-'+width+'.png')});
        await page.reload();
        assert.equal(await page.locator('.forest-field[data-field-pos="16"]').count(),1,
          'player position and revealed terrain survive ordinary reload');
        await page.locator('.field-cell[data-value="21"]').click();
        await page.locator('.field-cell[data-value="16"]').click();
        const again=await page.evaluate(()=>JSON.parse(localStorage.getItem('crownless-expedition-v1-demo')));
        assert.equal(again.expedition.scrap,4,'no repeatable loot from the same cache');
        const exit=page.locator('.field-choices [data-action="return"]');
        assert(await exit.isVisible(),'safe return stays clearly available during the detour');
        await exit.click();
        const banked=await page.evaluate(()=>JSON.parse(localStorage.getItem('crownless-expedition-v1-demo')));
        assert.equal(banked.scrap,4,'safe return banks actual found materials');
        assert.equal(await page.locator('.report-layout').count(),1);
        await page.screenshot({path:path.join(output,'forest-safe-return-'+width+'.png')});
        assert.deepEqual(errors,[],'the fog/detour scene must not cause browser runtime errors');
      } finally {await context.close();}
    }

    // A wolf is visible before combat, reacts to proximity, and presents a
    // real route choice: engage the den or turn away and bypass it.
    for(const width of [360,390]){
      const context=await browser.newContext({viewport:{width,height:width===360?800:844},isMobile:true,hasTouch:true});
      const page=await context.newPage();
      const errors=[];page.on('pageerror',e=>errors.push(e.message));
      const saved=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('crownless-expedition-v1-demo')));
      try{
        await page.goto(url);
        await page.locator('[data-action="mode"][data-value="demo"]').click();
        await departClassicForest(page);
        assert.equal(await page.locator('.forest-field[data-wolf-state="hidden"]').count(),1,
          'wolf must not appear through an unexplored fog-of-war region');
        assert.equal(await page.locator('.forest-wolf-warning').count(),0);
        assert.equal(await page.locator('.forest-field .wolf-threat').count(),0,
          'the wolf danger marker must not leak through undiscovered fog');
        for(const id of [21,22,23,18,13]){
          await page.locator('.forest-field [data-action="field-step"][data-value="'+id+'"]').click();
        }
        assert.equal(await page.locator('.forest-field[data-wolf-state="alert"]').count(),1,
          'the wolf must become visible and alert when adjacent');
        const warning=page.locator('.forest-wolf-warning');
        assert.match(await warning.innerText(),/狼に気づかれた/);
        assert.equal(await warning.isVisible(),true,'not just a hidden accessibility state');
        const wolfTarget=page.locator('.forest-field button.field-cell.den.wolf-threat');
        assert.equal(await wolfTarget.count(),1,'only the adjacent undefeated den gets a danger choice');
        assert.equal(await wolfTarget.evaluate(el=>el.classList.contains('walk-nav')),false,
          'combat risk must never be painted as an ordinary walking waypoint');
        assert.match(await wolfTarget.getAttribute('aria-label'),/戦闘になる/);
        const threatStyle=await wolfTarget.evaluate(el=>{
          const mark=getComputedStyle(el,'::after'),box=el.getBoundingClientRect();
          return {content:mark.content,width:parseFloat(mark.width),height:box.height};
        });
        assert(threatStyle.content.includes('!')&&threatStyle.width>=20&&threatStyle.height>=44,
          'the red risk marker must be visible and its target tappable on '+width+'px');
        assert.equal(await page.locator('.forest-field-header small').count(),0,
          'when the wolf appears, redundant header copy must not sit beneath alert banner');
        const warningState=await warning.evaluate(el=>{
          const scene=document.querySelector('.forest-field');
          const r=el.getBoundingClientRect();
          return {pointerEvents:getComputedStyle(el).pointerEvents,
            bottom:r.bottom,sceneBottom:scene.getBoundingClientRect().bottom};
        });
        assert.equal(warningState.pointerEvents,'none','wolf warning cannot obstruct movement taps');
        assert(warningState.bottom<warningState.sceneBottom,
          'alert belongs inside the scene, not over the retreat button');
        assert.equal((await saved()).expedition.stage,'path',
          'wolf seeing the hero cannot force a combat');
        await page.waitForTimeout(510); // finish the 410ms approach animation before framing checks
        const sightline=await page.evaluate(()=>{
          const space=document.querySelector('.forest-field .field-worldspace').getBoundingClientRect();
          const frame=document.querySelector('.forest-field .field-terrain').getBoundingClientRect();
          const point=(x,y)=>({x:space.left+space.width*x/840,y:space.top+space.height*y/840});
          return {wolfEar:point(420,125),heroBoot:point(420,330),
            viewport:{left:frame.left,right:frame.right,top:frame.top,bottom:frame.bottom}};
        });
        assert([sightline.wolfEar,sightline.heroBoot].every(pt=>
          pt.x>=sightline.viewport.left-3&&pt.x<=sightline.viewport.right+3&&
          pt.y>=sightline.viewport.top-3&&pt.y<=sightline.viewport.bottom+3),
          'alert camera must frame the wolf and traveler together: '+JSON.stringify(sightline));
        await page.screenshot({path:path.join(output,'forest-wolf-spotted-'+width+'.png')});
        await page.reload();
        assert.equal(await page.locator('.forest-field[data-wolf-state="alert"]').count(),1,
          'wolf detection must survive a saved expedition reload');
        await page.locator('.forest-field [data-action="field-step"][data-value="8"]').click();
        const fought=await saved();
        assert.equal(fought.expedition.stage,'fight');
        assert.equal(fought.expedition.enemy.risky,true,'den is the deliberately risky fight');
        await page.screenshot({path:path.join(output,'forest-wolf-engaged-'+width+'.png')});

        // New independent expedition: see the wolf, back away, take the gate.
        const escapeContext=await browser.newContext({viewport:{width,height:width===360?800:844},isMobile:true,hasTouch:true});
        const escape=await escapeContext.newPage();
        try{
          await escape.goto(url);
          await escape.locator('[data-action="mode"][data-value="demo"]').click();
          await escape.locator('.nearby-card-actions [data-action="depart"][data-value="wood"]').click();
          for(const id of [21,22,23,18,13,14]){
            await escape.locator('.forest-field [data-action="field-step"][data-value="'+id+'"]').click();
          }
          const slipped=await escape.evaluate(()=>JSON.parse(localStorage.getItem('crownless-expedition-v1-demo')));
          assert.equal(slipped.expedition.stage,'path');
          assert.equal(await escape.locator('.forest-field[data-wolf-state="watching"]').count(),1,
            'the wolf stays behind while the player returns to safety');
          assert.match(slipped.expedition.log[0],/狼の視線を振り切った/);
          await escape.screenshot({path:path.join(output,'forest-wolf-bypassed-'+width+'.png')});
          for(const id of [9,4])await escape.locator('.forest-field [data-action="field-step"][data-value="'+id+'"]').click();
          const passed=await escape.evaluate(()=>JSON.parse(localStorage.getItem('crownless-expedition-v1-demo')));
          assert.equal(passed.expedition,null,'the stone gate banks loot without starting a second fight');
          assert.equal(passed.report.died,false,'avoiding the wolf stays a genuinely safe choice');
        }finally{await escapeContext.close();}
        assert.deepEqual(errors,[],'wolf encounter/retreat must not throw browser exceptions');
      }finally{await context.close();}
    }

    // New discovery trio: a real chest, visibly moving vines, and a one-use
    // shrine behind an actual newly-opened shortcut. No JS state teleport.
    for(const width of [360,390]){
      const context=await browser.newContext({viewport:{width,height:width===360?800:844},isMobile:true,hasTouch:true});
      const page=await context.newPage();
      const errors=[];page.on('pageerror',e=>errors.push(e.message));
      const saved=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('crownless-expedition-v1-demo')));
      const step=async n=>page.locator('.forest-field [data-action="field-step"][data-value="'+n+'"]').click();
      try{
        await page.goto(url);
        await page.locator('[data-action="mode"][data-value="demo"]').click();
        await departClassicForest(page);
        assert.equal(await page.locator('.forest-field[data-field-secret="false"][data-field-shrine="false"]').count(),1);
        assert.equal(await page.locator('.field-cell[data-value="12"]').count(),0,'hidden path must not be a reachable teleport from the entrance');
        await step(21);await step(16); // Collecting old iron shards costs three HP.
        assert.match(await page.locator('.field-moment').innerText(),/乾いた葉を擦るような音/,
          'the cache approach offers a curiosity cue on '+width+'px without a waypoint');
        assert.equal(await page.locator('.forest-field[data-field-secret="false"]').count(),1);
        await step(17); // The existing real treasure chest.
        assert.match(await page.locator('.field-moment').innerText(),/宝箱の背後でツタが擦れる音/,
          'the discovered treasure leads to deliberate vine investigation');
        const found=await saved();
        assert.equal(found.expedition.scrap,10);
        assert.equal(found.expedition.materials.wolfFang,1);
        assert.equal(found.expedition.hp,27);
        assert.equal(found.expedition.field.secret,false);
        assert.equal(found.expedition.field.shrine,false);
        // The undiscovered entrance must NOT be a map target. The audible
        // clue offers a separate, explicit investigation action instead.
        assert.equal(await page.locator('.forest-field button.field-cell.secret').count(),0,
          'unopened secret must not leak as a map tap target');
        assert.equal(await page.locator('.forest-field .field-cell.secret.veiled').count(),1,
          'the hidden passage remains covered by fog until investigated');
        assert.equal(await page.locator('.forest-field .field-cell.secret.walk-nav').count(),0,
          'closed secret vines have no walking waypoint');
        assert.equal(await page.locator('.forest-field button.field-cell.veiled').count(),0,
          'unexplored fog is not a walking tap target');
        assert((await page.locator('.forest-field .walk-nav').count())>=2,
          'regular walkable neighbors still have navigation near the hidden passage');
        const inspect=page.locator('.field-choices button[data-action="field-step"][data-value="12"]');
        assert.equal(await inspect.count(),1,
          'the sound clue exposes exactly one deliberate investigation action');
        assert.match(await inspect.innerText(),/宝箱の背後を調べる/);
        const tap=await inspect.evaluate(el=>{
          const b=el.getBoundingClientRect();
          const hit=document.elementFromPoint(b.left+b.width/2,b.top+b.height/2);
          return {height:b.height,hit:hit===el||el.contains(hit)};
        });
        assert(tap.hit&&tap.height>=44,'investigation must be physically tappable on small phones');
        await page.screenshot({path:path.join(output,'forest-secret-vines-'+width+'.png')});
        await inspect.click(); // First touch opens the barrier without moving.
        assert.equal(await page.locator('.forest-field[data-field-secret="true"][data-field-pos="17"]').count(),1);
        assert.equal(await page.locator('.forest-field .field-cell.secret.walk-nav').count(),0,
          'the shortcut stays unsignposted even after its collision barrier opens');
        assert.match(await page.locator('.field-moment').innerText(),/隠し道が開いた/);
        assert.equal(await page.locator('.field-cell.shrine.revealed').count(),0,
          'uncovering the barrier must not reveal the hidden shrine prematurely');
        await page.screenshot({path:path.join(output,'forest-secret-barrier-open-'+width+'.png')});
        await step(12); // Only the second touch enters the newly opened passage.
        assert.equal(await page.locator('.forest-field[data-field-secret="true"][data-field-pos="12"]').count(),1);
        assert.equal(await page.locator('.forest-field .field-cell.secret.walk-nav').count(),0,
          'the shortcut must not gain a waypoint when player stands in it');
        assert.equal(await page.locator('.field-cell.shrine.revealed').count(),1,
          'shrine becomes visible ONLY after entering the hidden passage');
        await page.waitForTimeout(460); // allow the camera to finish revealing the new vista
        const shrineFrame=await page.evaluate(()=>{
          const world=document.querySelector('.forest-field .field-worldspace').getBoundingClientRect();
          const viewport=document.querySelector('.forest-field .field-terrain').getBoundingClientRect();
          const shrine={x:world.left+world.width*300/840,y:world.top+world.height*180/840};
          return {shrine,top:viewport.top,bottom:viewport.bottom,left:viewport.left,right:viewport.right};
        });
        assert(shrineFrame.shrine.y>shrineFrame.top+45 &&
          shrineFrame.shrine.y<shrineFrame.bottom-25 &&
          shrineFrame.shrine.x>shrineFrame.left+25 &&
          shrineFrame.shrine.x<shrineFrame.right-25,
          'secret-path camera must show the newly discovered shrine instead of clipping it: '+JSON.stringify(shrineFrame));
        await page.screenshot({path:path.join(output,'forest-secret-open-'+width+'.png')});
        await page.reload();
        assert.equal(await page.locator('.forest-field[data-field-secret="true"][data-field-pos="12"]').count(),1,
          'revealed shortcut must survive reload without reversing');
        await step(7);
        const healed=await saved();
        assert.equal(healed.expedition.stage,'path');
        assert.equal(healed.expedition.field.shrine,true);
        assert.equal(healed.expedition.hp,30);
        assert.equal(healed.expedition.potions,3);
        assert.match(await page.locator('.field-moment').innerText(),/苔むした祠を発見/);
        assert.equal(await page.locator('.forest-field[data-field-shrine="true"]').count(),1);
        await page.screenshot({path:path.join(output,'forest-shrine-found-'+width+'.png')});
        await step(12);await step(7); // revisit cannot duplicate heals.
        const revisited=await saved();
        assert.equal(revisited.expedition.hp,30);
        assert.equal(revisited.expedition.potions,3);
        for(const id of [12,17,22,23,24,19,14,9,4])await step(id);
        const banked=await saved();
        assert.equal(banked.expedition,null);
        assert.equal(banked.scrap,10,'cache + original chest carry through new secret route');
        assert.equal(banked.materials.wolfFang,1);
        assert.equal(await page.locator('.report-layout').count(),1);
        assert.deepEqual(errors,[],'shrines and shortcut must not generate browser errors');
      }finally{await context.close();}
    }

    // The larger world has a genuinely distant side expedition.
    for(const width of [360,390]){
      const ctx=await browser.newContext({viewport:{width,height:width===360?800:844},isMobile:true,hasTouch:true});
      const page=await ctx.newPage();
      const step=async n=>page.locator('.forest-field [data-action="field-step"][data-value="'+n+'"]').click();
      try{
        await page.goto(url);
        await page.locator('[data-action="mode"][data-value="demo"]').click();
        await departClassicForest(page);
        assert.equal(await page.locator('.forest-field .field-cell').count(),49);
        assert.equal(await page.locator('.forest-field button.field-cell.wall').count(),0,
          'all forest walls must be physically impassable, not invisible tappable passageways');
        assert.equal(await page.locator('.forest-field .field-cell.glade.veiled').count(),1,
          'far glade must be obscured when the expedition begins');
        for(const id of [21,22,23,24,33,34,41])await step(id);
        assert.equal(await page.locator('.forest-field .field-cell.glade.revealed').count(),1);
        await page.screenshot({path:path.join(output,'forest-distant-glade-approach-'+width+'.png')});
        await step(48); // long eastward detour past the furthest clearing
        await step(41);await step(40); // the hidden stone-ring glade is inset from the camera edge
        const found=await page.evaluate(()=>JSON.parse(localStorage.getItem('crownless-expedition-v1-demo')));
        assert.equal(found.expedition.field.pos,40);
        assert.equal(found.expedition.field.glade,true);
        assert.equal(found.expedition.scrap,4);
        await page.screenshot({path:path.join(output,'forest-distant-glade-found-'+width+'.png')});
        await page.reload();
        assert.equal(await page.locator('.forest-field[data-field-glade="true"][data-field-pos="40"]').count(),1);
        await step(41);await step(40);
        const twice=await page.evaluate(()=>JSON.parse(localStorage.getItem('crownless-expedition-v1-demo')));
        assert.equal(twice.expedition.scrap,4,'saved distant discoveries cannot pay out twice');
      }finally{await ctx.close();}
    }

    // The new discovery is a two-stage noncombat surprise, not a new fight or
    // glowing waypoint. It is played using real smartphone movement taps.
    for(const width of [360,390]){
      const context=await browser.newContext({viewport:{width,height:width===360?800:844},isMobile:true,hasTouch:true});
      const page=await context.newPage();
      const errors=[];page.on('pageerror',e=>errors.push(e.message));
      const step=async id=>page.locator('.forest-field [data-action="field-step"][data-value="'+id+'"]').click();
      const saved=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('crownless-expedition-v1-demo')));
      try{
        await page.goto(url);
        await page.locator('[data-action="mode"][data-value="demo"]').click();
        await departClassicForest(page);
        assert.equal(await page.locator('.forest-field[data-field-fox="false"][data-field-fox-cache="false"]').count(),1);
        assert.equal(await page.locator('.field-cell.fox.veiled').count(),1,'fox starts off-camera under fog');
        await step(15);
        await step(10);
        const clue=await saved();
        assert.match(clue.expedition.log[0],/茂み.*揺れた/);
        assert.equal(clue.expedition.field.fox,false,'sighting clue alone must not trigger reward');
        assert.equal(await page.locator('.field-cell.fox.revealed').count(),1);
        assert.equal(await page.locator('.field-cell.fox-nest.veiled').count(),1,'fox destination is still a mystery');
        await page.waitForTimeout(460);
        await page.screenshot({path:path.join(output,'forest-fox-rustle-'+width+'.png')});
        await step(5);
        const sighting=await saved();
        assert.equal(sighting.expedition.stage,'path','fox appearance never forces wolf combat');
        assert.equal(sighting.expedition.field.fox,true);
        assert.equal(sighting.expedition.field.foxCache,false);
        assert.match(sighting.expedition.log[0],/白い狐/);
        assert.equal(await page.locator('.forest-field[data-field-fox="true"][data-field-fox-cache="false"]').count(),1);
        await page.waitForTimeout(460);
        await page.screenshot({path:path.join(output,'forest-fox-fled-'+width+'.png')});
        await page.reload();
        assert.equal(await page.locator('.forest-field[data-field-fox="true"][data-field-fox-cache="false"]').count(),1,
          'fox already chased away stays gone across reload');
        await step(0);
        const reward=await saved();
        assert.equal(reward.expedition.stage,'path');
        assert.equal(reward.expedition.field.foxCache,true);
        assert.equal(reward.expedition.scrap,3);
        assert.equal(reward.expedition.potions,3);
        assert.match(await page.locator('.field-moment').innerText(),/革袋を発見/);
        await page.screenshot({path:path.join(output,'forest-fox-pouch-'+width+'.png')});
        await step(5);await step(0);
        const again=await saved();
        assert.equal(again.expedition.scrap,3,'fox payout must be once per expedition');
        await page.locator('.field-choices [data-action="return"]').click();
        const banked=await saved();
        assert.equal(banked.scrap,3,'noncombat discovery must bring real loot back');
        assert.deepEqual(errors,[],'fox trail must not trigger mobile JS errors');
      }finally{await context.close();}
    }

    // The first non-forest freely walkable map: a real stone tower, not the
    // former selection menu. Run through discovery, guardian, ascent and return.
    for(const width of [360,390]){
      const ctx=await browser.newContext({viewport:{width,height:width===360?800:844},isMobile:true,hasTouch:true});
      const page=await ctx.newPage(), errors=[];
      page.on('pageerror',e=>errors.push(e.message));
      const step=async id=>page.locator('.tower-field [data-action="tower-step"][data-value="'+id+'"]').click();
      const saved=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('crownless-expedition-v1-demo')));
      try{
        await page.goto(url);
        await page.locator('[data-action="mode"][data-value="demo"]').click();
        await page.locator('[data-action="nearby-view"][data-value="scout"]').click();
        await page.locator('[data-action="scout"][data-value="tower"]').click();
        await page.locator('.nearby-track-tile[data-value="0,1"]').click();
        await page.locator('.district-detail [data-action="depart"][data-value="tower"]').click();
        assert.equal(await page.locator('.tower-field.world-painted').count(),1,'tower is a real painted terrain view');
        assert.equal(await page.locator('.tower-field .field-cell').count(),25);
        assert.equal(await page.locator('.tower-field .wall button').count(),0);
        assert.equal(await page.locator('.tower-field .field-cell.secret.walk-nav').count(),0);
        assert.equal(await page.locator('.tower-field .field-cell.relic.veiled').count(),1,'sealed reliquary starts hidden');
        assert(await page.locator('.tower-field .walk-nav').count()>=1,'regular stone pathways keep subtle guidance');
        await page.screenshot({path:path.join(output,'tower-stone-entry-'+width+'.png')});
        for(const id of [21,22,17])await step(id);
        let s=await saved();
        assert.equal(s.expedition.tower.echo,true);
        assert.match(s.expedition.log[0],/鐘の欠片/);
        assert.equal(await page.locator('.tower-field .field-cell.secret.walk-nav').count(),0);
        await page.screenshot({path:path.join(output,'tower-bell-clue-'+width+'.png')});
        assert.equal(await page.locator('.tower-field [data-action="tower-step"][data-value="12"]').count(),0,
          'undiscovered stair must not be clickable in the fog');
        await page.locator('.field-choices [data-action="tower-step"][data-value="12"]').click();
        s=await saved();
        assert.equal(s.expedition.tower.pos,17,'investigating opens a real barrier but does not move');
        assert.equal(s.expedition.tower.open,true);
        assert.equal(await page.locator('.tower-field .field-cell.secret.walk-nav').count(),0,
          'opened hidden staircase stays unsignposted');
        await page.screenshot({path:path.join(output,'tower-hidden-stair-'+width+'.png')});
        await step(12);await step(7);
        s=await saved();
        assert.equal(s.expedition.tower.relic,true);
        assert.equal(s.expedition.materials.watchIron,1);
        assert.equal(s.expedition.scrap,4);
        await page.screenshot({path:path.join(output,'tower-found-reliquary-'+width+'.png')});
        await page.reload();
        assert.equal(await page.locator('.tower-field[data-tower-relic="true"]').count(),1);
        for(const id of [12,17,18,19]){
          await step(id);
          if(id===18){
            const carriedReturn=page.locator('.field-choices [data-action="return"]');
            assert.match(await carriedReturn.innerText(),/鐘鉄を持って生還/,
              'carried bell iron must remain visible after leaving the reliquary');
            const rect=await carriedReturn.boundingBox();
            assert(rect && rect.x>=-1 && rect.x+rect.width<=width+1 &&
              rect.y>=-1 && rect.y+rect.height<=(width===360?800:844)+2,
              'carried-loot return choice must remain in the phone viewport');
            await page.screenshot({path:path.join(output,'tower-carried-return-'+width+'.png')});
            // The optional cache is a one-shot tradeoff: a redundant focus
            // action must be disabled, while the iron path stays available.
            await step(13);
            const focusChoice=page.locator('.field-choices [data-action="tower-cache-focus"]');
            assert.equal(await focusChoice.isEnabled(),true,
              'a fresh cache offers preparation when focus is low');
            await page.evaluate(()=>{
              const k='crownless-expedition-v1-demo',s=JSON.parse(localStorage.getItem(k));
              s.expedition.focus=3;localStorage.setItem(k,JSON.stringify(s));
            });
            await page.reload();
            assert.equal(await focusChoice.isDisabled(),true,
              'a redundant one-shot focus choice must not consume the cache');
            assert.match(await focusChoice.innerText(),/集中は既に十分/);
            assert.equal(await page.locator('.field-choices [data-action="tower-cache-iron"]').isEnabled(),true,
              'bell iron remains the available choice');
            const focusRect=await focusChoice.boundingBox();
            assert(focusRect&&focusRect.x>=-1&&focusRect.x+focusRect.width<=width+1&&
              focusRect.y>=-1&&focusRect.y+focusRect.height<=(width===360?800:844)+2,
              'disabled cache choice stays readable on the phone');
            await page.screenshot({path:path.join(output,'tower-cache-full-focus-'+width+'.png')});
            await page.evaluate(()=>{
              const k='crownless-expedition-v1-demo',s=JSON.parse(localStorage.getItem(k));
              s.expedition.focus=0;localStorage.setItem(k,JSON.stringify(s));
            });
            await page.reload();
            await step(18);
          }
        }
        assert.match((await saved()).expedition.log[0],/金属が石をこする音/);
        const listen=page.locator('.field-choices [data-action="tower-listen"]');
        assert.equal(await listen.count(),1,'listening is an optional investigation');
        const listenRect=await listen.evaluate(el=>{
          const r=el.getBoundingClientRect();
          return {left:r.left,right:r.right,top:r.top,bottom:r.bottom};
        });
        assert(listenRect.left>=-1 && listenRect.right<=width+1 &&
          listenRect.top>=-1 && listenRect.bottom<=(width===360?800:844)+2,
          'listen action must be tappable in the phone viewport: '+JSON.stringify(listenRect));
        await listen.click();
        s=await saved();
        assert.equal(s.expedition.tower.pos,19,'listening does not move the traveler');
        assert.equal(s.expedition.stage,'path','listening does not start combat');
        assert.equal(s.expedition.tower.listened,true,'tactical clue is earned once');
        assert.match(s.expedition.log[0],/盾を据える音/);
        assert.equal(await listen.count(),0,'listen button disappears after investigating');
        await page.reload();
        assert.equal(await page.locator('.field-choices [data-action="tower-listen"]').count(),0,
          'investigated clue stays completed after reload');
        assert.equal((await saved()).expedition.tower.listened,true);
        await page.screenshot({path:path.join(output,'tower-listening-choice-'+width+'.png')});
        await step(14);
        assert.match((await saved()).expedition.log[0],/鎧が石床を打つ足音/,
          'guardian warning should be legible before choosing combat on a phone');
        assert.match((await saved()).expedition.log[0],/初手は強撃が効きそうだ/,
          'previously discovered shield clue must be recalled at the choice');
        assert.match(await page.locator('.field-moment').innerText(),/初手は強撃/,
          'phone UI must actually show the earned clue, not just save it');
        const retreat=page.locator('.field-choices [data-action="return"]');
        assert.match(await retreat.innerText(),/鐘鉄を守って生還/,
          'carried loot makes the guardian retreat choice explicit');
        const retreatRect=await retreat.evaluate(el=>{
          const r=el.getBoundingClientRect();
          return {left:r.left,right:r.right,top:r.top,bottom:r.bottom};
        });
        assert(retreatRect.left>=-1 && retreatRect.right<=width+1 &&
          retreatRect.top>=-1 && retreatRect.bottom<=(width===360?800:844)+2,
          'guardian retreat must remain tappable in the phone viewport: '+JSON.stringify(retreatRect));
        const guardianTile=page.locator('.tower-field [data-action="tower-step"][data-value="9"]');
        assert.equal(await guardianTile.count(),1,'guardian remains a real adjacent tap target');
        assert.equal(await guardianTile.evaluate(el=>el.classList.contains('guardian-threat')),true,
          'uncleared guardian is marked as a dangerous choice');
        assert.equal(await guardianTile.evaluate(el=>el.classList.contains('guardian-clue-earned')),true,
          'the listened shield clue adds a persistent visual cue on the guardian tile');
        assert.match(await guardianTile.getAttribute('aria-label'),/盾を据える音を聞き取った番人/,
          'the earned visual cue must also be accessible on a phone');
        assert.match(await guardianTile.evaluate(el=>getComputedStyle(el,'::after').boxShadow),/3px/,
          'the earned shield clue must render as a distinct outline');
        assert.equal(await guardianTile.evaluate(el=>el.classList.contains('walk-nav')),false,
          'the guardian must not use an ordinary safe-path waypoint');
        const dangerMark=await guardianTile.evaluate(el=>{
          const marker=getComputedStyle(el,'::after');
          const r=el.getBoundingClientRect();
          return {content:marker.content,width:parseFloat(marker.width),height:parseFloat(marker.height),
            left:r.left,right:r.right,top:r.top,bottom:r.bottom};
        });
        assert(dangerMark.content.includes('!')&&dangerMark.width>=24&&dangerMark.height>=24,
          'the danger mark must actually render at phone size: '+JSON.stringify(dangerMark));
        assert(dangerMark.left>=-1&&dangerMark.right<=width+1&&dangerMark.top>=-1&&
          dangerMark.bottom<=(width===360?800:844)+2,
          'the guardian tap area must remain in the viewport: '+JSON.stringify(dangerMark));
        await page.screenshot({path:path.join(output,'tower-guardian-choice-'+width+'.png')});
        await step(9);
        s=await saved();
        assert.equal(s.expedition.stage,'fight');
        assert.equal(s.expedition.enemy.kind,'knight');
        assert.match(await page.locator('.intent').innerText(),/耳に残る盾の音。初手は強撃が効きそうだ。/,
          'earned clue must be visible at the first actual attack choice on a phone');
        await page.locator('[data-action="heavy"]').click();
        s=await saved();
        assert.match(s.expedition.log.join(' '),/耳で覚えた盾の音に合わせて強撃/,
          'earned clue must react to the first actual player attack');
        const clueResult=page.locator('.combat-clue-outcome');
        assert.equal(await clueResult.count(),1,'earned result is surfaced outside collapsed combat logs');
        assert.match(await clueResult.innerText(),/耳で覚えた盾の音に合わせて強撃/);
        const clueRect=await clueResult.evaluate(el=>{
          const r=el.getBoundingClientRect();
          return {left:r.left,right:r.right,top:r.top,bottom:r.bottom};
        });
        assert(clueRect.left>=-1&&clueRect.right<=width+1&&clueRect.top>=-1&&
          clueRect.bottom<=(width===360?800:844)+2,
          'earned attack feedback stays in the phone viewport: '+JSON.stringify(clueRect));
        await page.screenshot({path:path.join(output,'tower-guardian-clue-outcome-'+width+'.png')});
        await page.evaluate(()=>{
          const k='crownless-expedition-v1-demo',s=JSON.parse(localStorage.getItem(k));
          s.expedition.enemy.hp=1;localStorage.setItem(k,JSON.stringify(s));
        });
        await page.reload();
        await page.locator('[data-action="auto-fight"]').click();
        s=await saved();
        assert.equal(s.expedition.stage,'path','guardian win must return to the tower view');
        assert.equal(s.expedition.tower.guard,true);
        assert.equal(await page.locator('.tower-field.world-painted').count(),1);
        await step(4);
        s=await saved();
        assert.equal(s.expedition.room,1,'tower connects to existing upper-level route');
        assert.equal(await page.locator('.tower-field').count(),0);
        await page.locator('[data-action="return"]').click();
        s=await saved();
        assert.equal(s.expedition,null);
        assert.equal(s.materials.watchIron,2,'hidden reliquary and knight both give forge material');
        assert.deepEqual(errors,[],'stone exploration generated no browser errors');
        await page.screenshot({path:path.join(output,'tower-return-'+width+'.png')});
      }finally{await ctx.close();}
    }

    // Walkable non-forest wetland: tangible water, sound clue, intentional risk,
    // hidden materials and a single optional wraith fight. Real phone taps.
    for(const width of [360,390]){
      const ctx=await browser.newContext({viewport:{width,height:width===360?800:844},isMobile:true,hasTouch:true});
      const page=await ctx.newPage(),errors=[];
      page.on('pageerror',e=>errors.push(e.message));
      const step=async id=>page.locator('.fen-field [data-action="fen-step"][data-value="'+id+'"]').click();
      const saved=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('crownless-expedition-v1-demo')));
      try{
        await page.goto(url);
        await page.locator('[data-action="mode"][data-value="demo"]').click();
        await page.locator('[data-action="nearby-view"][data-value="scout"]').click();
        await page.locator('[data-action="scout"][data-value="fen"]').click();
        await page.locator('.nearby-track-tile[data-value="1,0"]').click();
        await page.locator('.district-detail [data-action="depart"][data-value="fen"]').click();
        assert.equal(await page.locator('.fen-field.world-painted').count(),1,'marsh is genuine painted walkable terrain');
        assert.equal(await page.locator('.fen-field .field-cell').count(),25);
        assert.equal(await page.locator('.fen-field .field-cell.water button').count(),0,'deep water is not a tap target');
        assert.equal(await page.locator('.fen-field .field-cell.shoal.walk-nav').count(),0,'hidden shoal never advertises itself');
        assert(await page.locator('.fen-field .walk-nav').count()>=1);
        await page.screenshot({path:path.join(output,'fen-entry-'+width+'.png')});
        // Android Canvas stability: after the brief step animation, unchanged
        // terrain must stop repainting. Constant full-canvas redraw flickers
        // on mobile even if ordinary snapshots look fine.
        const fenFingerprint=()=>page.locator('.fen-field canvas.forest-world-canvas').evaluate(canvas=>{
          const ctx=canvas.getContext('2d');
          const bytes=ctx.getImageData(0,0,canvas.width,canvas.height).data;
          let hash=2166136261;
          for(let i=0;i<bytes.length;i+=37){
            hash=Math.imul(hash^bytes[i],16777619)>>>0;
          }
          const transform=canvas.parentElement.style.transform;
          return {hash,transform};
        });
        await page.waitForTimeout(600);
        const stableA=await fenFingerprint();
        await page.waitForTimeout(320);
        const stableB=await fenFingerprint();
        assert.deepEqual(stableB,stableA,
          'marsh Canvas and camera should remain pixel-stable at rest, without flashing');
        for(const id of [21,16,17])await step(id);
        let s=await saved();
        assert.equal(s.expedition.fen.sound,true);
        assert.match(s.expedition.log[0],/水の下から/);
        assert.equal(await page.locator('.fen-field .field-cell.shoal.walk-nav').count(),0);
        await page.screenshot({path:path.join(output,'fen-reed-sound-'+width+'.png')});
        await step(12);
        s=await saved();
        assert.equal(s.expedition.fen.pos,17,'first tap opens hidden shoal without teleporting');
        assert.equal(s.expedition.fen.shoal,true);
        assert.equal(await page.locator('.fen-field .field-cell.shoal.walk-nav').count(),0);
        await page.screenshot({path:path.join(output,'fen-shoal-open-'+width+'.png')});
        await step(12);await step(7);
        s=await saved();
        assert.equal(s.expedition.hp,27);
        assert.equal(s.expedition.fen.star,true);
        assert.equal(s.expedition.materials.marshFiber,1);
        assert.equal(s.expedition.scrap,4);
        await page.screenshot({path:path.join(output,'fen-star-found-'+width+'.png')});
        await page.reload();
        assert.equal(await page.locator('.fen-field[data-fen-star="true"]').count(),1);
        for(const id of [12,17,18,13])await step(id);
        const wraithGate=page.locator('.fen-field [data-action="fen-step"][data-value="8"]');
        assert.equal(await wraithGate.count(),1,'wraith remains an adjacent tappable risk');
        assert.equal(await wraithGate.evaluate(el=>el.classList.contains('walk-nav')),false,
          'an undefeated wraith must not be marked as a safe walking waypoint');
        assert.equal(await wraithGate.evaluate(el=>el.classList.contains('fen-wraith-threat')),true,
          'an adjacent living wraith gets a danger marker, not a safe waypoint');
        const threatVisual=await wraithGate.evaluate(el=>({
          content:getComputedStyle(el,'::after').content,
          pointerEvents:getComputedStyle(el,'::after').pointerEvents,
          width:el.getBoundingClientRect().width,
          label:el.getAttribute('aria-label')
        }));
        assert(threatVisual.content.includes('!'),'risk marker must actually render');
        assert.equal(threatVisual.pointerEvents,'none','marker must not block tapping');
        assert(threatVisual.width>=25,'danger tile retains a usable tap area');
        assert.match(threatVisual.label,/戦闘の危険/);
        await page.screenshot({path:path.join(output,'fen-wraith-risk-no-waypoint-'+width+'.png')});
        await wraithGate.click();
        s=await saved();
        assert.equal(s.expedition.stage,'path','first tap scouts the wraith from safety');
        assert.equal(s.expedition.fen.pos,13,'scouting does not move');
        assert.equal(s.expedition.fen.scouted,true);
        assert.equal(await page.locator('.fen-field[data-fen-scouted="true"]').count(),1);
        assert.match(await page.locator('.fen-field .forest-field-footer').innerText(),/戦うか帰るか/);
        await page.screenshot({path:path.join(output,'fen-wraith-scouted-choice-'+width+'.png')});
        await page.reload();
        assert.equal((await saved()).expedition.fen.scouted,true,'save/reload preserves scouting');
        await wraithGate.click();
        s=await saved();
        assert.equal(s.expedition.stage,'fight');
        assert.equal(s.expedition.enemy.kind,'wraith');
        assert.match(await page.locator('.combat-situation .intent small').innerText(),/水面で読んだ薙ぎ払い/,
          'only scouting earns the opening parry clue on the actual combat screen');
        await page.locator('[data-action="guard"]').click();
        assert.match(await page.locator('.combat-clue-outcome').innerText(),/薙ぎ払いを受け流した/,
          'successful parry feedback is visible outside collapsed phone combat logs');
        await page.screenshot({path:path.join(output,'fen-wraith-parry-outcome-'+width+'.png')});
        await page.evaluate(()=>{
          const k='crownless-expedition-v1-demo',s=JSON.parse(localStorage.getItem(k));
          s.expedition.enemy.hp=1;localStorage.setItem(k,JSON.stringify(s));
        });
        await page.reload();
        await page.locator('[data-action="auto-fight"]').click();
        s=await saved();
        assert.equal(s.expedition.stage,'path','wraith battle returns to wetland');
        assert.equal(s.expedition.fen.wraith,true);
        assert.equal(await page.locator('.fen-field.world-painted').count(),1);
        await step(13);
        assert.equal(await page.locator('.fen-field .field-cell.wraith.walk-nav').count(),1,
          'defeated wraith tile is an ordinary traversable neighbor');
        assert.equal(await page.locator('.fen-field .fen-wraith-threat').count(),0,
          'danger mark disappears once the wraith is defeated');
        for(const id of [18,23,24])await step(id);
        s=await saved();
        assert.equal(s.expedition,null);
        assert(s.materials.marshFiber>=2,'star and wraith both return crafting material');
        assert.deepEqual(errors,[],'marsh must not generate browser JS errors');
        await page.screenshot({path:path.join(output,'fen-return-'+width+'.png')});
      }finally{await ctx.close();}
    }

    // Cross-region progression: a forest-trained traveler can physically uncover
    // a new fen path, cross it safely and bring the bow design back alive.
    // Use an already-earned skill in a valid demo save; all steps are real taps.
    for(const width of [360,390]){
      const ctx=await browser.newContext({viewport:{width,height:width===360?800:844},isMobile:true,hasTouch:true});
      const page=await ctx.newPage(),errors=[];
      page.on('pageerror',e=>errors.push(e.message));
      const step=async id=>page.locator('.fen-field [data-action="fen-step"][data-value="'+id+'"]').click();
      const saved=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('crownless-expedition-v1-demo')));
      try{
        await page.goto(url);
        await page.locator('[data-action="mode"][data-value="demo"]').click();
        await page.evaluate(()=>{
          const k='crownless-expedition-v1-demo',s=JSON.parse(localStorage.getItem(k));
          s.characters[0].skills.trailReading=true;localStorage.setItem(k,JSON.stringify(s));
        });
        await page.reload();
        await page.locator('[data-action="nearby-view"][data-value="scout"]').click();
        await page.locator('[data-action="scout"][data-value="fen"]').click();
        await page.locator('.nearby-track-tile[data-value="1,0"]').click();
        await page.locator('.district-detail [data-action="depart"][data-value="fen"]').click();
        assert.equal(await page.locator('.fen-field.world-painted').count(),1);
        assert.equal(await page.locator('.fen-field[data-fen-reader="true"]').count(),1);
        for(const id of [21,16,11])await step(id);
        assert.equal(await page.locator('.fen-field .field-cell.causeway.walk-nav').count(),0);
        assert.equal(await page.locator('.fen-field [data-action="fen-step"][data-value="6"]').count(),1,
          'trained reader gets an investigation target on old deep water');
        await page.screenshot({path:path.join(output,'fen-reader-track-'+width+'.png')});
        // Use the learned skill as an actual thumb action, rather than
        // requiring the player to guess an invisible deep-water tap target.
        assert.equal(await page.locator('[data-action="skill-trail-read"]').count(),1,
          'a learned skill must have an explicit usable button');
        await page.locator('[data-action="skill-trail-read"]').click();
        assert.match(await page.locator('.field-moment').innerText(),/獣道読み/);
        assert.equal(await page.locator('.field-moment.skill-result').count(),1);
        let s=await saved();
        assert.equal(s.expedition.fen.pos,11,'investigation only reveals the route');
        assert.equal(s.expedition.fen.trail,true);
        assert.equal(await page.locator('.fen-field .field-cell.causeway.walk-nav').count(),0,
          'hidden causeway remains without navigation hints');
        await page.screenshot({path:path.join(output,'fen-reader-causeway-'+width+'.png')});
        await step(6);await step(7);
        s=await saved();
        assert.equal(s.expedition.hp,30,'skilled route is genuinely safe');
        assert.equal(s.expedition.fen.pos,7,'walked onto the altar by adjacency');
        assert.equal(s.expedition.foundDesign,'bow_hunter');
        assert.equal(s.designs.bow_hunter,undefined,'find is not yet a permanent recipe');
        await page.reload();
        assert.equal(await page.locator('.fen-field.world-painted').count(),1,'new route reloads in place');
        await page.screenshot({path:path.join(output,'fen-reader-altar-'+width+'.png')});
        await page.locator('[data-action="return"]').click();
        s=await saved();
        assert.equal(s.designs.bow_hunter,'fen');
        assert.match(await page.locator('#game').innerText(),/新しい製作レシピを解放：灰羽の長弓/);
        await page.screenshot({path:path.join(output,'fen-reader-return-'+width+'.png')});
        assert.deepEqual(errors,[],'trained route must not cause mobile JS errors');
      }finally{await ctx.close();}
    }

    // An earned skill must be immediately visible after return, rather than
    // buried beneath the scrap ledger. Exercise real phone taps at both widths.
    for(const width of [360,390]){
      const ctx=await browser.newContext({viewport:{width,height:width===360?800:844},isMobile:true,hasTouch:true});
      const page=await ctx.newPage(),errors=[];
      page.on('pageerror',e=>errors.push(e.message));
      try{
        await page.goto(url);
        await page.locator('[data-action="mode"][data-value="demo"]').click();
        await departClassicForest(page);
        for(const id of [21,22,23,18]){
          await page.locator('.forest-field [data-action="field-step"][data-value="'+id+'"]').click();
        }
        assert.equal(await page.locator('.skill-learning-hint').count(),1,
          'first-time track discovery promises the earned knowledge before the return');
        assert.match(await page.locator('.skill-learning-hint').innerText(),/無事に生還すると習得/);
        await page.screenshot({path:path.join(output,'skill-learning-pending-'+width+'.png')});
        await page.locator('.field-choices [data-action="return"]').click();
        const s=await page.evaluate(()=>JSON.parse(localStorage.getItem('crownless-expedition-v1-demo')));
        assert.equal(s.characters[0].skills.trailReading,true);
        assert.equal(s.report.newSkill,'trailReading');
        assert.equal(await page.locator('.report-scroll > .skill-unlock-spotlight:first-child').count(),1);
        assert.match(await page.locator('.skill-unlock-spotlight').innerText(),/《獣道読み》を習得/);
        const card=await page.locator('.skill-unlock-spotlight').boundingBox();
        assert(card&&card.y<((width===360)?800:844),'skill card must be near the first screen');
        assert(card&&card.y+card.height<=((width===360)?800:844)+3,
          'skill reward must fit inside the phone view rather than requiring scrolling');
        await page.screenshot({path:path.join(output,'skill-unlocked-'+width+'.png')});
        await page.reload();
        assert.equal(await page.locator('.skill-unlock-spotlight').count(),1,
          'reload never suppresses a previously banked unlock report');
        await page.locator('[data-action="continue"]').click();
        assert.match(await page.locator('.character-status-panel').innerText(),/獣道読み/);
        assert.match(await page.locator('.character-status-panel').innerText(),/習得済み/);
        assert.deepEqual(errors,[],'acquisition animation and status navigation cannot throw JS errors');
      }finally{await ctx.close();}
    }

    // Corrupt game saves must not be silently overwritten during rendering.
    const context = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const page = await context.newPage();
    try {
      await page.addInitScript(() => {
        localStorage.setItem("crownless-expedition-mode", "demo");
        localStorage.setItem("crownless-expedition-v1-demo", "{broken-save");
      });
      await page.goto(url);
      assert.match(await page.locator("#game").innerText(), /セーブを読み込めません/);
      assert.equal(await page.evaluate(() => localStorage.getItem("crownless-expedition-v1-demo")), "{broken-save");
    } finally {
      await context.close();
    }
    console.log("[browser-smoke] PASS: 390x844, 360x800, discovery → siege → reload, corrupt save");
    console.log("[browser-smoke] screenshots: .qa/browser/");
  } finally {
    if (browser) await browser.close();
    server.kill();
  }
}

main().catch(error => { console.error("[browser-smoke]", error); process.exitCode = 1; });
