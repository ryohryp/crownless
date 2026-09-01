const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const NpcLife = require("../src/npc-life.js");
const HearthResidents = require("../src/hearth-resident-presence.js");

const root = path.join(__dirname, "..");
const indexHtml = fs.readFileSync(path.join(root, "index.html"), "utf8");
const presentationSource = fs.readFileSync(path.join(root, "src", "hearth-resident-presence.js"), "utf8");
const residentCss = fs.readFileSync(path.join(root, "hearth-residents.css"), "utf8");

test("23時台は灰炉にいるミラだけを人物表示対象にする", () => {
  const residents = HearthResidents.presentResidents(NpcLife.snapshotAt(23));
  assert.deepEqual(residents.map((resident) => resident.name), ["ミラ"]);
});

test("7時台は灰炉にいるマルコだけを人物表示対象にする", () => {
  const residents = HearthResidents.presentResidents(NpcLife.snapshotAt(7));
  assert.deepEqual(residents.map((resident) => resident.name), ["マルコ"]);
});

test("在室者がいない時間帯は人物を描画しない", () => {
  const residents = HearthResidents.presentResidents(NpcLife.snapshotAt(9));
  assert.deepEqual(residents, []);
});

test("住人のアクセシブル名は名前・職業・在室状態を伝える", () => {
  const mira = NpcLife.snapshotAt(23).find((resident) => resident.id === "mira");
  assert.equal(HearthResidents.residentAriaLabel(mira), "ミラ、薬師。灰炉にいる。");
});

test("Grey HearthはNPC生活presentationの後に人物レイヤーを読み込む", () => {
  const hearthPresentation = indexHtml.indexOf('<script src="src/hearth-presentation.js"></script>');
  const residentPresentation = indexHtml.indexOf('<script src="src/hearth-resident-presence.js"></script>');
  assert.ok(hearthPresentation >= 0);
  assert.ok(residentPresentation > hearthPresentation);
});

test("人物レイヤー更新は既存DOMを置換し、常駐タイマーを追加しない", () => {
  assert.match(presentationSource, /resident && resident\.atHearth/);
  assert.match(presentationSource, /layer\.replaceChildren\(\.\.\.nodes\)/);
  assert.match(presentationSource, /MutationObserver/);
  assert.doesNotMatch(presentationSource, /setInterval\s*\(/);
});

test("人物はゲームオブジェクトより背面に置き、reduced motionを尊重する", () => {
  assert.match(residentCss, /\.hearth-resident-layer\s*\{[\s\S]*?z-index:\s*4;/);
  assert.match(residentCss, /pointer-events:\s*none;/);
  assert.match(residentCss, /@media \(prefers-reduced-motion: reduce\)/);
  assert.match(residentCss, /\.hearth-resident \{ animation: none !important; \}/);
});
