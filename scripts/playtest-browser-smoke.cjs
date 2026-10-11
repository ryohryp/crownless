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
        assert.equal(await page.locator(".neighborhood-atlas").count(), 1, "demo should show the map");
        assert.equal(await page.locator(".bottom-navigation").isVisible(), true, "bottom navigation should be visible");
        const nav = await page.locator(".bottom-navigation").boundingBox();
        assert(nav && nav.y >= -1 && nav.y + nav.height <= height + 2, "bottom navigation must fit the viewport");
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true, "no document-wide horizontal overflow");
        await page.screenshot({ path: path.join(output, "map-" + width + ".png") });

        // Real pointer/touch regression: a normal expedition must lead into
        // combat and a resolved first fight, not merely set a path save.
        await page.locator('.district-detail [data-action="depart"][data-value="wood"]').click();
        assert.equal(await page.locator(".expedition-layout.path-stage").count(), 0);
        assert.equal(await page.locator(".expedition-layout:not(.battle-layout)").count(), 1);
        const firstStep = page.locator('.path-actions button[data-action="careful"]');
        assert.equal(await firstStep.isVisible(), true, "advance-to-fight choice should be visible");
        await page.screenshot({ path: path.join(output, "before-combat-" + width + ".png") });
        await firstStep.click();
        assert.equal(await page.locator(".battle-layout .combat-enemy-summary").count(), 1, "first encounter must render actual battle");
        await page.screenshot({ path: path.join(output, "combat-start-" + width + ".png") });
        await page.locator('[data-action="auto-fight"]').click();
        assert.equal(await page.locator(".path-panel").count(), 1, "first battle must resolve to the next route scene");
        const afterFirstBattle = await page.evaluate(() => JSON.parse(localStorage.getItem("crownless-expedition-v1-demo")));
        assert.equal(afterFirstBattle.expedition?.room, 1);
        assert(afterFirstBattle.expedition?.materials.wolfFang >= 1);
        await page.reload();
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
        await page.locator('[data-action="tab"][data-value="explore"]').click();
        assert.equal(await page.locator(".neighborhood-atlas").count(), 1);
        await page.screenshot({ path: path.join(output, "return-from-combat-" + width + ".png") });


        if (width === 390) {
          // The map must reveal distinct shop/event sprites by player discovery,
          // not by artificially stamping a record into localStorage.
          assert.equal(await page.locator('.district-pin[data-poi-family="event"] .district-pixel-art').count(), 1);
          await page.locator(".map-home-scouting > summary").click();
          await page.locator('[data-action="scout"][data-value="tower"]').click();
          await page.locator(".map-home-scouting > summary").click();
          await page.locator('[data-action="scout"][data-value="tower"]').click();
          assert(await page.locator('.district-pin[data-poi-family="shop"] .district-pixel-art').count() >= 1);
          assert(await page.locator('.district-pin[data-poi-family="event"] .district-pixel-art').count() >= 1);
          await page.screenshot({ path: path.join(output, "hybrid-discovery-390.png") });
          await page.locator('.district-pin[data-poi-family="shop"]').last().click();
          assert.match(await page.locator(".district-detail").innerText(), /見張り跡/);
          assert.match(await page.locator(".district-poi-card").innerText(), /鐘守の鍛冶台/);
          await page.locator(".map-home-scouting > summary").click();
          await page.locator('[data-action="travel-demo"][data-value="skytree"]').click();
          assert.match(await page.locator(".chronicle-panel").innerText(), /天穿つ白塔/, "new fantasy landmark should appear");
          await page.screenshot({ path: path.join(output, "landmark-390.png") });
          await page.reload();
          await page.locator('[data-action="tab"][data-value="chronicle"]').click();
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
      await poiPage.locator(".map-home-scouting > summary").click();
      await poiPage.locator('[data-action="scout"][data-value="tower"]').click();
      await poiPage.locator(".map-home-scouting > summary").click();
      await poiPage.locator('[data-action="scout"][data-value="tower"]').click();
      await poiPage.evaluate(() => {
        const key="crownless-expedition-v1-demo";
        const saved=JSON.parse(localStorage.getItem(key));
        saved.scrap=7; // Earned currency fixture: isolate the discovery→shop mechanic.
        localStorage.setItem(key,JSON.stringify(saved));
      });
      await poiPage.reload();
      await poiPage.locator(".district-poi-card > summary").click();
      await poiPage.screenshot({ path: path.join(output, "poi-shop-390.png") });
      await poiPage.locator('[data-action="poi"][data-value="trade-material"]').click();
      const trade=await poiPage.evaluate(() => JSON.parse(localStorage.getItem("crownless-expedition-v1-demo")));
      assert.equal(trade.scrap,4);
      assert.equal(trade.materials.watchIron,1);
      await poiPage.locator('.district-pin[data-value="0,1"]').click();
      await poiPage.locator(".district-poi-card > summary").click();
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
      const smithButton=poiPage.locator('[data-action="craft-item"][data-value="shield_thorn"]');
      assert.equal(await smithButton.isEnabled(),true,'cross-region materials and design enable smithing');
      await smithButton.click();
      await poiPage.locator('[data-action="character"][data-value="0"]').click();
      await poiPage.locator('[data-action="equip"][data-value="shield_thorn"]').click();
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
      await poiPage.locator('.district-pin[data-value="-1,0"]').click();
      await poiPage.locator('.district-detail [data-action="depart"][data-value="wood"]').click();
      await poiPage.locator('.path-actions [data-action="careful"]').click();
      await poiPage.locator('.combat-manual > summary').click();
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
      await bellPage.locator('.district-pin[data-value="0,2"]').click();
      assert.equal(await bellPage.locator('.restored-bell-notice').count(),0,'the neighboring tower shop did not change');
      await bellPage.locator('.district-pin[data-value="0,1"]').click();
      assert.equal(await bellPage.locator('.district-pin.restored-bell').count(),1,'exact source tower is visibly changed');
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
