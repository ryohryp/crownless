# タスク管理: Issue #899 ADR-0009 作成

- [x] **1. ADR-0009 の執筆** <!-- id: task-adr-write -->
  - `docs/adr/0009-smartphone-combat-viewport-and-tactical-density.md` を作成
  - スマホUIでの戦術情報完全可視化、意図テキスト折り返し、遠征中設定アクセスの原則を明文化
- [x] **2. テスト検証** <!-- id: task-test -->
  - `npm test` による全テスト通過確認（1117件全通過）
- [x] **3. TypeSafe Jev セマンティック検証とマージ** <!-- id: task-jev-merge -->
  - `scripts/verify-adr-0009-jev.cjs` を実行し、ADR要件充足度・無矛盾性を評価（ready_to_merge 93%）
  - PR作成、マージ、ブランチ整理
