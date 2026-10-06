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
      number: 899,
      title: 'docs(adr): ADR-0009 スマホ戦闘ビューポートと戦術デンシティ原則の策定',
    },
    adr_file: 'docs/adr/0009-smartphone-combat-viewport-and-tactical-density.md',
    principles_documented: [
      'Zero-Omission Rule: Never use display: none on decision-critical tactical numbers (damage block, stamina cost/gain, counter/dodge outcome, herb risk).',
      'Multi-Line Clamped Intent Guidance: Enemy intent guidance must not be truncated with ellipses; must use 2-line clamping.',
      'Persistent In-Scene Contextual Settings Access: The active scene header must provide an unobtrusive settings button (⚙ 設定) to access audio and brightness modes even when app chrome is suppressed on phones.',
      'Single-Viewport Bounded Physics: Combat panels must remain locked within one viewport (~360px stack height) with safety headroom.',
    ],
    project_invariants_aligned: [
      'AGENTS.md: One scene = one viewport; avoid document scrolling; keep touch targets >= 44px.',
      'Test enforcement: Guarded by test/issue-897-mobile-ui.test.js and test/mobile-combat-vitals-layout.test.js.',
    ],
  };

  const questions = {
    adr_completeness_and_soundness: {
      type: 'choice',
      instructions:
        'Does ADR-0009 soundly and completely document the smartphone UI and tactical density invariants established in Issue #897?',
      criteria: {
        fully_sound:
          'Clearly documents the problem, architectural decisions (zero omission, intent clamp, in-scene settings), and consequences.',
        flawed_or_incomplete:
          'Leaves critical decisions unstated or conflicts with AGENTS.md smartphone principles.',
      },
    },
    consistency_with_project_principles: {
      type: 'noul',
      instructions:
        'Does ADR-0009 fully adhere to Crownless product invariants and smartphone UI guidelines in AGENTS.md?',
      criteria: {
        true: 'Completely consistent with AGENTS.md and established ADRs.',
        false: 'Conflicts with existing invariants.',
      },
    },
    merge_verdict: {
      type: 'choice',
      instructions: 'What is the recommendation for merging this ADR documentation PR into main?',
      criteria: {
        ready_to_merge:
          'The ADR is high quality, well-structured, accurate, and ready to be merged.',
        needs_rework:
          'Requires substantial edits or clarifications.',
      },
    },
  };

  console.log('Running TypeSafe Jev Semantic Verification for Issue #899 (ADR-0009)...');
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
