# タスク管理: Issue #897 スマホUIの是正

- [x] **1. 戦闘ボタン補足情報のモバイル可視化・最適化** <!-- id: task-combat-buttons -->
  - `phone-density.css` で `display: none` になっている `.combat-choice-grid .choice small` と `.combat-foot .choice small` を再有効化
  - 1画面1ビューポートに収まるコンパクトなバッジ/チップスタイル（軽減量・気力・追撃情報）へ調整
- [x] **2. 敵行動予兆テキストの折り返し表示改善** <!-- id: task-intent-text -->
  - `phone-density.css` の `.intent small` の `white-space: nowrap; text-overflow: ellipsis;` を解消
  - 最大2行の折り返し表示（`-webkit-line-clamp: 2`）にし、対策ガイダンスを完全に可視化
- [x] **3. 遠征中の設定（効果音・日光モード・遊び方）アクセス提供** <!-- id: task-settings-access -->
  - 遠征画面（`.scene-top` 付近または上部ステータスバー）に、コンパクトな「⚙ 設定」トグルを配置
  - スマホで `.masthead` や `.footer` が非表示でも、遠征中に設定モーダルを開閉・効果音ON/OFF可能にする
- [x] **4. スクロール抑制とビューポート収まりの微調整** <!-- id: task-viewport-tuning -->
  - 帰還画面（`.report-layout`）および出撃画面でのアクションボタンが確実にファーストビューに収まるようパディング等を調整
- [x] **5. テスト検証とTypeSafe Jevセマンティック評価** <!-- id: task-verification -->
  - ユニットテスト (`npm test`) の実行（1117件全通過）
  - 高速Jevブラウザ検証 (`npm run playtest:browser`) の実行（正常終了）
  - TypeSafe Jev セマンティック検証の実行（ready_to_merge 99%）

