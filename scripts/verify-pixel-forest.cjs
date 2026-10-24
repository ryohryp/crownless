'use strict';
// Real Chromium input only: never set actor positions, HP, discovery or save state.
// The read-only probe helps the driver aim at visible-world coordinates.
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const fs = require('node:fs/promises');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const output = path.join(root, '.qa/browser');
const read = page => page.evaluate(() => window.CrownlessForestReadout());

function listen(server) {
  return new Promise((resolve, reject) => {
    let out = '';
    const timer = setTimeout(() => reject(new Error('server start timeout')), 10000);
    server.stdout.on('data', data => {
      out += data.toString();
      const found = out.match(/http:\/\/localhost:(\d+)/);
      if (found) { clearTimeout(timer); resolve(Number(found[1])); }
    });
    server.once('error', err => { clearTimeout(timer); reject(err); });
    server.once('exit', code => { clearTimeout(timer); reject(new Error('server exited: ' + code)); });
  });
}

async function keys(page, held, wanted) {
  for (const key of held) if (!wanted.includes(key)) { await page.keyboard.up(key); held.delete(key); }
  for (const key of wanted) if (!held.has(key)) { await page.keyboard.down(key); held.add(key); }
}

async function walkTo(page, x, z) {
  const held = new Set();
  const start = Date.now();
  try {
    while (Date.now() - start < 18000) {
      const s = await read(page);
      assert(s.player.hp > 0 && s.phase !== 'camp', 'walking must happen in a living expedition');
      const dx = x - s.player.x, dz = z - s.player.z;
      if (Math.hypot(dx, dz) < 18) return s;
      const wanted = [];
      if (Math.abs(dx) > 10) wanted.push(dx > 0 ? 'd' : 'a');
      if (Math.abs(dz) > 10) wanted.push(dz > 0 ? 's' : 'w');
      await keys(page, held, wanted);
      await page.waitForTimeout(55);
    }
    throw new Error('walk timeout: ' + JSON.stringify(await read(page)));
  } finally { await keys(page, held, []); }
}

async function clearWave(page) {
  const held = new Set();
  const start = Date.now();
  const before = await read(page);
  let minimumHp = before.player.hp;
  try {
    while (Date.now() - start < 75000) {
      const s = await read(page);
      minimumHp = Math.min(minimumHp, s.player.hp);
      if (s.phase === 'return') return { seconds: Math.round((Date.now()-start)/100)/10, minimumHp, after:s };
      assert(s.phase === 'fight' && s.player.hp > 0,
        'real-input combat ended in defeat: ' + JSON.stringify(s));
      assert(Array.isArray(s.enemies), 'read-only probe must expose enemy positions');
      const target = s.enemies.filter(e => e.hp > 0 && e.state !== 'DEAD')
        .sort((a,b) => Math.hypot(a.x-s.player.x,a.z-s.player.z)-Math.hypot(b.x-s.player.x,b.z-s.player.z))[0];
      const wanted = ['k'];
      if (target) {
        const dx=target.x-s.player.x, dz=target.z-s.player.z;
        // Walk into the same depth lane, stop within reach, and face the target.
        if (Math.abs(dx)>44 || (Math.abs(dx)>6 && Math.sign(dx)!==s.player.facing)) wanted.push(dx>0?'d':'a');
        if (Math.abs(dz)>12) wanted.push(dz>0?'s':'w');
      }
      await keys(page,held,wanted);
      await page.waitForTimeout(95);
    }
    throw new Error('real-input combat exceeded 75s: ' + JSON.stringify(await read(page)));
  } finally { await keys(page,held,[]); }
}

async function tapSite(page, id) {
  const point = await page.evaluate(id => {
    const s=window.CrownlessForestReadout();
    const site=window.CrownlessForestDiscoveries.spots.find(v=>v.id===id);
    const c=document.querySelector('#gameCanvas');
    const r=c.getBoundingClientRect();
    const bridge=site.x>=430&&site.x<=730&&site.z>=235&&site.z<=345
      ? Math.max(0,Math.cos((site.x-580)/150*Math.PI/2)*46):0;
    return {x:r.left+(site.x-s.cameraX)*r.width/s.viewport.width,
      y:r.top+(site.z-bridge-42)*r.height/s.viewport.height};
  }, id);
  await page.touchscreen.tap(point.x,point.y);
  await page.waitForTimeout(200);
}

