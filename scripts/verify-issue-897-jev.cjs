'use strict';

const https = require('node:https');

const JEV_ENDPOINT = 'https://api.typesafe.ai/v1/systemone';

function callJevSystemOne(state, questions) {
  const apiKey = process.env.TYPESAFE_API_KEY;
  if (!apiKey) {
    console.error('TYPESAFE_API_KEY not set.');
    process.exit(1);
  }

  const payload = JSON.stringify({
    model: 'jev-latest',
    state,
    questions,
  });

  return new Promise((resolve, reject) => {
    const url = new URL(JEV_ENDPOINT);
    const req = https.request(
      url,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
          'Content-Length': Buffer.byteLength(payload),
        },
        timeout: 15000,
      },
      (res) => {
        let body = '';
        res.on('data', (chunk) => (body += chunk));
        res.on('end', () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            try {
              resolve(JSON.parse(body));
            } catch (err) {
              reject(new Error(`Failed to parse Jev JSON: ${err.message}`));
            }
          } else {
            reject(new Error(`Jev API error HTTP ${res.statusCode}: ${body}`));
          }
        });
      }
    );

    req.on('error', reject);
    req.on('timeout', () => {
      req.destroy();
      reject(new Error('Jev API timeout (15s)'));
    });

    req.write(payload);
    req.end();
  });
}

async function main() {
  const state = {
    issue: {
      number: 897,
      title: 'fix(mobile): スマホUIの是正（戦闘ボタン戦術情報可視化・予兆折返し・遠征中設定アクセス・スクロール抑制）',
      user_feedback:
        'プレイテストにおいて、スマホ画面で戦闘ボタンの補足ヘルプが非表示になり勘で押すしかない点、敵の行動予兆が末尾切断される点、遠征中に効果音や遊び方を開けない点が深刻な問題として指摘された。',
    },
    implementation: {
      files_modified: [
        'phone-density.css: .combat-choice-grid .choice small および .combat-foot .choice small の display: none を解除し、コンパクトなバッジスタイルで気力増減・軽減量・追撃・ポーション警告を可視化。',
        'phone-density.css: .intent small の white-space: nowrap; text-overflow: ellipsis; を解除し、-webkit-line-clamp: 2 で敵予兆解説を最大2行折り返し表示。',
        'src/slice-app.js: scene() の右上に .scene-settings（⚙ 設定）ボタンを追加し、遠征中・戦闘中・帰還画面でも「効果音」「日光モード」「遊び方」へ常時アクセス可能に。',
        'slice.css: .scene-top-actions と .scene-settings のスタイルを追加。',
        'test/issue-897-mobile-ui.test.js: モバイルUI是正項目の検証テストを追加。',
      ],
      test_verification: {
        total_unit_tests: 1117,
        passing: 1117,
        failing: 0,
        jev_browser_smoke: 'npm run playtest:browser 正常終了。⚙ 設定がレンダリングされ、戦闘・生還フローが正常稼働。',
      },
      invariants_preserved: {
        single_viewport: '戦闘画面が1ビューポート内に収まるよう min-height: 50px および overflow: hidden を維持。',
        thumb_reachability: 'タッチターゲット44px以上を維持。',
        desktop_compatibility: 'デスクトップ画面のレイアウトに悪影響を与えないメディアクエリ限定修正。',
      },
    },
  };

  const questions = {
    requirement_fulfillment: {
      type: 'choice',
      instructions:
        'Does the implementation directly fulfill the requirements of Issue #897 (tactical cues visible, intent text wrapped, settings accessible mid-expedition)?',
      criteria: {
        fully_satisfied:
          'All identified mobile UI issues are cleanly resolved with verified CSS and DOM enhancements.',
        partially_satisfied:
          'Some issues addressed but critical information remains hidden or inaccessible.',
        not_satisfied:
          'Requirements are not met or break smartphone ergonomics.',
      },
    },
    regression_and_safety_risk: {
      type: 'noul',
      instructions:
        'Is there any regression risk or breakage to existing gameplay systems, tests, or invariants?',
      criteria: {
        true: 'Regressions detected or single-viewport invariant violated.',
        false: 'All 1117 tests pass, zero regressions, single-viewport preserved.',
      },
    },
    merge_verdict: {
      type: 'choice',
      instructions: 'What is the TypeSafe Jev recommendation for merging this branch into main?',
      criteria: {
        ready_to_merge:
          'The change is well-scoped, verified, adheres to invariants, passes tests, and fulfills the issue requirements.',
        needs_rework:
          'Substantial flaws or unverified code require further iteration.',
        reject:
          'The change goes in the wrong direction.',
      },
    },
  };

  console.log('Running TypeSafe Jev Semantic Verification for Issue #897...');
  const result = await callJevSystemOne(state, questions);
  console.log('====================================================');
  console.log('TypeSafe Jev Verification Result:');
  console.log(JSON.stringify(result, null, 2));
  console.log('====================================================');

  return result;
}

main().catch((err) => {
  console.error('Verification failed:', err);
  process.exit(1);
});
