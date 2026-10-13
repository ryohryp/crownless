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
        assert((await page.locator('.nearby-track-road').count())>=2,'known lands are linked by rendered paths');
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
        await page.locator('.district-detail [data-action="depart"][data-value="wood"]').click();
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
        for(const pos of [22,23,18,13,8]){
          await page.locator('.forest-field [data-action="field-step"][data-value="'+pos+'"]').click();
        }
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
          assert.equal(await page.locator('.nearby-tile[data-poi-family="event"] .district-pixel-art').count(), 1);
          await page.locator('[data-action="nearby-view"][data-value="scout"]').click();
          await page.locator('[data-action="scout"][data-value="tower"]').click();
          await page.locator('[data-action="nearby-view"][data-value="scout"]').click();
          await page.locator('[data-action="scout"][data-value="tower"]').click();
          assert(await page.locator('.nearby-tile[data-poi-family="shop"] .district-pixel-art').count() >= 1);
          assert(await page.locator('.nearby-tile[data-poi-family="event"] .district-pixel-art').count() >= 1);
          await page.screenshot({ path: path.join(output, "hybrid-discovery-390.png") });
          await page.locator('.nearby-tile[data-poi-family="shop"]').last().click();
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
        await page.locator('.nearby-card-actions [data-action="depart"][data-value="wood"]').click();
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
    let forgedSaved=null;
    const poiContext = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
    const poiPage = await poiContext.newPage();
    try {
      await poiPage.goto(url);
      await poiPage.locator('[data-action="mode"][data-value="demo"]').click();
      // Earn the other region's required material in an actual forest combat.
      await poiPage.locator('.district-detail [data-action="depart"][data-value="wood"]').click();
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
      await poiPage.locator('.nearby-tile[data-value="0,1"]').click();
      await poiPage.locator('[data-action="nearby-view"][data-value="detail"]').click();
      await poiPage.screenshot({ path: path.join(output, "poi-clue-390.png") });
      await poiPage.locator('[data-action="poi"][data-value="clue"]').click();
      const fight=await poiPage.evaluate(() => JSON.parse(localStorage.getItem("crownless-expedition-v1-demo")));
      assert.equal(fight.expedition.enemy.clue,true);
      assert.equal(fight.expedition.stage,"fight");
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
      await poiPage.locator('.path-actions [data-action="return"]').click();
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
      await poiPage.locator('.nearby-tile[data-value="-1,0"]').click();
      await poiPage.locator('.district-detail [data-action="depart"][data-value="wood"]').click();
      await walkForestToWolf(poiPage);
      assert.equal(await poiPage.locator('.combat-manual').getAttribute('open'),'','four choices should appear by default');
      assert.match(await poiPage.locator('.combat-manual').innerText(),/反撃/,'new shield changes the available guard decision');
      await poiPage.screenshot({path:path.join(output,'crafted-shield-combat-390.png')});
    } finally {
      await poiContext.close();
    }

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
      await bellPage.locator('.nearby-tile[data-value="0,2"]').click();
      assert.equal(await bellPage.locator('.restored-bell-notice').count(),0,'the neighboring tower shop did not change');
      await bellPage.locator('.nearby-tile[data-value="0,1"]').click();
      assert.equal(await bellPage.locator('.nearby-tile.restored-bell').count(),1,'exact source tower is visibly changed');
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
        const defaultDepart=rolePage.locator('.district-detail [data-action="depart"][data-value="wood"]');
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
        const readyDepart=rolePage.locator('.district-detail [data-action="depart-as-adventurer"][data-value="wood"]');
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
        await page.locator('.district-detail [data-action="depart"][data-value="wood"]').click();
        const fog=await page.locator('.field-cell.veiled').count();
        await page.locator('.field-cell[data-value="21"]').click();
        assert((await page.locator('.field-cell.veiled').count())<fog,
          'the fog clears as the traveler chooses a new step');
        await page.locator('.field-cell[data-value="16"]').click();
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
        await page.locator('.district-detail [data-action="depart"][data-value="wood"]').click();
        assert.equal(await page.locator('.forest-field[data-wolf-state="hidden"]').count(),1,
          'wolf must not appear through an unexplored fog-of-war region');
        assert.equal(await page.locator('.forest-wolf-warning').count(),0);
        for(const id of [21,22,23,18,13]){
          await page.locator('.forest-field [data-action="field-step"][data-value="'+id+'"]').click();
        }
        assert.equal(await page.locator('.forest-field[data-wolf-state="alert"]').count(),1,
          'the wolf must become visible and alert when adjacent');
        const warning=page.locator('.forest-wolf-warning');
        assert.match(await warning.innerText(),/狼に気づかれた/);
        assert.equal(await warning.isVisible(),true,'not just a hidden accessibility state');
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
          await escape.locator('.district-detail [data-action="depart"][data-value="wood"]').click();
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
        await page.locator('.district-detail [data-action="depart"][data-value="wood"]').click();
        assert.equal(await page.locator('.forest-field[data-field-secret="false"][data-field-shrine="false"]').count(),1);
        assert.equal(await page.locator('.field-cell[data-value="12"]').count(),0,'hidden path must not be a reachable teleport from the entrance');
        await step(21);await step(16); // Collecting old iron shards costs three HP.
        await step(17); // The existing real treasure chest.
        const found=await saved();
        assert.equal(found.expedition.scrap,10);
        assert.equal(found.expedition.materials.wolfFang,1);
        assert.equal(found.expedition.hp,27);
        assert.equal(found.expedition.field.secret,false);
        assert.equal(found.expedition.field.shrine,false);
        const vines=page.locator('.forest-field button.field-cell.secret[data-value="12"]');
        assert.equal(await vines.count(),1,'tangled vines are a real adjacent tap target');
        assert.equal(await vines.evaluate(el=>getComputedStyle(el).backgroundImage),'none',
          'the secret-vine destination must not be given away by a glowing navigation circle');
        assert.equal(await vines.evaluate(el=>el.classList.contains('walk-nav')),false,
          'closed secret vines have no walking waypoint even though they can be inspected');
        assert((await page.locator('.forest-field .walk-nav').count())>=2,
          'regular walkable neighbors still have navigation near the hidden passage');
        assert.match(await vines.getAttribute('aria-label'),/揺れるツタを調べる/);
        const tap=await vines.evaluate(el=>{
          const b=el.getBoundingClientRect();
          const hit=document.elementFromPoint(b.left+b.width/2,b.top+b.height/2);
          return {height:b.height,hit:hit===el||el.contains(hit)};
        });
        assert(tap.hit&&tap.height>=44,'vines must be physically tappable on small phones');
        await page.screenshot({path:path.join(output,'forest-secret-vines-'+width+'.png')});
        await vines.click(); // First touch uncovers the real barrier but does NOT teleport through it.
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
        await page.locator('.district-detail [data-action="depart"][data-value="wood"]').click();
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
        await page.locator('.district-detail [data-action="depart"][data-value="wood"]').click();
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
        await page.locator('.nearby-tile[data-value="0,1"]').click();
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
        await step(12);
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
        for(const id of [12,17,18,19,14,9])await step(id);
        s=await saved();
        assert.equal(s.expedition.stage,'fight');
        assert.equal(s.expedition.enemy.kind,'knight');
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
        await page.locator('.nearby-tile[data-value="1,0"]').click();
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
        for(const id of [12,17,18,13,8])await step(id);
        s=await saved();
        assert.equal(s.expedition.stage,'fight');
        assert.equal(s.expedition.enemy.kind,'wraith');
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
        for(const id of [13,18,23,24])await step(id);
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
        await page.locator('.nearby-tile[data-value="1,0"]').click();
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
        await page.locator('.district-detail [data-action="depart"][data-value="wood"]').click();
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