// The clue must change the *actual* next choice, not only a rule test or hint.
async function verifyTracksShrineRisk(page, crafted) {
  const foundTracks=await read(page);
  assert(foundTracks.found.includes('traces'),'the detour must be discovered by real touch first');
  assert(!foundTracks.found.includes('shrine'),'the shrine is still unspent');
  assert.equal(foundTracks.crafted,crafted,'compare starter gear and the forged sword');
  await walkTo(page,660,230);
  const before=await read(page);
  assert(Math.hypot(before.player.x-660,before.player.z-230)<54,
    'the player must physically reach the shrine before touching it');
  await tapSite(page,'shrine');
  assert.equal(await page.locator('#forestShrineChoice').isVisible(),true,
    'the real shrine touch opens the decision');
  const cost=crafted?3:9;
  const risk=page.locator('#forestShrineRisk');
  assert(before.player.hp>=cost+1,'the real run must have enough HP to test this risk');
  assert.equal(await risk.isEnabled(),true);
  assert.match(await risk.innerText(),new RegExp('HP -'+cost),
    'reading tracks must reduce the visible cost with and without crafted gear');
  assert.match(await risk.innerText(),new RegExp('→残り'+Math.ceil(before.player.hp-cost)),
    'the shrine previews the actual remaining HP before committing');
  assert.match(await risk.innerText(),/足跡を読んで負傷 -3/,
    'the UI must explain why the risk is reduced');
  await risk.click();
  const after=await read(page);
  assert(after.found.includes('shrine'),'the selected branch consumes the shrine');
  assert.equal(after.unbanked,before.unbanked+2,
    'the dangerous search grants exactly two unsecured fangs');
  assert.equal(after.player.hp,before.player.hp-cost,
    'the displayed HP cost must match the real health loss');
  await tapSite(page,'shrine');
  assert.equal((await read(page)).unbanked,after.unbanked,
    'repeat touches cannot duplicate the shrine reward');
  return {crafted,cost,hpBefore:before.player.hp,hpAfter:after.player.hp,
    provisionalBefore:before.unbanked,provisionalAfter:after.unbanked};
}

