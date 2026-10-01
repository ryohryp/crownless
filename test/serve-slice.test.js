'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const { createSliceServer } = require('../scripts/serve-slice.cjs');

function getStatus(port, uri) {
  return new Promise((resolve, reject) => {
    const request = http.get({ host: '127.0.0.1', port, path: uri, agent: false }, response => {
      response.resume();
      response.once('end', () => resolve(response.statusCode));
    });
    request.once('error', reject);
  });
}

test('serve-slice loopback server correctly allows playable slice assets', async () => {
  const server = createSliceServer();
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  const port = server.address().port;

  try {
    assert.equal(await getStatus(port, '/expedition.html'), 200);
    assert.equal(await getStatus(port, '/phone-density.css'), 200);
    assert.equal(await getStatus(port, '/exploration-atlas.css'), 200);
    assert.equal(await getStatus(port, '/src/slice-app.js'), 200);
    assert.equal(await getStatus(port, '/src/hidden-shortcut-ui.js'), 200);
    assert.equal(await getStatus(port, '/src/return-postcard-ui.js'), 200);
    assert.equal(await getStatus(port, '/package.json'), 404);
    assert.equal(await getStatus(port, '/../package.json'), 404);
  } finally {
    await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    server.closeAllConnections?.();
    server.unref();
  }
});
