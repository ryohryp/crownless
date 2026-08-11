const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.join(__dirname, "..");
const runtimeSource = fs.readFileSync(path.join(root, "src", "app-runtime-state.js"), "utf8");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");

test("app runtime globals are initialized before app.js", () => {
  const context = {
    localStorage: {
      getItem(key) {
        assert.equal(key, "crownless.sound");
        return "off";
      }
    }
  };
  vm.createContext(context);
  vm.runInContext(runtimeSource, context);

  assert.equal(context.lastReturnReport, null);
  assert.equal(context.soundEnabled, false);
  assert.equal(context.audioContext, null);

  const runtimeIndex = html.indexOf('src/app-runtime-state.js');
  const appIndex = html.indexOf('src/app.js');
  assert.ok(runtimeIndex >= 0, "runtime state script must be included");
  assert.ok(runtimeIndex < appIndex, "runtime state script must load before app.js");
});
