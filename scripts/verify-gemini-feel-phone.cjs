'use strict';
// Chromium smoke for the human-selected Gemini-based combat feel baseline.
// Observe real DOM/canvas output without adding hooks to the original battle engine.
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const fs = require('node:fs/promises');
const path = require('node:path');

function listen(server) {
  return new Promise((resolve, reject) => {
    let out = '';
    const timeout = setTimeout(() => reject(new Error('server start timed out')), 10000);
    server.stdout.on('data', data => {
      out += data.toString();
      const found = out.match(/http:\/\/localhost:(\d+)/);
      if (found) { clearTimeout(timeout); resolve(Number(found[1])); }
    });
    server.once('error', reject);
    server.once('exit', code => reject(new Error('server exited: ' + code)));
  });
}

async function main() {
  const { chromium } = require('playwright');
  const server = spawn(process.execPath, ['scripts/serve-slice.cjs'], {
    cwd: path.resolve(__dirname, '..'),
    env: { ...process.env, PORT: '0' },
    stdio: ['ignore', 'pipe', 'pipe'],
  });
  server.stderr.pipe(process.stderr);
  let browser;
  try {
    const port = await listen(server);
    browser = await chromium.launch({ headless: true });
    await fs.mkdir(path.resolve(__dirname, '../.qa/browser'), { recursive: true });

    for (const width of [360, 390]) {
      const context = await browser.newContext({
        viewport: { width, height: width === 360 ? 800 : 844 },
        isMobile: true, hasTouch: true, deviceScaleFactor: 1,
      });
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', err => errors.push(err.message));
      await page.addInitScript(() => {
        const original = CanvasRenderingContext2D.prototype.fillText;
        window.__combatLabCanvasText = [];
        CanvasRenderingContext2D.prototype.fillText = function (value, ...args) {
          const text = String(value);
          // Keep distinct visible messages, not 3000 copies of the first few
          // frames: slower CI can otherwise exhaust the log before a clue tap.
          if (window.__combatLabCanvasText.length < 3000 && !window.__combatLabCanvasText.includes(text)) {
            window.__combatLabCanvasText.push(text);
          }
          return original.call(this, value, ...args);
        };
      });
      try {
        // Start in the real neighborhood scene, not via an invented deep link.
        // Demo uses the same discovered-district selection UI as walk mode.
        await page.goto('http://127.0.0.1:' + port + '/expedition.html', {
          waitUntil: 'domcontentloaded', timeout: 30000,
        });
        await page.locator('[data-action="mode"][data-value="demo"]').click();
        assert.equal(await page.locator('.nearby-track-tile.selected.track-wood').count(),1,
          'a discovered woodland must be selected before the action gateway appears');
        const mainAction = page.locator('.nearby-card-actions button:first-child');
        assert.equal(await mainAction.getAttribute('data-action'), 'action-forest-lab',
          'the most prominent forest departure must start real-time combat');
        assert.match(await mainAction.innerText(), /アクション遠征/);
        const saveBefore = await page.evaluate(
          () => localStorage.getItem('crownless-expedition-v1-demo'));
        await mainAction.click();
        await page.waitForURL('**/gemini-feel-lab.html?from=discovered-wood');
        assert.equal(await page.evaluate(
          () => localStorage.getItem('crownless-expedition-v1-demo')), saveBefore,
          'entering action combat must not mutate production saves');
        await page.goto('http://127.0.0.1:' + port + '/gemini-feel-lab.html?from=discovered-wood', {
          waitUntil: 'domcontentloaded', timeout: 30000,
        });
        await page.waitForFunction(() => {
          const canvas = document.querySelector('#gameCanvas');
          return !!canvas && canvas.width > 0 && window.__combatLabCanvasText.includes('旅人 [1P]');
        }, null, { timeout: 15000 });

        assert.match(await page.locator('#forestExploreHint').innerText(), /森の音.*気になる地点は直接タップ/,
          'start of combat should invite sensory exploration without spoiling place names');
        assert.equal(await page.locator('#rpgOpenResults').isVisible(), false,
          'expedition choice stays hidden until enemies are defeated');
        assert.equal(await page.locator('#rpgKeepExploring').isVisible(), false,
          'continue exploring is only shown in the cleared-wave results');
        const explorationProof = await page.evaluate(() => {
          const D=window.CrownlessForestDiscoveries;
          const R=window.CrownlessRpgLoop;
          const visited=new Set();
          const state=R.create();
          for(let i=0;i<3;i++) R.claimMaterial(state);
          R.clearWave(state);
          const find=D.uncover({x:800,z:365},visited,state.phase,100,140);
          if(find.ok) R.claimMaterial(state);
          const afterFind={phase:state.phase,unbanked:state.unbanked,banked:state.banked};
          R.returnAlive(state,100);
          return {spots:D.spots.map(x=>x.id),afterFind,banked:state.banked,repeat:
            D.uncover({x:800,z:365},visited,'fight',100,140).ok};
        });
        assert.deepEqual(explorationProof.spots,['traces','shrine','hollow']);
        assert.deepEqual(explorationProof.afterFind,{phase:'return',unbanked:4,banked:0});
        assert.equal(explorationProof.banked,4);
        assert.equal(explorationProof.repeat,false);
        // Real 360/390px Chromium loads the same scouting and strike-clock rules.
        // This verifies the opening window without pretending to judge combat feel.
        const guardianWarning = await page.evaluate(() => {
          const D=window.CrownlessForestDiscoveries;
          const H=window.CrownlessHitRecovery;
          const now=100;
          const scouted=D.guardianOpeningSeconds(new Set(['traces']));
          return {
            blind:D.guardianOpeningSeconds(new Set()),
            scouted,
            tooEarly:H.readyToStrike({nextStrikeAt:now+scouted},now+1),
            ready:H.readyToStrike({nextStrikeAt:now+scouted},now+2)
          };
        });
        assert.deepEqual(guardianWarning,{blind:0,scouted:1.8,tooEarly:false,ready:true},
          'scouting must grant a real first-strike warning on the phone runtime');
        const status = await page.evaluate(() => {
          const a = document.querySelector('#gestureActionArea').getBoundingClientRect();
          const top = document.elementFromPoint(a.x + a.width * 0.7, a.y + a.height * 0.7);
          const canvas = document.querySelector('#gameCanvas');
          return {
            scrollWidth: document.documentElement.scrollWidth,
            viewportWidth: innerWidth,
            canvasHeight: canvas.getBoundingClientRect().height,
            gestureWidth: a.width, gestureHeight: a.height,
            gestureTouchable: top === document.querySelector('#gestureActionArea') ||
              document.querySelector('#gestureActionArea').contains(top),
            names: window.__combatLabCanvasText.filter(v => v.includes('ゴブリン')).slice(0, 4),
          };
        });
        assert(status.gestureTouchable && status.gestureWidth >= 130 && status.canvasHeight >= 180,
          'right-side touch combat region must be reachable: ' + JSON.stringify(status));
        assert.equal(await page.locator('#arcadeActionButtons').isVisible(), false,
          'action buttons should not obscure fighters in gesture mode');
        assert.equal(await page.evaluate(() => typeof window.CrownlessActionBarrierReadout), 'undefined',
          'moving fence has been removed instead of hidden');
        assert(status.scrollWidth <= width + 1, 'no full-document horizontal overflow');
        assert.equal(await page.locator('#rpgPanel').isVisible(), false,
          'combat starts immediately without an RPG menu blocking original touch controls');
        assert.match(await page.locator('#rpgStatusBadge').innerText(), /未帰還 0.*倉庫 0.*初期装備/,
          'run starts with no material and no forged weapon');
        assert.equal(await page.evaluate(() => typeof window.CrownlessRpgLoop.forge), 'function',
          'isolated smithing rules load in the real browser');
        // Exercise the production-loaded recovery functions on a phone browser.
        // A three-enemy burst must only register one hit, then leave time to move.
        const recovery = await page.evaluate(() => {
          const R = window.CrownlessHitRecovery;
          const hero = {team:0,hitGuardRemaining:0};
          const mob = [{team:1,isBoss:false,nextStrikeAt:0},
                       {team:1,isBoss:false,nextStrikeAt:0},
                       {team:1,isBoss:true,nextStrikeAt:0}];
          let hits=0;
          for (const e of mob) {
            if (R.acceptsHit(hero)) { R.registerHit(hero); hits++; }
            R.registerEnemyStrike(e,20);
          }
          R.step(hero,R.HERO_DOWN_SECONDS);
          return { hits, protected:R.acceptsHit(hero)===false,
            remaining:hero.hitGuardRemaining,
            enemyReady:mob.map(e=>R.readyToStrike(e,20.6)),
            grace:R.HERO_GRACE_SECONDS,
            down:R.HERO_DOWN_SECONDS };
        });
        assert.equal(recovery.hits,1,'a crowd may not repeatedly stun-lock a hero');
        assert(recovery.protected && recovery.remaining>0.5,
          'hero must regain control with immunity remaining: '+JSON.stringify(recovery));
        assert.deepEqual(recovery.enemyReady,[false,false,false],
          'each enemy must cool down between attack attempts');


        // Walk close to the original enemy wave and hold attack as the original invites.
        await page.keyboard.down('d');
        await page.waitForTimeout(800);
        await page.keyboard.up('d');
        await page.keyboard.down('j');
        await page.waitForFunction(
          () => window.__combatLabCanvasText.some(v => /^-\d+$/.test(v)),
          null, { timeout: 8000 }
        );
        await page.keyboard.up('j');
        assert.equal(errors.length, 0, 'no runtime errors: ' + errors.join('; '));
        await page.screenshot({
          path: path.resolve(__dirname, '../.qa/browser/gemini-feel-lab-' + width + '.png'),
        });

        await page.locator('#btnOpenShop').click();
        assert.equal(await page.locator('#shopModal').isVisible(), true, 'skills shop still works');
        await page.locator('#btnCloseShop').click();
        assert.equal(await page.locator('#shopModal').isVisible(), false);
        await page.locator('#btnToggleAI').click();
        assert.match(await page.locator('#btnToggleAI').innerText(), /2P|相棒|同行/);
        // Phone touch gameplay without obstructive arcade buttons. Actual
        // pointer movements exercise the right-side action area.
        const gesture = page.locator('#gestureActionArea');
        const zone = await gesture.boundingBox();
        assert(zone && zone.width >= 130, 'right thumb combat region must exist');
        const x = zone.x + zone.width * 0.55;
        const y = zone.y + zone.height * 0.65;
        const read=() => page.evaluate(() => window.CrownlessGestureReadout());
        assert.equal((await read()).mode,'gesture');
        await page.touchscreen.tap(x,y);
        assert.equal((await read()).lastAction,'punch','tap must attack');
        for (const [dx,dy,expected] of [[65,0,'kick'],[0,-75,'jump'],[0,75,'grab']]) {
          const before=(await read()).count;
          await page.mouse.move(x,y);
          await page.mouse.down();
          await page.mouse.move(x+dx,y+dy,{steps:6});
          await page.mouse.up();
          assert.equal((await read()).lastAction,expected,'swipe action '+expected);
          assert.equal((await read()).count,before+1,'one swipe triggers only one action');
        }
        const after=(await read()).count;
        await gesture.dispatchEvent('pointercancel',{pointerId:4096});
        assert.equal((await read()).count,after,'cancelled gesture never attacks');
        await page.screenshot({
          path:path.resolve(__dirname,'../.qa/browser/gesture-combat-'+width+'.png'),
        });
        await page.locator('#btnToggleInput').click();
        assert.equal((await read()).mode,'buttons');
        assert.equal(await page.locator('#arcadeActionButtons').isVisible(),true);
        assert.equal(await page.locator('#gestureActionArea').isVisible(),false);
        const buttonProof=await page.evaluate(() => {
          const stage=document.getElementById('stageViewport').getBoundingClientRect();
          const btn=document.getElementById('btnPunch').getBoundingClientRect();
          return {stageBottom:stage.bottom,buttonTop:btn.top};
        });
        assert(buttonProof.buttonTop>=buttonProof.stageBottom-2,
          'legacy buttons live below canvas, not on top of fighters: '+JSON.stringify(buttonProof));
        await page.locator('#btnToggleInput').click();
        assert.equal((await read()).mode,'gesture');
        assert.equal(await page.locator('#arcadeActionButtons').isVisible(),false);
        assert.equal(errors.length, 0, 'no errors in gesture and legacy input modes');
        // Simulate a completed safe return through the same pure rules,
        // then prove the real browser restores ONLY banked/crafted values.
        await page.evaluate(() => {
          const r = window.CrownlessRpgLoop.create();
          for (let i = 0; i < 3; i++) window.CrownlessRpgLoop.claimMaterial(r);
          window.CrownlessRpgLoop.clearWave(r);
          window.CrownlessRpgLoop.returnAlive(r, 80);
          localStorage.setItem('crownless-action-forest-v1-demo', window.CrownlessActionSave.encode(r));
        });
        await page.reload({ waitUntil: 'domcontentloaded' });
        await page.waitForFunction(() => document.querySelector('#rpgStatusBadge')?.textContent.includes('倉庫 3'));
        assert.match(await page.locator('#rpgStatusBadge').innerText(), /未帰還 0.*倉庫 3.*初期装備/);
        assert.equal(await page.locator('#rpgPanel').isVisible(), false,
          'resuming must start a fresh expedition with no popup blocking combat');
        await page.evaluate(() => {
          const r = window.CrownlessRpgLoop.create();
          r.phase = 'camp';
          r.banked = 3;
          window.CrownlessRpgLoop.forge(r);
          localStorage.setItem('crownless-action-forest-v1-demo', window.CrownlessActionSave.encode(r));
        });
        await page.reload({ waitUntil: 'domcontentloaded' });
        await page.waitForFunction(() => document.querySelector('#rpgStatusBadge')?.textContent.includes('風裂きの剣'));
        assert.match(await page.locator('#rpgStatusBadge').innerText(), /未帰還 0.*倉庫 0.*風裂きの剣/);
        assert.equal(await page.evaluate(
          () => localStorage.getItem('crownless-expedition-v1-demo')), saveBefore,
          'lab visits and saved smith equipment must never mutate the actual RPG save');
        // Bad records are diagnosed rather than rewritten or called saved.
        await page.evaluate(() => localStorage.setItem('crownless-action-forest-v1-demo', '{"version":999}'));
        await page.reload({ waitUntil: 'domcontentloaded' });
        assert.equal(await page.locator('#rpgSaveWarning').isVisible(), true);
        assert.match(await page.locator('#rpgSaveWarning').innerText(), /上書きを防ぐため/);
        assert.equal(await page.evaluate(
          () => localStorage.getItem('crownless-action-forest-v1-demo')), '{"version":999}');
        assert.equal(errors.length, 0, 'no runtime errors after isolated save restore tests');
        // Compare the same real shrine decision with starter gear (360px)
        // and a smith-crafted sword restored from a valid current save (390px).
        if (width === 390) {
          await page.evaluate(() => {
            const run = window.CrownlessRpgLoop.create();
            run.phase = 'camp';
            run.banked = window.CrownlessRpgLoop.COST;
            assertForgedSword(run);
            function assertForgedSword(state) {
              if (!window.CrownlessRpgLoop.forge(state) || !state.crafted)
                throw new Error('smith must craft the sword before the phone test');
            }
            localStorage.setItem('crownless-action-forest-v1-demo',
              window.CrownlessActionSave.encode(run));
          });
        }
        // Real phone taps: the first playable shrine is initially offscreen.
        // Walk until its world-fixed sprite enters view, then tap its icon.
        // The player is still too far away, so the GAME must visibly say so
        // rather than silently eat the touch as movement/attack input.
        await page.goto('http://127.0.0.1:' + port + '/gemini-feel-lab.html' +
          (width === 390 ? '?from=discovered-wood' : ''), {
          waitUntil:'domcontentloaded',timeout:30000,
        });
        await page.waitForFunction(() => window.CrownlessForestReadout?.().player);
        assert.equal((await page.evaluate(() => window.CrownlessForestReadout())).crafted,
          width === 390,'390px must load the forged sword; 360px uses starter gear');
        await page.keyboard.down('d');
        try {
          await page.waitForFunction(() => {
            const v=window.CrownlessForestReadout();
            const canvas=document.getElementById('gameCanvas');
            return v.player?.hp>0 && v.player.x<625 &&
              (660-v.cameraX)<v.viewport.width-20;
          },null,{timeout:9000});
        } finally {
          await page.keyboard.up('d');
        }
        const forestTap=await page.evaluate(() => {
          const scene=window.CrownlessForestReadout();
          const canvas=document.getElementById('gameCanvas');
          const rect=canvas.getBoundingClientRect();
          const shrine=window.CrownlessForestDiscoveries.spots.find(s=>s.id==='shrine');
          const bridgeHeight=Math.max(0,Math.cos((shrine.x-580)/150*Math.PI/2)*46);
          const cx=rect.left+(shrine.x-scene.cameraX)*rect.width/scene.viewport.width;
          const cy=rect.top+(shrine.z-bridgeHeight-42)*rect.height/scene.viewport.height;
          return {x:cx,y:cy,hero:scene.player,cameraX:scene.cameraX,
            tappedSite:window.CrownlessForestDiscoveries.spotAtTap(
              {x:cx,y:cy},rect,scene.viewport,scene.cameraX,
              (x,z) => x>=430&&x<=730&&z>=235&&z<=345
                ? Math.max(0,Math.cos((x-580)/150*Math.PI/2)*46):0
            )?.id};
        });
        assert.equal(forestTap.tappedSite,'shrine',
          'scaled direct touch should hit the visible shrine: '+JSON.stringify(forestTap));
        assert(Math.hypot(forestTap.hero.x-660,forestTap.hero.z-230)>54,
          'test must be outside pickup range so guidance is checked');
        await page.touchscreen.tap(forestTap.x,forestTap.y);
        await page.waitForFunction(
          () => window.__combatLabCanvasText.some(s => s.includes('もう少し近づいて調べよう')),
          null,{timeout:2500}
        );
        assert.equal(errors.length,0,'direct real touch on shrine must not throw');
        // Now actually WALK into range. The scrolling shrine moves to the
        // left half, where touches were previously swallowed by the joystick.
        await page.keyboard.down('d');
        try {
          await page.waitForFunction(
            () => window.CrownlessForestReadout()?.player?.x>=638,
            null,{timeout:7000}
          );
        } finally { await page.keyboard.up('d'); }
        await page.keyboard.down('w');
        try {
          await page.waitForFunction(
            () => window.CrownlessForestReadout()?.player?.z<=245,
            null,{timeout:7000}
          );
        } finally { await page.keyboard.up('w'); }
        const nearTap=await page.evaluate(() => {
          const s=window.CrownlessForestReadout();
          const c=document.getElementById('gameCanvas');
          const rect=c.getBoundingClientRect();
          const site=window.CrownlessForestDiscoveries.spots.find(o=>o.id==='shrine');
          return {x:rect.left+(site.x-s.cameraX)*rect.width/s.viewport.width,
            y:rect.top+(site.z-45)*rect.height/s.viewport.height,
            player:s.player,rectWidth:rect.width};
        });
        assert(Math.hypot(nearTap.player.x-660,nearTap.player.z-230)<54,
          'hero genuinely walked into discovery distance: '+JSON.stringify(nearTap));
        assert(nearTap.x<nearTap.rectWidth*.52,
          'site should now be on movement-pad half, demonstrating former click bug');
        const beforeShrine=await page.evaluate(() => ({
          ...window.CrownlessForestReadout(),
          hint:document.getElementById('forestExploreHint').textContent,
        }));
        assert.equal(await page.evaluate(() => window.__combatLabCanvasText.includes('苔むす祠')),false,
          'the undiscovered shrine name must not appear on the actual canvas');
        assert.equal(await page.evaluate(() => window.__combatLabCanvasText.includes('苔の冷気')),true,
          'nearby shrine must show a sensory cue on the canvas');
        assert.match(beforeShrine.hint,
          beforeShrine.player.hp>=beforeShrine.player.maxHp
            ? /素材を探すか、傷ついてから癒やすか/ : /素材か癒やしか、一度だけ選べる/,
          'real phone hint must invite an intentional trade-off');
        const readForestShrine=()=>page.evaluate(()=>window.CrownlessForestReadout());
        // The actor can collect a healing dango between the HUD snapshot
        // and the actual tap. Assert against HP at the decision point, not
        // an earlier frame (especially on a high-DPI rendering workload).
        await page.evaluate(() => {
          const api=window.CrownlessForestDiscoveries;
          const uncover=api.uncover;
          api.uncover=(...args) => {
            const result=uncover(...args);
            if(result.ok && result.spot?.id==='shrine') {
              window.__shrineTapOutcome={
                hpAtTap:args[3],maxHp:args[4],
                unbankedAtTap:window.CrownlessForestReadout().unbanked,
                material:result.material,heal:result.heal,damage:result.damage||0
              };
              // The shrine awards materials synchronously after uncover().
              // Capture them before the guardian can be defeated on a later frame.
              queueMicrotask(() => {
                window.__shrineTapOutcome.unbankedAfterChoice=window.CrownlessForestReadout().unbanked;
              });
            }
            return result;
          };
        });
        await page.touchscreen.tap(nearTap.x,nearTap.y);
        assert.equal(await page.locator('#forestShrineChoice').isVisible(),true,
          'touching the shrine presents explicit choices without consuming it');
        assert.equal(await page.locator('#forestShrineChoice').getAttribute('aria-modal'),'true',
          'the shrine choice must block accidental background taps');
        const stakesAtChoice=await readForestShrine();
        const forgeNeed=Math.max(0,3-stakesAtChoice.banked-stakesAtChoice.unbanked);
        const forgeChoice=stakesAtChoice.crafted?'鍛冶剣は装備済み。':
          forgeNeed===0?'鍛冶剣の素材は揃っている。':
          '鍛冶剣まで牙あと'+forgeNeed+'個（+1なら残り'+Math.max(0,forgeNeed-1)+
          '、+2なら残り'+Math.max(0,forgeNeed-2)+'）。';
        assert.equal(await page.locator('#forestShrineStakes').textContent(),
          '現在 HP '+Math.floor(stakesAtChoice.player.hp)+'/'+stakesAtChoice.player.maxHp+
          '、未帰還の牙 '+stakesAtChoice.unbanked+
          '個。'+forgeChoice+'素材は生還時だけ倉庫に残る（敗北すると失う）。',
          'real phone choice must show the safe/risky forge payoff without promising banked loot');
        const shrineBounds=await page.locator('#forestShrineChoice > div').boundingBox();
        assert(shrineBounds && shrineBounds.y>=0 &&
          shrineBounds.y+shrineBounds.height<=page.viewportSize().height,
          'the expanded shrine decision must remain inside the phone viewport');
        const pausedBefore=await readForestShrine();
        await page.waitForTimeout(300);
        const pausedAfter=await readForestShrine();
        assert.deepEqual(pausedAfter.player,pausedBefore.player,
          'the hero must not move or lose HP while choosing at the shrine');
        // Dead foes may be removed by an already-scheduled cleanup timeout;
        // only living enemies can move, attack or change HP during the modal.
        assert.deepEqual(pausedAfter.enemies.filter(enemy=>enemy.hp>0),
          pausedBefore.enemies.filter(enemy=>enemy.hp>0),
          'living enemy AI and combat must pause until the choice is closed');
        assert.equal(pausedAfter.found.includes('shrine'),false);
        await page.locator('#forestShrineCancel').click();
        assert.equal((await readForestShrine()).found.includes('shrine'),false,
          'declining must preserve the discovery for later');
        await page.touchscreen.tap(nearTap.x,nearTap.y);
        // Reopening resumes combat briefly; check the live phase/HP instead
        // of the snapshot taken before cancel. Risk is only legal after the
        // initial wave is cleared, even when the forged sword makes it cheap.
        const decision=await readForestShrine();
        const riskCost=await page.evaluate(() => {
          const s=window.CrownlessForestReadout();
          return window.CrownlessForestDiscoveries.shrineRiskDamage(new Set(s.found),s.crafted);
        });
        assert.equal(riskCost,width===390?6:12,
          'the actual shrine risk must halve after smithing, not merely change its label');
        const canRisk=decision.phase==='return' && decision.player.hp>=riskCost+1;
        const riskButton=page.locator('#forestShrineRisk');
        assert.equal(await riskButton.isEnabled(),canRisk,
          'deep search requires a cleared wave AND enough HP for the equipment-dependent cost');
        const riskLabel=await riskButton.textContent();
        if(decision.phase!=='return') {
          assert.match(riskLabel,/魔物を倒してから/,
            'during combat the player must see why deep searching is unavailable');
          assert.equal(await page.locator('#forestShrineMaterial').isEnabled(),true,
            'the safe material route remains available during combat');
        } else if(canRisk) {
          assert.match(riskLabel,new RegExp('HP -'+riskCost),
            'the choice must advertise the actual wound before confirmation');
          assert.match(riskLabel,new RegExp('→残り'+Math.floor(decision.player.hp-riskCost)),
            'the choice must preview the resulting HP rather than forcing mental arithmetic');
        }
        // The full post-victory guardian branch is exercised by
        // verify-pixel-forest.cjs; this smoke also covers the combat-time
        // safe option instead of trying to click a deliberately disabled risk.
        const takeRisk=width===390 && canRisk;
        await page.locator(takeRisk?'#forestShrineRisk':'#forestShrineMaterial').click();
        await page.waitForFunction(() => window.CrownlessForestReadout().found.includes('shrine'),
          null,{timeout:2500});
        await page.waitForFunction(() => window.__combatLabCanvasText.includes('苔むす祠'),
          null,{timeout:2500});
        const afterShrine=await page.evaluate(() => window.CrownlessForestReadout());
        const shrineOutcome=await page.evaluate(() => window.__shrineTapOutcome);
        assert(shrineOutcome,'direct shrine tap must invoke the discovery rule');
        assert.equal(shrineOutcome.material,takeRisk?2:1,
          'the chosen branch grants the advertised number of provisional fangs');
        assert.equal(shrineOutcome.damage,takeRisk?riskCost:0,
          'deep search has a real HP cost; ordinary gathering remains safe');
        assert.equal(shrineOutcome.heal,0,
          'the material button deliberately gives up healing');
        // The guardian can die while Chromium waits for the canvas label;
        // its own +1 fang is separate from the shrine's +2 reward.
        assert.equal(shrineOutcome.unbankedAfterChoice-shrineOutcome.unbankedAtTap,
          shrineOutcome.material,'the chosen shrine branch awards exactly its advertised fangs');
        assert(afterShrine.unbanked>=shrineOutcome.unbankedAfterChoice &&
          afterShrine.unbanked<=shrineOutcome.unbankedAfterChoice+(takeRisk?1:0),
          'only an optional guardian defeat may add another fang after the choice');
        await page.touchscreen.tap(nearTap.x,nearTap.y);
        assert.deepEqual(await page.evaluate(() => window.__shrineTapOutcome),shrineOutcome,
          'repeat shrine taps must not trigger the discovery rule again');
        const afterRepeat=await page.evaluate(() => window.CrownlessForestReadout());
        // A live guardian can defeat the hero between two real touch inputs.
        // The camp phase is the reliable outcome signal: a restarted hero may
        // already have positive HP, while the lost unsecured bag stays zero.
        // Defeat correctly discards the entire unsecured bag; it is not a
        // duplicate-pickup regression. The unchanged shrine outcome above
        // proves the second tap did not award another shrine reward.
        if (afterRepeat.phase==='camp') {
          assert.equal(afterRepeat.unbanked,0,
            'defeat after the shrine must lose all unsecured fangs');
        } else {
          assert(afterRepeat.unbanked>=afterShrine.unbanked &&
            afterRepeat.unbanked<=shrineOutcome.unbankedAfterChoice+(takeRisk?1:0),
            'repeat shrine taps cannot duplicate materials, even if the guardian falls');
        }
        assert.equal(errors.length,0,'direct near-site touch must resolve once without errors');



      } finally {
        await context.close();
      }
    }
    console.log('Gemini-feel fantasy baseline: 360px/390px, real hit + shop + companion toggle + isolated return/forge reload PASS');
  } finally {
    if (browser) await browser.close();
    server.kill();
  }
}
main().catch(err => { console.error(err); process.exitCode = 1; });
