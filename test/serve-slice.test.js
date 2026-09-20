'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const { spawn } = require('node:child_process');
const path = require('node:path');

test('serve-slice loopback server correctly allows playable slice assets', async () => {
  const port = 4188;
  const scriptPath = path.join(__dirname, '..', 'scripts', 'serve-slice.cjs');
  const child = spawn(process.execPath, [scriptPath], {
    env: { ...process.env, PORT: String(port) },
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  try {
    await new Promise((resolve, reject) => {
      child.stdout.on('data', data => {
        if (data.toString().includes('Crownless playable slice')) resolve();
      });
      child.on('error', reject);
      setTimeout(() => reject(new Error('Server start timed out')), 4000);
    });

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
    child.kill();
  }
});
