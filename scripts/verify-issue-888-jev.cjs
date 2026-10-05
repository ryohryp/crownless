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
      number: 888,
      title: 'feat: 旅と開拓の位置情報RPG（実在地物の陣取り・開拓・ご当地武具収集・冒険録）のコア基盤実装',
      user_feedback:
        '「本当は位置ゲーとして場所を取り合ったり、ご当地のアイテムを収集したりしたい。あとは訪れた土地を開拓する感じも欲しい。実際の遠出や旅行が楽しくなる要素や、記録に残せたらいいな」',
    },
    implementation: {
      adr: 'ADR-0008: Frontier Development, Regional Relics, and Travel Chronicle (docs/adr/0008-frontier-and-chronicle.md)',
      adr_0007_superseded: 'Superseded the misplaced side-scrolling action platformer pivot',
      modules_added: [
        'src/frontier-regional-relics.js: Defines 12 landmark-specific regional relics mapped to OSM signals (sacred, water, road_hub, woods, height, historic) with unique traits, flavor text, and origin stamping.',
        'src/frontier-outpost.js: Implements outpost claiming upon landmark conquest, facilities building (watchtower, forge, hearth) using iron scrap, defense ratings, and rival defense repel simulation.',
        'src/travel-chronicle.js: Implements travel chronicle, heraldic landmark stamps (消印・紋章印), memorable expedition recap cards, and collected relics catalog.',
        'src/travel-chronicle-ui.js: Renders single-viewport thumb-friendly mobile travelogue, passport stamps, regional relics codex, and interactive outpost facility upgrades.',
        'travel-chronicle.css: Polished dark-fantasy heraldic parchment styling conforming to single-viewport and touch constraints.',
      ],
      test_verification: {
        total_unit_tests: 1114,
        failing: 0,
        passing: 1114,
        jev_browser_smoke: 'Clean execution without console errors, verified mobile DOM flows.',
      },
    },
    constraints: {
      location_safety: 'No raw GPS route logging; simulated/coarse landmarks only; no prolonged phone distraction while walking.',
      smartphone_ui: 'Single-viewport bounded, bottom thumb navigation with 4-tab passport subviews, touch-friendly 44px+ buttons.',
    },
  };

  const questions = {
    requirement_fulfillment: {
      type: 'choice',
      instructions:
        'Does the implementation in Issue #888 directly satisfy the user\'s core desires (location territory contest, frontier outpost development, regional relics collection, and travel chronicle archiving)?',
      criteria: {
        fully_satisfied:
          'Directly addresses all four pillars: territory contest, frontier outposts, regional relics, and travel chronicle archiving with concrete mechanisms.',
        partially_satisfied:
          'Satisfies some requirements but misses major aspects.',
        not_satisfied:
          'Fails to address user requirements or repeats previous passivity/misdirection.',
      },
    },
    regression_and_safety_risk: {
      type: 'noul',
      instructions:
        'Is there any significant regression risk, location safety violation, or breakage to existing game systems in this change?',
      criteria: {
        true: 'High risk of regressions, broken tests, or location safety violations.',
        false: 'All 1114 tests pass, zero regressions detected, location safety invariants preserved.',
      },
    },
    fun_and_motivation_impact: {
      type: 'score',
      instructions:
        'How significantly does this change elevate the emotional pull, travel motivation, and desire to embark on expeditions compared to the previous passive loop?',
      criteria: [
        'Negligible; gameplay feels identical to before.',
        'Slight cosmetic change; does not change expedition motivation.',
        'Moderate improvement; some interest in regional loot and stamps.',
        'Major breakthrough; transforms expeditions into memorable journeys with tangible territory, outposts, and souvenir relics.',
        'Extraordinary transformation; world-class location fantasy RPG loop.',
      ],
    },
    merge_verdict: {
      type: 'choice',
      instructions: 'What is the TypeSafe Jev recommendation for merging this PR/branch into main?',
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

  console.log('Running TypeSafe Jev Semantic Verification for Issue #888...');
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
