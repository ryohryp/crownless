const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const controllerPath = path.join(__dirname, '..', 'src', 'reboot-phase2-controller.js');
const controller = fs.readFileSync(controllerPath, 'utf8');

test('Phase 2 location check gives immediate visible feedback and prevents duplicate requests', () => {
  assert.match(controller, /locationRequestInFlight/);
  assert.match(controller, /phase2Live\.disabled = busy/);
  assert.match(controller, /aria-busy/);
  assert.match(controller, /現在地を確認しています…/);
  assert.match(controller, /現在地を確認している。安全な場所でそのまま少し待つ。/);
  assert.match(controller, /if \(locationRequestInFlight\) return;/);
});

test('Phase 2 delegates failure recovery to the shared location reader', () => {
  assert.match(controller, /CrownlessRebootLocation\.request/);
  assert.match(controller, /CrownlessRebootSession\.locationErrorMessage/);
});

test('Phase 2 location result always tells the player whether discovery happened or more walking is needed', () => {
  assert.match(controller, /result\.status === 'discovered'/);
  assert.match(controller, /古い渡り場を発見した/);
  assert.match(controller, /result\.status === 'anchored'/);
  assert.match(controller, /まだ古い渡り場には届いていない/);
  assert.match(controller, /observeOldCrossingLocation\(session, state, position\.coords\)/);
});