async function main() {
  const {chromium}=require('playwright');
  const server=spawn(process.execPath,['scripts/serve-slice.cjs'],{
    cwd:root,env:{...process.env,PORT:'0'},stdio:['ignore','pipe','pipe'],
  });
  server.stderr.pipe(process.stderr);
  let browser;
  const report={kind:'real-browser-input',gameStateMutatedByTest:false,viewports:[],loop:null};
  try {
    const port=await listen(server);
    browser=await chromium.launch({headless:true});
    await fs.mkdir(output,{recursive:true});
    for(const width of [360,390,430]) {
      const context=await browser.newContext({viewport:{width,height:844},isMobile:true,hasTouch:true,deviceScaleFactor:width===390?2:1});
      const page=await context.newPage();
      const errors=[];
      page.on('pageerror',error=>errors.push(error.message));
      try {
        await page.goto('http://127.0.0.1:'+port+'/expedition.html',{waitUntil:'domcontentloaded'});
        await page.locator('[data-action="mode"][data-value="demo"]').click();
        const saveBefore=await page.evaluate(()=>localStorage.getItem('crownless-expedition-v1-demo'));
        await page.locator('[data-action="action-forest-lab"]').first().click();
        await page.waitForURL('**/gemini-feel-lab.html?from=discovered-wood');
        await page.waitForFunction(()=>window.CrownlessForestReadout?.().assetsReady,{timeout:20000});
        assert.equal((await read(page)).art,'pixel','new forest renderer is the playable default');
        const layout=await page.evaluate(()=>{
          const c=document.querySelector('#gameCanvas'), r=c.getBoundingClientRect();
          return {viewport:innerWidth,scrollWidth:document.documentElement.scrollWidth,
            sourceWidth:c.width,sourceHeight:c.height,width:r.width,height:r.height,
            scaleX:r.width/c.width,scaleY:r.height/c.height};
        });
        assert(layout.scrollWidth<=width+1,'no horizontal overflow: '+JSON.stringify(layout));
        assert(Math.abs(layout.scaleX-layout.scaleY)<0.003,'canvas pixels retain uniform aspect: '+JSON.stringify(layout));
        assert(layout.height>=180,'playable canvas remains tall enough on phone');
        assert(layout.sourceHeight>=layout.height-1,'canvas must not enlarge a low-resolution whole scene');
        if(width===390) assert(layout.sourceHeight>=layout.height*1.9,'high-density phones retain source-art and text detail');
        await page.screenshot({path:path.join(output,'pixel-forest-'+width+'.png')});
        await page.locator('#btnToggleArtPreview').click();
        assert.equal((await read(page)).art,'classic');
        await page.locator('#btnToggleArtPreview').click();
        assert.equal((await read(page)).art,'pixel');
        // Real touch drag on the left movement pad, through Chromium's input path.
        const pad=await page.locator('#leftTouchPadArea').boundingBox();
        assert(pad && pad.width>100,'left movement pad remains reachable');
        const touch=await context.newCDPSession(page);
        const beforeMove=await read(page);
        const x=pad.x+pad.width*.35,y=pad.y+pad.height*.72;
        await touch.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y}]});
        await touch.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x+38,y}]});
        await page.waitForTimeout(300);
        await touch.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
        const afterMove=await read(page);
        assert(afterMove.player.x>beforeMove.player.x+15,'touch joystick must move the actual hero');
        await touch.detach();
        const action=await page.locator('#gestureActionArea').boundingBox();
        await page.touchscreen.tap(action.x+action.width*.7,action.y+action.height*.75);
        assert.equal(await page.evaluate(()=>window.CrownlessGestureReadout().lastAction),'punch','real touch attacks');
        report.viewports.push({width,layout,touchDistance:Math.round(afterMove.player.x-beforeMove.player.x)});
        if(width===390) {
          const first=await clearWave(page);
          assert(first.after.unbanked>=3,'three actual enemies provide crafting materials');
          assert.equal(await page.locator('#rpgPanel').isVisible(),false,'victory leaves forest playable');
          const returnButton=page.locator('#rpgOpenResults');
          assert.equal(await returnButton.isVisible(),true,'the return choice stays available after combat');
          assert.match(await returnButton.innerText(),new RegExp('牙'+first.after.unbanked+'）'),
            'the return button shows the current unsecured loot');
          await returnButton.click();
          const returnDecision=await page.locator('#rpgInfo').innerText();
          assert.match(returnDecision,new RegExp('今帰れば牙'+first.after.unbanked+'個を確保'),
            'the decision states the actual reward from returning alive');
          assert.match(returnDecision,/今帰れば鍛冶剣を作れる/,
            'the first victory gives a concrete reason to bank materials');
          assert.match(returnDecision,new RegExp('敗北すると今回の牙'+first.after.unbanked+'個を失う'),
            'the alternative must name the actual unsecured loss');
          await page.locator('#rpgKeepExploring').click();
          assert.equal(await page.locator('#rpgPanel').isVisible(),false,
            'declining the return decision resumes exploration');
          assert.equal((await read(page)).unbanked,first.after.unbanked,
            'opening and closing the choice must not bank or duplicate loot');
          await walkTo(page,580,280);
          // After combat, the player sees exactly what is at stake before
          // choosing to search farther or return alive with materials.
          const returnHint=await page.locator('#forestExploreHint').innerText();
          assert.match(returnHint,new RegExp('未帰還の牙 '+first.after.unbanked+'個'),
            'the return decision shows actual unbanked materials, not a fixed count');
          assert.match(returnHint,/探索を続けるか、生還して確定/,
            'the player can see the choice to keep exploring or bank the loot');
          await page.screenshot({path:path.join(output,'pixel-forest-bridge-390.png')});
          await walkTo(page,800,365);
          await page.waitForFunction(()=>document.getElementById('forestExploreHint')?.textContent?.includes('湿った土に細い筋がある'));
          // Attacking near tracks must not silently collect one-time materials.
          const beforeClue=await read(page);
          await page.keyboard.down('k');
          await page.waitForTimeout(220);
          await page.keyboard.up('k');
          await page.waitForTimeout(150);
          const afterPunch=await read(page);
          assert(!afterPunch.found.includes('traces'),'punch must not auto-discover');
          assert.equal(afterPunch.unbanked,beforeClue.unbanked,'punch cannot grant clue loot');
          await tapSite(page,'traces');
          const afterTracks=await read(page);
          assert(afterTracks.found.includes('traces'),'walking and touching discovers tracks');
          assert.match(await returnButton.innerText(),new RegExp('牙'+afterTracks.unbanked+'）'),
            'the return choice updates even when the clue hint takes priority');
          await page.waitForFunction(()=>document.getElementById('forestExploreHint')?.textContent?.includes('足跡は右奥へ続いている'));
          const shrineBeforeForge=await verifyTracksShrineRisk(page,false);
          assert.match(await returnButton.innerText(),new RegExp('牙'+shrineBeforeForge.provisionalAfter+'）'),
            'the shrine reward is reflected in the still-available return choice');
          await walkTo(page,910,235);
          const lockedBefore=await read(page);
          const gateHint=await page.locator('#forestExploreHint').innerText();
          assert.match(gateHint,/茨の奥で何かが軋む/,'the gate first offers a sensory clue');
          assert.doesNotMatch(gateHint,/風裂きの剣|鍛冶/,'the gate must be inspected before spoiling its solution');
          await tapSite(page,'hollow');
          const locked=await read(page);
          assert(!locked.found.includes('hollow'),'unforged hero cannot claim the sealed hollow');
          assert.equal(locked.unbanked,lockedBefore.unbanked,'locked hollow grants no material');
          await page.screenshot({path:path.join(output,'pixel-forest-hollow-locked.png')});
          await page.locator('#rpgOpenResults').click();
          await page.locator('#rpgReturn').click();
          const returned=await read(page);
          assert.equal(returned.phase,'camp');
          assert.equal(returned.unbanked,0);
          assert.equal(await returnButton.isVisible(),false,'the return choice disappears after banking loot');
          assert(returned.banked>=4,'real safe return banks combat and discovery materials');
          await page.locator('#rpgForge').click();
          const forged=await read(page);
          assert.equal(forged.crafted,true);
          assert.equal(forged.banked,returned.banked-3);
          await page.screenshot({path:path.join(output,'pixel-forest-forged.png')});
          await page.locator('#rpgDepart').click();
          const second=await clearWave(page);
          assert.equal(await page.locator('#rpgPanel').isVisible(),false,'victory leaves forest playable');
          await walkTo(page,800,365);
          await tapSite(page,'traces');
          const shrineAfterForge=await verifyTracksShrineRisk(page,true);
          await walkTo(page,910,235);
          const hollowBefore=await read(page);
          await tapSite(page,'hollow');
          const unlocked=await read(page);
          assert(unlocked.found.includes('hollow'),'crafted sword opens a real revisitable discovery');
          assert(unlocked.unbanked>hollowBefore.unbanked,'hollow rewards remain at risk until return');
          await tapSite(page,'hollow');
          assert.equal((await read(page)).unbanked,unlocked.unbanked,'same-run discovery cannot duplicate materials');
          await page.screenshot({path:path.join(output,'pixel-forest-hollow-open.png')});
          await page.locator('#rpgOpenResults').click();
          await page.locator('#rpgReturn').click();
          const banked=await read(page);
          await page.reload({waitUntil:'domcontentloaded'});
          await page.waitForFunction(()=>window.CrownlessForestReadout?.().assetsReady);
          const restored=await read(page);
          assert.equal(restored.crafted,true,'actual forged weapon survives reload');
          assert.equal(restored.banked,banked.banked,'actual safely returned materials survive reload');
          assert.equal(restored.unbanked,0);
          assert.equal(await page.evaluate(()=>localStorage.getItem('crownless-expedition-v1-demo')),saveBefore,
            'action loop must preserve the main location-game save');
          report.loop={first,shrineBeforeForge,locked,returned,forged,second,shrineAfterForge,unlocked,banked,restored};
        }
        assert.deepEqual(errors,[],'no browser runtime errors');
      } catch(error) {
        await page.screenshot({path:path.join(output,'pixel-forest-failure-'+width+'.png')}).catch(()=>{});
        throw error;
      } finally { await context.close(); }
    }
    report.passed=true;
    await fs.writeFile(path.join(output,'pixel-forest-report.json'),JSON.stringify(report,null,2)+'\n');
    console.log('Pixel forest: 360/390/430px aspect + touch; real combat → discovery → return → forge → revisit → hollow → saved reload PASS');
    console.log(JSON.stringify(report,null,2));
  } finally {
    if(browser) await browser.close();
    server.kill();
  }
}
main().catch(error=>{console.error(error);process.exitCode=1;});
