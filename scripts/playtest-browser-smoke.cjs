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
        const layout = await page.evaluate(() => {
          const rect = selector => {
            const r = document.querySelector(selector).getBoundingClientRect();
            return {top:r.top,bottom:r.bottom,height:r.height,left:r.left,right:r.right};
          };
          const selectors=['.nearby-tile','.nearby-top-action','.nearby-card-actions button.primary','.nearby-card-actions button.secondary'];
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
        const world = page.locator('.expedition-world-scene');
        assert.equal(await world.count(), 1, 'exploration is a rendered world scene, not a standalone action sheet');
        assert.equal(await page.locator('.journey-scene-trail .journey-trail-stop').count(),5,
          'illustrated world shows five journey landmarks, not a duplicate HTML route');
        assert.equal(await page.locator('.expedition-world-scene .journey-traveler').count(),1,
          'the actual equipped traveler must appear on the road');
        const heroBox=await page.locator('.expedition-world-scene .journey-traveler').boundingBox();
        assert(heroBox && heroBox.x>width*.38 && heroBox.x+heroBox.width<width+5,
          'the hero must be visibly in the main landscape, not hidden beneath the left-aligned title: '+JSON.stringify(heroBox));
        assert.equal(await page.locator('.expedition-world-scene .journey-traveler-glow').count(),1,
          'the player silhouette must remain visually separated from the dark forest');
        assert.equal(await page.locator('.expedition-world-scene .journey-discovery').count(),1,
          'room zero has a different visual clue from the following rooms');
        const startingPosition = await page.locator('.journey-traveler').getAttribute('transform');
        const firstStep = page.locator('.path-actions button[data-action="careful"]');
        assert.equal(await firstStep.isVisible(), true, "advance-to-fight choice should be visible");
        const journeyFrame = await page.evaluate(()=>{
          const world=document.querySelector('.expedition-world-scene').getBoundingClientRect();
          const card=document.querySelector('.path-panel').getBoundingClientRect();
          const actions=[...document.querySelectorAll('.path-actions button:not(:disabled)')].map(el=>{
            const r=el.getBoundingClientRect(),point=document.elementFromPoint(r.left+r.width/2,r.top+r.height/2);
            return {action:el.dataset.action,top:r.top,bottom:r.bottom,hit:point===el||el.contains(point)};
          });
          return {worldHeight:world.height,worldBottom:world.bottom,cardTop:card.top,actions,viewport:innerHeight};
        });
        assert(journeyFrame.worldHeight >= height*.46,
          'a playable world landscape should dominate the phone before choices: '+JSON.stringify(journeyFrame));
        assert(journeyFrame.worldBottom<=journeyFrame.cardTop+2,
          'world canvas and decision surface never overlap: '+JSON.stringify(journeyFrame));
        assert(journeyFrame.actions.length>=2 && journeyFrame.actions.every(x=>x.hit&&x.top>=0&&x.bottom<=height+2),
          'every path action remains a real reachable thumb tap: '+JSON.stringify(journeyFrame));
        await page.screenshot({ path: path.join(output, "before-combat-" + width + ".png") });
        await firstStep.click();
        assert.equal(await page.locator(".battle-layout .combat-enemy-summary").count(), 1, "first encounter must render actual battle");
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
        assert.equal(await page.locator(".path-panel").count(), 1, "first battle must resolve to the next route scene");
        const afterFirstBattle = await page.evaluate(() => JSON.parse(localStorage.getItem("crownless-expedition-v1-demo")));
        assert.equal(afterFirstBattle.expedition?.room, 1);
        assert(afterFirstBattle.expedition?.materials.wolfFang >= 1);
        assert.equal(await page.locator('.expedition-world-scene[data-journey-room="1"]').count(),1,
          'battle result advances the world canvas to the actual new room');
        assert.equal(await page.locator('.journey-trail-stop.here').count(),1,
          'exactly one road milestone is active');
        assert.notEqual(await page.locator('.journey-traveler').getAttribute('transform'),startingPosition,
          'the character actually progresses across the art after the fight');
        await page.screenshot({path:path.join(output,'journey-after-first-fight-'+width+'.png')});
        await page.reload();
        assert.equal(await page.locator('.expedition-world-scene[data-journey-room="1"]').count(),1,
          'world illustration follows the saved route after reload');
        assert.equal(await page.locator(".expedition-layout:not(.battle-layout)").count(), 1, "the saved route must survive reload");
        const roadsideOption = page.locator('.path-actions button[data-action="pray"]');
        if (await roadsideOption.count()) await roadsideOption.click();
        else await page.locator('.path-actions button[data-action="rest"]').click();
        await page.locator('.path-actions button[data-action="careful"]').click();
        assert.equal(await page.locator(".battle-layout .combat-enemy-summary").count(), 1, "second encounter must also work");
        await page.locator('[data-action="auto-fight"]').click();
        assert.equal(await page.locator(".path-panel").count(), 1);
        await page.locator('.path-actions button[data-action="return"]').click();
        assert.equal(await page.locator(".report-layout").count(), 1, "banking route remains open");
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
        await page.locator('.path-actions [data-action="careful"]').click();
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
      await poiPage.locator('.path-actions [data-action="careful"]').click();
      await poiPage.locator('[data-action="auto-fight"]').click();
      await poiPage.locator('.path-actions [data-action="return"]').click();
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
      await poiPage.locator('.path-actions [data-action="careful"]').click();
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
      await bellPage.locator('.path-actions [data-action="careful"]').click();
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

    // Actual in-world exploration, not a decoration or a text-only action:
    // tap a mysterious object in the landscape, receive a real risk/reward,
    // then choose whether to leave alive with it. Both alternatives are
    // separately exercised at phone viewport sizes.
    for (const width of [360,390]) {
      const discoverContext=await browser.newContext({
        viewport:{width,height:width===360?800:844},isMobile:true,hasTouch:true
      });
      const discoverPage=await discoverContext.newPage();
      const errors=[];
      discoverPage.on('pageerror',e=>errors.push(e.message));
      try {
        await discoverPage.goto(url);
        await discoverPage.locator('[data-action="mode"][data-value="demo"]').click();
        await discoverPage.locator('.district-detail [data-action="depart"][data-value="wood"]').click();
        const findOne=discoverPage.locator('.expedition-world-scene [data-action="scout-cache"]');
        const findOther=discoverPage.locator('.expedition-world-scene [data-action="scout-tracks"]');
        assert.equal(await findOne.count(),1,'an actual root glint can be inspected');
        assert.equal(await findOther.count(),1,'a distinct track can be inspected');
        const hits=await discoverPage.evaluate(()=>{
          return ['scout-cache','scout-tracks'].map(action=>{
            const el=document.querySelector('.expedition-world-scene [data-action="'+action+'"]');
            const r=el.getBoundingClientRect();
            const hit=document.elementFromPoint(r.left+r.width/2,r.top+r.height/2);
            return {action,x:r.x,y:r.y,w:r.width,h:r.height,
              tappable:hit===el||el.contains(hit),inside:r.x>=0&&r.y>=0&&r.right<=innerWidth&&r.bottom<=innerHeight};
          });
        });
        assert(hits.every(x=>x.tappable&&x.inside&&x.h>=48),
          'both discovery objects must be real visible tap targets: '+JSON.stringify(hits));
        await discoverPage.screenshot({path:path.join(output,'discovery-unknown-'+width+'.png')});
        await findOne.click();
        assert.equal(await discoverPage.locator('.expedition-world-scene[data-discovery="cache"]').count(),1);
        const after=await discoverPage.evaluate(()=>JSON.parse(localStorage.getItem('crownless-expedition-v1-demo')));
        assert.equal(after.expedition.scrap,3);
        assert.equal(after.expedition.hp,27);
        assert.equal(await discoverPage.locator('.world-discovery-sites button').count(),0,
          'a first find is one-time, not a repeatable farming button');
        await discoverPage.screenshot({path:path.join(output,'discovery-found-'+width+'.png')});
        await discoverPage.reload();
        assert.equal(await discoverPage.locator('.expedition-world-scene[data-discovery="cache"]').count(),1,
          'revealed site remains remembered after reload');
        await discoverPage.locator('.path-actions [data-action="return"]').click();
        const earned=await discoverPage.evaluate(()=>JSON.parse(localStorage.getItem('crownless-expedition-v1-demo')));
        assert.equal(earned.scrap,3,'real scrap banked after deciding to return alive');
        await discoverPage.screenshot({path:path.join(output,'discovery-return-'+width+'.png')});
        assert.deepEqual(errors,[]);
      } finally {await discoverContext.close();}

      const tracksContext=await browser.newContext({
        viewport:{width,height:width===360?800:844},isMobile:true,hasTouch:true
      });
      try {
        const page=await tracksContext.newPage();
        await page.goto(url);
        await page.locator('[data-action="mode"][data-value="demo"]').click();
        await page.locator('.district-detail [data-action="depart"][data-value="wood"]').click();
        await page.locator('.expedition-world-scene [data-action="scout-tracks"]').click();
        const mark=await page.evaluate(()=>JSON.parse(localStorage.getItem('crownless-expedition-v1-demo')));
        assert.equal(mark.expedition.discovery,'tracks');
        assert.equal(mark.expedition.focus,3);
        await page.locator('.path-actions [data-action="careful"]').click();
        const pre=await page.evaluate(()=>{
          const saved=JSON.parse(localStorage.getItem('crownless-expedition-v1-demo'));
          const baseline=JSON.parse(JSON.stringify(saved));baseline.expedition.focus=0;
          return window.CrownlessSlice.attackPreview(saved,'strike')-window.CrownlessSlice.attackPreview(baseline,'strike');
        });
        assert.equal(pre,3,'scouting tracks changes the actual next battle');
      } finally {await tracksContext.close();}
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
