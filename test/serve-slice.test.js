'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const path = require('node:path');

const sliceServer = require('../scripts/serve-slice.cjs');

test('serve-slice loopback server correctly allows playable slice assets', async () => {
  const server = sliceServer.listen(0, '127.0.0.1');
  await new Promise((resolve, reject) => {
    server.once('listening', resolve);
    server.once('error', reject);
  });

  try {
    const { port } = server.address();
    const get = uri => new Promise((resolve, reject) => {
      http.get(`http://127.0.0.1:${port}${uri}`, res => {
        res.resume();
        resolve(res.statusCode);
      }).on('error', reject);
    });

    assert.equal(await get('/expedition.html'), 200);
    assert.equal(await get('/phone-density.css'), 200);
    assert.equal(await get('/exploration-atlas.css'), 200);
    assert.equal(await get('/src/slice-app.js'), 200);
    assert.equal(await get('/src/hidden-shortcut-ui.js'), 200);
    assert.equal(await get('/src/return-postcard-ui.js'), 200);
    assert.equal(await get('/package.json'), 404);
    assert.equal(await get('/../package.json'), 404);
  } finally {
    await new Promise((resolve, reject) => {
      server.close(error => error ? reject(error) : resolve());
    });
  }
});
