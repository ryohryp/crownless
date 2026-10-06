# Crownless Visual Canon

Crownless の現在の playable slice で使う**唯一の全体Visual Canon**。

`docs/visual/` はキャラクター、世界方向、画像生成、制作パイプラインなどの専門資料であり、この文書と `AGENTS.md` / accepted ADR / `gameplay-spec.md` に従う。古いVisual Design Guideの版番号を新しい判断の根拠にしない。

この文書は「将来の完成アート」を決めるものではない。まず現在のコアループを実際に遊びながら、画面ごとの世界観と判断材料がぶれないための基準を固定する。

## Canon image

現時点の第一Visual Canonは、Playable Slice の **探索地図＋遠征シーン**。

実装上の正本は以下。

- `src/slice-art.js` — 霧、森、塔、湿原、廟、旅人、敵、装備差を1つのSVG言語で描く
- `src/slice-app.js` — 探索地図、未発見領域、発見地点、遠征への導線
- `slice.css` — dark / muted green / aged gold を中心としたスマートフォン向けUI

これらは既に最小Playable Sliceで使用中であり、Visual Canonのためだけに別の完成画像を重複生成しない。

## Visual thesis

Crownless は **living medieval manuscript / woodcut / field map** が遊べる世界として見えることを狙う。

- rough hand-inked line, restrained hatching, worn material, imperfect stamp/mark
- unknown = ink / ash / fog
- discovered = restrained blue-green and local natural color
- danger = muted vermilion
- home / secured progress = ember warmth
- exceptional significance = small aged-gold / ochre accents
- glossy fantasy chrome, photoreal AAA rendering, anime-gacha rarity framing, neon magicを全体言語にしない

画面は原則 **one large spatial/illustrated surface + one primary focal action + restrained annotations**。装飾よりphone-sizeの判断性を優先する。

### Character calibration

現行combat actorを扱う場合は `visual/CHARACTER_VISUAL_CANON.md` のApproved Visual Anchorとruntime acceptanceを使う。キャラクター比率やbattlefield cameraを全体Visual Canonから推測しない。現在のactor系はcompact folk-art silhouetteを基準とし、旧4–5 heads guideへ戻さない。

### Gameplay lock

Visual資料は操作方式を決めない。戦闘・探索・Hearthの挙動は `AGENTS.md` と `gameplay-spec.md` が正本。

- 現在は短いtactical encounterと明確な選択を視覚的に支える
- 旧manual movement / stop-to-auto-strike / Technique / Evade前提を新規画面へ持ち込まない
- 旧dispatch/wait/report UIをHearthの必須構造として復活させない
- Visualは地域武具、開拓拠点、陣取り履歴、冒険録が「次へ行きたい理由」として読めることを優先する

## Tone

### World

- 中世ダークファンタジー
- 深い青緑、灰緑、古びた金を基調にする
- 高彩度のrarity色や派手なネオン表現は避ける
- 霧・遠景・余白で「まだ知らない土地」を感じさせる
- UIは豪華さより読みやすさと静かな緊張感を優先する

### Exploration

地図は現実の道路地図ではなく、**プレイヤーが発見した架空世界の記録**として見せる。

- 未発見は霧で隠す
- 発見済み地点は少数の明確なmarkerで示す
- 現実の正確な座標、住所、移動軌跡は描かない
- 画面を見続けながら歩くことを要求しない
- phone-sizeで「次に遠征できる場所」が一目で分かることを優先する

### Expedition / Combat

- 同じ土地の色調とランドマークを維持し、地図と遠征が同じ世界に見えるようにする
- 旅人と装備はシルエットでも違いが分かること
- 敵は種類やelite特性の判断をUIと合わせて読み取れること
- 戦闘演出より enemy intent / HP / 気力 / 選択肢の可読性を優先する

### Loot / Equipment

- 装備は単なるrarity色ではなく、形と戦闘特性で差を出す
- 大量のアイコン生成を先行しない
- プレイヤーが実際に「比べたい」と感じる装備だけ、必要に応じて個別素材を追加する

## Current reusable motifs

現在の実装で再利用してよい基準モチーフ。

- 霧に沈む山並み
- 古い塔
- 焚き火
- 針葉樹と湿地
- 廃墟・廟
- muted green / charcoal / aged gold
- 細い線と簡略化したvector silhouette
- 装備で変化する旅人のシルエット

新しい画面を作るときは、この語彙から外れる理由がない限り同じ表現を使う。

## Asset inventory after playable review

現時点で優先して追加生成すべき大量素材はない。

次に個別素材を追加する条件は、実プレイで以下の不足が確認された場合だけ。

1. 地図上で地点の違いが判別しにくい
2. 遠征シーンで土地の違いが弱い
3. 装備変更が見た目で分からない
4. elite / boss を見た瞬間の期待感が弱い
5. Lootを拾った瞬間の喜びがUIだけでは足りない

追加する場合も、まず1点だけ作って実機で確認する。武器・敵・防具の大量生成はしない。

## Keep / Change / Kill

### Keep

- 現在のSVGベースの軽量表現
- 地図と遠征で共通する青緑・霧・古金のトーン
- スマートフォンで情報を優先するレイアウト
- 装備差を旅人のシルエットへ反映する方向

### Change when validated

- 地点や敵の識別が弱い場合のみ、個別のvisual cueを増やす
- Lootの喜びが不足する場合のみ、報酬表示へ固有ビジュアルを足す

### Kill / avoid

- playable確認前の素材大量生成
- rarity色だけで価値を伝えるUI
- 現実地図のコピー
- 装飾のために判断情報を隠す演出
- 既存Canonと別方向の画風を画面ごとに増やすこと

## Review rule

新しい素材や画面を追加する前に、

> 15分遊んだあと、もう1回遠征したくなる判断を強くするか？

を確認する。

答えが弱い場合、素材を増やすより gameplay loop の改善を優先する。
