# 実装計画: Issue #897 スマホUIの是正

## 目的と背景
テストプレイとTypeSafe Jevによる検証によって判明した、スマートフォン（360〜430px Viewport）での重大なUI欠陥（P0）を是正する。
AGENTS.mdの「1画面＝1ビューポート」「親指で快適に操作できる」「戦闘中に必要な情報を隠さない」という原則を徹底する。

## 是正項目と変更箇所

### 1. 戦闘ボタンの補足戦術情報の再可視化
- **ファイル**: `phone-density.css`, `src/slice-app.js`
- **問題**: `.combat-choice-grid .choice small` と `.combat-foot .choice small` が `display: none` になっており、防御の軽減量、回避の被弾半減/追撃、薬草の敵ターン消費が見えない。
- **解決方針**:
  - `phone-density.css` で `display: none` を解除。
  - 省スペースな1〜2行のコンパクトなチップスタイル（`font-size: 9.5px; line-height: 1.25;`）を適用し、高さを抑えつつ戦術情報を提示。

### 2. 敵行動予兆テキストの折り返し表示
- **ファイル**: `phone-density.css`
- **問題**: `.intent small` が `white-space: nowrap; text-overflow: ellipsis;` に設定されており、最も重要な対策指示文が途中で「...」と切断される。
- **解決方針**:
  - `white-space: normal; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;` を設定し、2行まで確実に読めるようにする。

### 3. 遠征中の設定・効果音アクセス改善
- **ファイル**: `src/slice-app.js`, `src/journey-settings-ui.js`, `phone-density.css`
- **問題**: モバイルではヘッダー・フッターが非表示になるため、遠征中に「効果音」や「遊び方」へアクセスできない。
- **解決方針**:
  - 遠征画面のヘッダー・シーン上部（`.scene-top` 付近または右上のステータス部）に `data-action="settings"` のコンパクトなボタン（⚙ 設定 / 音）を設置。
  - タップすると既存の旅の設定モーダル（`#help`）が開き、遠征中でも効果音のON/OFFや遊び方の確認、画面モードの切り替えが可能になるようにする。

### 4. 帰還画面・出撃画面のスクロール抑制
- **ファイル**: `phone-density.css`
- **問題**: 帰還画面（`.report-panel`）で下部のアクションボタンがビューポート外に押し出され、余計な縦スクロールが発生している。
- **解決方針**:
  - コンテンツ領域の余白・行間を適正化し、ボタンが常時画面内に収まるように調整。

## 検証方法
1. `npm test`（既存1,114件のテストが全通過すること）
2. `npm run playtest:browser`（高速Jevブラウザ検証で遠征・戦闘フローが正常動作すること）
3. TypeSafe Jevによるセマンティック検証の実施
