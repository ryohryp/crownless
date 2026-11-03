# 冒険者A：8コマ歩行の調査と次回制作手順（2026-11-03）

状態：**調査結果 / 未実装の制作計画**。画像生成、ゲーム反映、Canon変更はこの文書では行わない。

## 判明した問題

1. 8枚の「人物画」が揃っていても歩行サイクルとは限らない。失敗候補では、1対5の接地脚の前後関係や、4→5・8→1の連続性、左右の腕振りが安定しない。フレームの重複検出だけでは判定できない。
2. `docs/visual/CHARACTER_VISUAL_CANON.md` は色分け8ポーズダミーの **gait/timing** のみ承認済みと記す。一方、`scripts/adventurer-a-walk/pose_study.py` と `pose_study_ik.py` は **元の承認済み素体が利用不可** と明記する。現行リポジトリのmainとPR #1060のファイル一覧にも当該元画像を特定できなかった。既存のIK/OpenPose図は新たに作った**未承認の近似**であり、元の承認済み画像ではない。
3. 過去の手描き形状パペット候補 `adventurer-a-handcluster-v1` は見た目と歩き方で却下済み。ピクセル技術チェック通過を受け入れ判定と混同しない。画像生成した人物画の縮小・量子化だけで「ネイティブ手打ちドット」とは言わない。

## 外部一次資料

- SLYNYRD, *Pixelblog 50 — Human Walk Cycle* (2024): 実写を8キーポーズへ整理し、色分けダミーを経て作画。4/6/8フレーム比較と、対向腕・上下動。https://www.slynyrd.com/blog/2024/5/24/pixelblog-50-human-walk-cycle
- SLYNYRD, *Pixelblog 55 — Top Down Character Animation* (2025): 斜め上からの3/4 RPG視点では向きによる見かけの長さ、頭の上下動、肩と装備の連続性を確認。https://www.slynyrd.com/blog/2025/3/24/pixelblog-55-top-down-character-animation
- Toon Boom, *Walk Analysis*: 2回の逆向き接地と、Passing / Down / Upの身体運動。https://learn.toonboom.com/modules/walk-cycle-animation2/topic/walk-analysis
- Monmouth University, *Movement: Walk Cycle*: まず両側Contact、次にPassing、Down、Up。表示サイクルの末尾に1コマ目の複製を二重再生しない。https://animation.monmouth.edu/instruct/animation/walk-cycle/
- Manning Leonard Krull, *Walking animation for low-res sprites*: 明るい手前脚と暗い奥脚を区別、片脚8ポーズを作り4フレーム位相差でもう片脚へ適用する技法。https://manningkrull.com/__pixel-art/walking.php
- Pixelorama公式 *Timeline* と *Save and Export*: レイヤー/セル、オニオンスキン、フレーム時間、.pxo保存とGIF/PNG出力を備える。https://pixelorama.org/user_manual/user_interface/timeline/ および https://pixelorama.org/user_manual/save_and_export/

## 最小の制作工程

1. **正本と画角の固定**：`docs/assets/adventurer-a-approved-anchor-v1.png` で人物の同一性、`CHARACTER_VISUAL_CANON.md` で3〜3.5頭身・右向き斜め3/4。制作対象はこの1方向だけ。採用済みの元ダミー画像が発見されない限り、その画像を「再利用済み」とは表現しない。
2. **素体の接地A/Bだけ先に作る**：等しい歩幅（現在の短い歩幅を基準）、同じ足元基準、奥/手前が逆になる2つのContact。肩・股関節・膝・足首・手首のジョイント、手前/奥の定義、骨長、足先の向き、支持脚を明記する。二枚を人間が比較するまでは次へ進まない。
3. **8ポーズを作る**：`Contact A → Down A → Passing A → Up A → Contact B → Down B → Passing B → Up B`。フレーム1/5は脚と腕の前後関係が逆。4/8は次の接地を予告し、そこから5/1へ飛ばない。腕を脚と逆位相にする（拳が前に居続けることは禁止）。
4. **先に単色で運動の審査**：足裏、膝、股関節、肩、拳、頭頂/骨盤の高さを比較。支持脚はゲーム内ワールド座標で接地中静止、in-placeプレビューではルートの移動に応じて見かけ上後退する。脚は地面を貫通しない。右向き3/4なので奥脚は短く暗く見えるが、関節長はポーズ間で変えない。
5. **動きが合格してから作画**：Pixeloramaで元絵の見た目を参照し、奥脚→奥腕→胴体/コート→手前脚→手前腕→髪/剣など適切な前後レイヤーに、各コマに対応する独立したピクセルを描く。布や剣の遅れは少量に。奥の腕・脚・コートは暗く、手前を明るくし、光源方向は全コマで固定。却下パペットの画像をそのまま衣装化しない。
6. **既存レビュー経路で検証**：`docs/visual/adventurer-a-walk-review.html` と `scripts/adventurer-a-walk/pixel-atlas-review.js` を利用。現状のレビュー契約はネイティブ128×192、4または8フレーム、64色以下、二値アルファ。Pixelorama編集ソース `.pxo` と、ゲーム候補の透過PNG、ChatGPT用の8コマ・無限ループGIFを別用途で出力（ユーザーへの表示はGIFのみ）。
7. **視覚レビューは必須**：8フレームが異なる・GIFが開く・色数が条件以内、だけで合格にしない。モーション、キャラ同一性、スマホ実寸の視認性を確認し、明示的な承認があるまでruntime/Canonへ反映しない。

## 推奨初期パラメータ（仮説であり外部資料の規格値ではない）

- 8コマ・8fps（1周1.0秒）で初期確認し、動きの評価後に10fpsも比較。短い自然な歩幅を保持し、速度を上げるためだけに極端な開脚にしない。
- フレーム時間はまず均等。右腕が前に出るコマだけ長くしない。モーション成立後に微調整。
- 人物/コート/剣の固有特徴は承認アンカーを維持。カメラ、原点、地面線、拡大率、光源、影の前後規則は全コマ固定。
- 見た目の似た8枚を一度に生成する方式は停止。**接地A/B合格 → 8ポーズ素体合格 → 8コマ衣装作画** の3つの段階でレビューする。

## 受け入れ条件

- [ ] 接地1と5で手前/奥の支持脚が実際に交換され、歩幅が揃う
- [ ] 1→2→3→4→5→6→7→8→1で脚と腕の位相が連続し、同じ腕の前方停滞がない
- [ ] 接地位置、一定の骨長、足先の向き、床との接触を確認
- [ ] Downで骨盤が下がり、Passing/Upで持ち上がる（頭の跳ねは自然な範囲）
- [ ] 近遠の前後関係・陰影・服装/髪/剣・視点・原点が全フレームで一貫
- [ ] 128×192のネイティブPNG 8コマで、二値アルファ・64色以下・全コマ非空/非重複
- [ ] Pixelorama編集ソースで開け、8コマGIFでループ検査、スマホ実寸で人間レビュー
- [ ] 明示的承認まで Draft / runtime未採用
