const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const N = require("../src/neighborhood.js");
const art = require("../src/map-pixel-art.js");

test("shop and event have different real pixel silhouettes in the ink palette", () => {
  for (const kind of ["shop", "event"]) {
    assert.equal(art.PIXELS[kind].length, 12);
    assert(art.PIXELS[kind].every(row => row.length === 12 && /^[.kwv]+$/.test(row)));
    assert.match(art.sprite(kind), /shape-rendering="crispEdges"/);
    assert.match(art.sprite(kind), /#373530/);
    assert.match(art.sprite(kind), /#995b4d/);
  }
  assert.notEqual(art.sprite("shop"), art.sprite("event"));
  assert.equal(art.sprite("unregistered"), "");
});
test("pixel landmarks load before map app and preserve existing district controls", () => {
  const html = fs.readFileSync("expedition.html", "utf8");
  assert(html.indexOf('src/map-pixel-art.js"') > -1);
  assert(html.indexOf('src/map-pixel-art.js"') < html.indexOf('src/slice-app.js"'));
  const app = fs.readFileSync("src/slice-app.js", "utf8");
  assert.match(app, /data-poi-family/);
  assert.match(app, /data-action="district"/);
  assert.match(app, /CrownlessMapPixelArt\?\.sprite/);
  const css = fs.readFileSync("neighborhood.css", "utf8");
  assert.match(css, /image-rendering:pixelated/);
});
test("the existing district identity chooses the displayed POI; no added save keys", () => {
  const event = N.pointOfInterest({id:"0,1",x:0,y:1,biome:"tower"});
  const shop = N.pointOfInterest({id:"0,2",x:0,y:2,biome:"tower"});
  assert.equal(event.family, "event");
  assert.equal(shop.family, "shop");
  assert.equal(event.name, "鳴らない鐘の刻");
  assert.equal(shop.name, "鐘守の鍛冶台");
  assert.equal(N.pointOfInterest({...N.initial().districts[0]}).family, "event");
});
