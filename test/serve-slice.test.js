'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const { createSliceServer } = require('../scripts/serve-slice.cjs');

test('serve-slice loopback server correctly allows playable slice assets', async () => {
  const server = createSliceServer();
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const port = server.address().port;

  try {
    const get = uri => fetch(`http://127.0.0.1:${port}${uri}`).then(response => response.status);
    assert.equal(await get('/expedition.html'), 200);
    assert.equal(await get('/phone-density.css'), 200);
    assert.equal(await get('/exploration-atlas.css'), 200);
    assert.equal(await get('/src/slice-app.js'), 200);
    assert.equal(await get('/src/hidden-shortcut-ui.js'), 200);
    assert.equal(await get('/src/return-postcard-ui.js'), 200);
    assert.equal(await get('/package.json'), 404);
    assert.equal(await get('/../package.json'), 404);
  } finally {
    await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  }
});
