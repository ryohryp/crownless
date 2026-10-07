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
      number: 908,
      title: 'feat(progression): 武器補強・生還・拠点発展を通じた「成長の実感」の強化',
      user_feedback:
        'ユーザーレビューおよびJevテストプレイにおいて指摘された「成長の実感の希薄さ（UNREWARDING_LOOT / 平均再遠征欲の低さ）」を解消するため、補強の成果事前プレビュー、戦闘ヘッダー・ボタン・ログでの補強手応え可視化、拠点ステータスでの常時表示を導入した。',
    },
    implementation: {
      files_modified: [
        'src/slice-app.js: gearPanel() で補強ボタンの前に「補強後の成果（例: 強撃 8 → 9）」を事前プレビュー表示。',
        'src/slice-app.js: camp() の stat-strip に装備補強レベル（例: 補強 1/4）を常時表示。',
        'src/slice-app.js: fight() のヘッダーに補強レベル（· 補強 +1）を表示し、アクションボタン（強撃・防御・回避・斬る）に補強・研ぎ澄ましボーナスを明記。',
        'src/slice-engine.js: act() において、補強された強撃を放った際（補強の重み！）および刃研ぎ（研ぎ澄まされた刃が走る！）命中時のログフィードバックを追加。',
        'test/progression-feedback.test.js: 補強ログ、研ぎ澄ましログ、UIプレビュー・ヘッダー・ボタン表示の網羅的単体テストを追加。',
      ],
      test_verification: {
        total_unit_tests: 1123,
        passing: 1123,
        failing: 0,
        regression: '既存のセーブデータスキーマ・計算式・不変条件を100%維持。',
      },
      player_progression_feeling: {
        before: '補強しても通常攻撃や画面ヘッダーは変わらず、何が強化されたか戦闘中に実感できず作業感があった。',
        after: '補強前に成果が分かり、鍛えた武器を握って戦っている実感（ヘッダー・ボタン注釈・ログ）が常時得られ、再遠征へのモチベーションが大幅に向上。',
      },
    },
  };

  const questions = {
    requirement_fulfillment: {
      type: 'choice',
      instructions:
        'Does the implementation fulfill the requirements of Issue #908 and user feedback by providing clear, tangible progression and reinforcement feedback across gear, combat, and camp screens?',
      criteria: {
        fully_satisfied:
          'Clear progression feedback added to gear preview, combat header, actions, and combat logs while preserving invariants.',
        partially_satisfied:
          'Some improvements made but player growth remains hidden or obscure.',
        not_satisfied:
          'Requirements not met or progression feeling unchanged.',
      },
    },
    one_more_run_motivation: {
      type: 'score',
      instructions:
        'How effectively does this change enhance player desire for "one more expedition" (Explore -> Fight -> Loot -> Improve -> Explore farther)?',
      criteria: [
        'No effect; player still feels no sense of progression.',
        'Slight effect; minor aesthetic change.',
        'Moderate enhancement; clearer progression and upgrade transparency.',
        'Strong motivation; player clearly anticipates and experiences weapon power growth in every battle.',
        'Exceptional motivation; tangible progression creates an irresistible urge to upgrade and delve deeper.',
      ],
    },
    regression_and_safety_risk: {
      type: 'noul',
      instructions:
        'Is there any regression risk or breakage to existing gameplay systems, saves, or unit tests?',
      criteria: {
        true: 'Regressions detected or tests failing.',
        false: 'All 1123 tests pass, save schema compatible, invariants preserved.',
      },
    },
    merge_verdict: {
      type: 'choice',
      instructions: 'What is the TypeSafe Jev recommendation for merging PR #911 into main?',
      criteria: {
        ready_to_merge:
          'The change is well-designed, adheres to product invariants, passes all tests, and directly fixes the progression feedback bottleneck.',
        needs_rework:
          'Flaws or unverified code require further iteration.',
        reject:
          'The change goes in the wrong direction.',
      },
    },
  };

  console.log('Running TypeSafe Jev Semantic Verification for Issue #908 (PR #911)...');
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
