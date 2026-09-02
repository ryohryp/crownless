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
const viewportCss = fs.readFileSync(path.join(root, "hearth-viewport.css"), "utf8");

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

test("住人のアクセシブル名は名前・職業・現在の生活行動を伝える", () => {
  const mira = NpcLife.snapshotAt(23).find((resident) => resident.id === "mira");
  assert.equal(HearthResidents.residentAriaLabel(mira), "ミラ、薬師、薬草を選り分け中。灰炉にいる。");
  assert.equal(HearthResidents.residentDetailLabel(mira), "薬師・薬草を選り分け中");
});

test("生活行動がない在室者は職業だけを保つ", () => {
  const resident = { name: "エドガー", role: "鍛冶屋", atHearth: true, activity: "" };
  assert.equal(HearthResidents.residentAriaLabel(resident), "エドガー、鍛冶屋。灰炉にいる。");
  assert.equal(HearthResidents.residentDetailLabel(resident), "鍛冶屋");
});

test("人物ラベルへオフスクリーンの正確な居場所を追加しない", () => {
  const marco = NpcLife.snapshotAt(7).find((resident) => resident.id === "marco");
  const detail = HearthResidents.residentDetailLabel(marco);
  assert.equal(detail, "行商人・荷支度中");
  assert.doesNotMatch(detail, /工房|市場|北の街道|酒場|自宅|宿|薬草畑|川辺/);
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

test("住人ラベルは通常は名前だけ、生活行動がある時だけ控えめな詳細を見せる", () => {
  const labelBlock = residentCss.match(/\.hearth-resident-label\s*\{([\s\S]*?)\n\}/)?.[1] || "";
  const roleBlock = residentCss.match(/\.hearth-resident-label small\s*\{([\s\S]*?)\n\}/)?.[1] || "";
  const activityBlock = residentCss.match(/\.hearth-resident\.has-activity \.hearth-resident-label small\s*\{([\s\S]*?)\n\}/)?.[1] || "";
  assert.match(labelBlock, /background:\s*linear-gradient\(/);
  assert.match(labelBlock, /min-width:\s*0;/);
  assert.doesNotMatch(labelBlock, /rgba\(8, 7, 6, \.58\)/);
  assert.match(roleBlock, /width:\s*1px;/);
  assert.match(roleBlock, /overflow:\s*hidden;/);
  assert.match(roleBlock, /clip:\s*rect\(0, 0, 0, 0\)/);
  assert.match(activityBlock, /position:\s*static;/);
  assert.match(activityBlock, /font:\s*400 8px\/1\.15 Georgia, serif;/);
  assert.match(activityBlock, /opacity:\s*\.78;/);
});

test("PC幅では住人を中央のプレイヤーから左へ分離する", () => {
  assert.match(viewportCss, /@media \(min-width: 901px\)[\s\S]*?#hub-screen \.hearth-scene--empty-room \.hearth-character\s*\{[\s\S]*?left:\s*47%;/);
  assert.match(viewportCss, /@media \(min-width: 901px\)[\s\S]*?#hub-screen \.hearth-resident-layer\s*\{[\s\S]*?left:\s*32%;/);
});

test("スマホ幅でも住人をプレイヤーと同じX座標に置かない", () => {
  assert.match(viewportCss, /@media \(max-width: 700px\)[\s\S]*?#hub-screen \.hearth-scene--empty-room \.hearth-character\s*\{[\s\S]*?left:\s*46%;/);
  assert.match(viewportCss, /@media \(max-width: 700px\)[\s\S]*?#hub-screen \.hearth-resident-layer\s*\{[\s\S]*?left:\s*24%;/);
});

test("中間幅では住人をプレイヤーと門の間の空き床へ置く", () => {
  assert.match(viewportCss, /@media \(min-width: 701px\) and \(max-width: 900px\)[\s\S]*?#hub-screen \.hearth-resident-layer\s*\{[\s\S]*?left:\s*44%;/);
});
