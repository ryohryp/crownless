"use strict";

/**
 * Evaluates gameplay enhancement ideas for Crownless using TypeSafe Jev System One.
 *
 * Each idea is submitted with structured context (problem addressed, mechanics,
 * UX impact, invariants alignment) and evaluated across 5 typed dimensions.
 */

const JEV_ENDPOINT = "https://api.typesafe.ai/v1/systemone";

const PRODUCT_INVARIANTS = {
  game: "Crownless",
  genre: "Location-discovery medieval fantasy smartphone RPG",
  milestone_goal: "Can someone play for about 15 minutes and want one more expedition?",
  core_loop: "Explore -> Fight -> Loot -> Return alive -> Improve -> Explore farther",
  ui_principles: "One scene = one viewport, thumb-reachable persistent bottom controls, no long scrolling",
  safety_rule: "No dangerous screen-staring while walking, real-world movement opens world",
  current_playtest_bottlenecks: [
    "Combat pacing drag (fights taking 70-100 turns, slog feeling)",
    "Punishing spike on death (total scrap/gear loss collapses motivation from 2.9 to 0.5)",
    "Unrewarding loot (scanty scrap, unable to upgrade at hearth, return feels empty)",
    "Repetitive binary path choices (only rest vs search, careful vs risky)",
  ],
};

const IDEAS = [
  {
    id: "posture_break",
    title: "体勢崩し（Posture Break / Stagger System）",
    category: "Combat & Pacing",
    target_problem: "Combat pacing drag (70-100 turns), chip damage slog",
    summary:
      "敵に3〜4の体勢値を設定。強攻撃のパリィ・回避後の反撃・予兆の隙（open）への攻撃で体勢値を削り、0になると1ターン『体勢崩壊』状態（被ダメージ2倍、プレイヤー気力全快）になる。",
    mobile_ux:
      "敵HPバーの下に小さな3〜4個の菱形アイコンを表示するのみ。新規ボタン不要で既存のタップ判断に直結。",
    risk_reward:
      "危険な大振りをあえて回避・反撃して体勢を崩すか、安全にガードで耐えるかの戦術的リスク判断が生まれる。",
    expected_impact: "戦闘ターン数が約40%短縮され、手応えと爽快感が飛躍的に向上する。",
  },
  {
    id: "weapon_burst",
    title: "武器覚醒バースト（Focus Burst Arts）",
    category: "Combat & Pacing",
    target_problem: "Lack of mid-combat turnaround, flat combat rhythm",
    summary:
      "見切りや防御成功で溜まる集中（Focus）が最大（3）に達した時、通常攻撃ボタンが『武器奥義』に点灯変化（短剣: 3連撃出血、盾: 盾打スタン、弓: 弱点貫通狙撃、鉄剣: 背水斬撃）。",
    mobile_ux:
      "ボタン数を増やさず、既存の攻撃ボタンが金色に光って切り替わる1画面完結UI。",
    risk_reward:
      "奥義を即時解放して敵を倒し切るか、温存して次の大技を中断させるかの駆け引き。",
    expected_impact: "戦闘中のカタルシス（逆転の快感）が生まれ、武器ごとの個性が劇的に際立つ。",
  },
  {
    id: "quick_tactical_items",
    title: "クイック戦術具スロット（Quick Tactical Consumables）",
    category: "Combat & Pacing",
    target_problem: "Limited recovery and tactical panic buttons in combat",
    summary:
      "遠征中に1個だけ携行できる即時アイテム（投擲石: 敵の大技キャンセル、煙玉: 被弾なしで安全撤退、研ぎ石: 次の攻撃ダメージ+4）。",
    mobile_ux:
      "親指の届く下部バーの薬草ボタン横に1スロット追加（1画面・親指操作を維持）。",
    risk_reward:
      "貴重な1回限りの道具を温存するか、目の前の危機打開に使うかのリソースマネジメント。",
    expected_impact: "全滅の理不尽さを自分の判断で回避・逆転できる納得感。",
  },
  {
    id: "corpse_recovery",
    title: "灰の道標・遺品回収（Soul Cache / Lost Loot Recovery）",
    category: "Risk-Reward & Tension",
    target_problem: "Death wipeout collapses replay motivation (score 0.5/5.0)",
    summary:
      "遠征で死亡した際、その深層に『遺品袋』が残る。次回同じ目的地に挑んでその深層に到達・勝利すれば、ロストした鉄片の50%と装備1個を回収可能。",
    mobile_ux:
      "マップ選択画面および到達階層で『遺品あり』の小さなアイコンと演出が表示されるのみ。",
    risk_reward:
      "全滅の喪失感が『奪還のための再遠征動機』へと直結。回収中に死ぬと上書きされるソウルライク的緊張感。",
    expected_impact: "死亡時の虚無感を解消し、『もう1回行って取り返す！』という熱狂的なリプレイ欲を生む。",
  },
  {
    id: "desperate_compromise_escape",
    title: "決死の荷捨て離脱（Emergency Loot Drop Escape）",
    category: "Risk-Reward & Tension",
    target_problem: "Binary die-or-survive outcome, total waste on miscalculation",
    summary:
      "HPが0になった瞬間、1度だけ『背嚢を捨てて命乞い退却』の緊急選択が発生。獲得した鉄片・未帰還装備をすべてその場に放棄する代わりに、探索発見と生存を持ち帰れる。",
    mobile_ux:
      "死亡画面直前にワンタップの選択肢モーダル（捨てる vs 散る）が出るのみ。",
    risk_reward:
      "命か獲物かの究極の選択。屈辱と引き換えに探索進捗（新エリア解放や生還カウント）を守る。",
    expected_impact: "プレイヤーの納得感と『次は準備して勝つ』という悔しさを醸成。",
  },
  {
    id: "greed_abyss_curse",
    title: "深層の影煽り（Abyss Temptation / Greed Multiplier）",
    category: "Risk-Reward & Tension",
    target_problem: "Cautious play is boring (0.8 tension), greedy play has harsh payoff",
    summary:
      "深層（depth 2/3）進出時、『影を煽る（敵攻撃力+25%、鉄片獲得2.5倍＆変異装備確定）』を選択可能にするプッシュ・ユア・ラック機能。",
    mobile_ux:
      "進む・帰る の二択ボタンの横に『影を煽って進む』の別色ボタンを配置。",
    risk_reward:
      "プレイヤー自らが能動的に危険度を釣り上げ、破格の報酬を狙うハイリスク・ハイリターン。",
    expected_impact: "生還重視と欲張り派の双方が満足するドラマチックな選択。",
  },
  {
    id: "campfire_progression",
    title: "焚き火の温もり・拠点永続拡張（Campfire Upgrades）",
    category: "Loot & Progression",
    target_problem: "Unrewarding loot (scanty scrap cannot afford weapon upgrade, empty return)",
    summary:
      "武器強化（コスト8〜20）に届かない少額の鉄片（3〜5個）でも、焚き火の便利施設に投資可能（鍋: 遠征時の初期ポーション+1、小袋: 鉄片保持枠拡張、道標: 次の敵傾向チラ見）。",
    mobile_ux:
      "拠点（Hearth）画面の焚き火ビジュアル下部にコンパクトなアイコンタップで投資可能。",
    risk_reward:
      "手持ちの鉄片を武器単体強化に貯め込むか、全体の探索ベースアップに回すかの選択。",
    expected_impact: "たとえ浅層で少額しか稼げなくても『帰還した価値』が必ず残り、虚無感を完全撲滅。",
  },
  {
    id: "enchantment_shards",
    title: "変異ルーン・欠片刻印（Rune Inscription）",
    category: "Loot & Progression",
    target_problem: "Weapons have static identities, builds lack personal touch",
    summary:
      "遠征の強敵や探索から極小の『ルーン欠片』がドロップ。武器に1つ刻印して特性を微調整できる（例: 吸血+1、気力回復速度+10%、会心率+5%）。",
    mobile_ux:
      "装備詳細画面でスロットをタップして選択するだけの軽量シートUI。",
    risk_reward:
      "刻印したルーンは武器ごとに固有となり、異なる武器の使い分けがさらに楽しくなる。",
    expected_impact: "装備の見た目と手触りの変化を深め、自分だけのビルドを作るモチベーションを高める。",
  },
  {
    id: "dynamic_trail_events",
    title: "足跡と痕跡の分岐イベント（Dynamic Trail Dilemmas）",
    category: "Exploration & UX",
    target_problem: "Repetitive binary path rooms (only rest vs search, careful vs risky)",
    summary:
      "探索部屋で『獣の血痕（強敵だが変異装備気配）』『古い薬師の小屋（HP回復だが罠の気配）』『崩落した鍛冶場（鉄片大量だが気力消費）』等の文脈ある3択イベントが発生。",
    mobile_ux:
      "1画面完結の美しい紙芝居式カード（3択ボタン）で親指タップで瞬時に解決。",
    risk_reward:
      "現在のHPと所持アイテムを見比べ、リスクを予測して進路を選ぶローグライト的歓び。",
    expected_impact: "作業的だった移動フェーズが『冒険のドラマ』に化け、没入感が劇的に跳ね上がる。",
  },
  {
    id: "visceral_haptics",
    title: "瀕死鼓動ハプティクス＆緊張演出（Visceral Heartbeat & Audio-Haptic Cue）",
    category: "Exploration & UX",
    target_problem: "Numeric HP doesn't convey gut-wrenching life-or-death tension",
    summary:
      "HPが30%以下、または大量の未確定鉄片を所持している時、端末が心拍リズムで微振動し、画面端がかすかに暗転。生還タップ時に重厚な鐘と開放の振動が走る。",
    mobile_ux:
      "UIレイアウトは変えず、スマホの触覚・視覚フィードバックを最大限に活用。",
    risk_reward:
      "数字を見るのではなく、身体感覚として『今すぐ帰るべきか、もう一歩進むか』の恐怖と安堵を感じる。",
    expected_impact: "スマートフォン特有の手触り・没入感が最高峰に達する。",
  },
  {
    id: "realworld_scout_breeze",
    title: "歩行探索の追い風ボーナス（Trail Breeze & Scout Intel）",
    category: "Location & Real World",
    target_problem: "Real-world movement is only a gate to unlock areas, not feeding the core loop",
    summary:
      "現実の移動距離や新たな場所の通過に応じて『旅の風聞（Scout Intel）』が蓄積。次回の遠征開始時に『初期気力+1』や『霧の晴れた地図』などの小さな追い風恩恵を受けられる。",
    mobile_ux:
      "歩行中は画面を見なくてOK。立ち止まって拠点で遠征に出る際に『移動の恵み』として受け取る。",
    risk_reward:
      "歩行安全性を100%維持しながら、日常の移動がRPGの冒険準備になる心地よい連動感。",
    expected_impact: "『外を歩いてから冒険に出ると有利』という自然な生活連動型RPGの魅力を確立。",
  },
  {
    id: "bounty_rumors",
    title: "焚き火の賞金首・噂話（Bounty Rumors & Named Beasts）",
    category: "Loot & Progression",
    target_problem: "Bosses are always identical wolves/knights, lack of hunt excitement",
    summary:
      "遠征前に焚き火の旅人から『森の奥に隻眼の凶狼が現れた』という噂を受注可能。通常より手強いが、倒すと限定の武器外見や専用装飾が手に入る。",
    mobile_ux:
      "拠点画面で吹き出しをタップして受注するのみの1画面完結設計。",
    risk_reward:
      "討伐に挑むか、通常の探索を優先するかの目的意識の分化。",
    expected_impact: "『あの賞金首を倒すために装備を鍛えよう』という明確な中期目標が生まれる。",
  },
];

/**
 * Builds Jev questions for evaluating game design ideas.
 */
function buildIdeaQuestions() {
  return {
    fun_elevation_score: {
      type: "score",
      instructions:
        "How strongly does this idea elevate the core game loop (Explore -> Fight -> Loot -> Return -> Improve) and achieve the milestone goal: 'Can someone play for 15 minutes and want one more expedition'?",
      criteria: [
        "Negligible or negative impact; adds distraction without making the core loop more fun.",
        "Minor novelty; interesting concept but doesn't fundamentally improve player desire to do one more expedition.",
        "Moderate enhancement; noticeably improves a specific weak link in the loop.",
        "Major fun amplifier; directly solves a key bottleneck and creates strong emotional highs and replay pull.",
        "Exceptional breakthrough; transforms the game feel into an intensely fun and memorable smartphone RPG experience.",
      ],
    },
    mobile_fit_score: {
      type: "score",
      instructions:
        "Does this idea strictly respect Crownless smartphone UI principles: 'One scene = one viewport', persistent thumb-reachable bottom controls, fast tap decisions, zero unnecessary scrolling or clutter?",
      criteria: [
        "Violates mobile principles; introduces complex multi-layer menus, long scrolling, or tiny un-tappable controls.",
        "Awkward mobile fit; requires significant screen space or excessive modal juggling.",
        "Acceptable mobile fit; fits on mobile but adds some cognitive or visual density.",
        "Great mobile fit; naturally integrates into existing 1-viewport layouts with thumb-friendly controls.",
        "Flawless mobile-first design; elegant, tactile, minimalist, and feels native to smartphone play.",
      ],
    },
    risk_reward_tension: {
      type: "score",
      instructions:
        "How effectively does this idea enhance push-your-luck drama, tactical tension, or mitigate soul-crushing unpreventable wipeouts?",
      criteria: [
        "Zero effect on risk-reward stakes.",
        "Marginal effect on stakes; decisions remain largely neutral.",
        "Good tension; creates clear dilemma between safety and greed.",
        "High dramatic impact; makes death feel meaningful and survival intensely rewarding.",
        "Masterclass in risk-reward; turns every expedition into a nail-biting, player-driven gamble.",
      ],
    },
    lightweight_fit: {
      type: "score",
      instructions:
        "How well does this idea adhere to the 'minimal coherent implementation' and anti-bloat principle (avoiding MMO systems, excessive math, speculative abstractions)?",
      criteria: [
        "Bloated; introduces excessive systems, complex economies, or high maintenance overhead.",
        "Somewhat heavy; requires multiple new subsystems to function properly.",
        "Balanced; manageable complexity with reasonable implementation effort.",
        "Lean and elegant; builds cleanly upon existing mechanics with minimal new code.",
        "Ultra-lightweight; maximum gameplay leverage with minimal lines of code and zero bloat.",
      ],
    },
    verdict: {
      type: "choice",
      instructions:
        "What is the overall recommendation for this idea in Crownless's next implementation phase?",
      criteria: {
        must_implement:
          "Essential improvement that directly fixes a critical bottleneck and makes the game substantially more fun.",
        strong_candidate:
          "High-value feature that should be prioritized right after the core critical fixes.",
        needs_refinement:
          "Promising concept, but requires simplification or tighter integration before implementation.",
        reject_bloat:
          "Overly complex, misaligned with smartphone/minimalist principles, or unnecessary.",
      },
    },
    bloat_risk: {
      type: "noul",
      instructions:
        "Is there a notable risk that this idea introduces feature creep, rules complexity, or cognitive clutter for a casual phone player?",
      criteria: {
        true: "High risk of bloat, rules confusion, or UI clutter.",
        false: "Clean, intuitive, and natural to grasp immediately.",
      },
    },
  };
}

/**
 * Calls Jev System One for an idea.
 */
async function evaluateIdeaWithJev(idea, options = {}) {
  const apiKey = options.apiKey || process.env.TYPESAFE_API_KEY;
  const state = {
    product_context: PRODUCT_INVARIANTS,
    idea_proposal: idea,
  };
  const questions = buildIdeaQuestions();

  if (!apiKey) {
    throw new Error("No TYPESAFE_API_KEY available.");
  }

  const res = await fetch(JEV_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "jev-latest",
      state,
      questions,
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Jev API error ${res.status}: ${text}`);
  }

  const json = await res.json();
  return json.answers;
}

/**
 * Format score bar (e.g. ■■■■□)
 */
function formatBar(score, max = 5) {
  const filled = Math.round(score);
  return "■".repeat(Math.max(0, filled)) + "□".repeat(Math.max(0, max - filled));
}

async function main() {
  console.log("============================================================");
  console.log("  Crownless 面白化アイデア Jevセマンティック検証ハーネス");
  console.log("  Evaluator: TypeSafe Jev System One (Live)");
  console.log(`  検証対象アイデア数: ${IDEAS.length} 件`);
  console.log("============================================================\n");

  const evaluatedIdeas = [];

  for (let i = 0; i < IDEAS.length; i++) {
    const idea = IDEAS[i];
    process.stdout.write(`[${i + 1}/${IDEAS.length}] Jev評価中: 『${idea.title}』... `);
    try {
      const answers = await evaluateIdeaWithJev(idea);
      evaluatedIdeas.push({ idea, answers });
      console.log(`[完了] 判定: ${answers.verdict?.choice} (面白さ: ${answers.fun_elevation_score?.score}/5.0)`);
    } catch (err) {
      console.log(`[エラー: ${err.message}]`);
    }
  }

  // Sort by fun_elevation_score descending
  evaluatedIdeas.sort(
    (a, b) =>
      (b.answers.fun_elevation_score?.score || 0) - (a.answers.fun_elevation_score?.score || 0)
  );

  console.log("\n============================================================");
  console.log("  【Jev総合検証結果ランキング (面白さスコア順)】");
  console.log("============================================================\n");

  for (let i = 0; i < evaluatedIdeas.length; i++) {
    const { idea, answers } = evaluatedIdeas[i];
    const fun = answers.fun_elevation_score?.score || 0;
    const mobile = answers.mobile_fit_score?.score || 0;
    const tension = answers.risk_reward_tension?.score || 0;
    const lean = answers.lightweight_fit?.score || 0;
    const verdict = answers.verdict?.choice || "unknown";
    const bloat = answers.bloat_risk?.noul ?? 0;

    const verdictLabel =
      verdict === "must_implement"
        ? "🌟 【最優先実装 (Must Implement)】"
        : verdict === "strong_candidate"
        ? "✨ 【有力候補 (Strong Candidate)】"
        : verdict === "needs_refinement"
        ? "🔧 【要調整 (Needs Refinement)】"
        : "❌ 【見送り (Reject)】";

    console.log(`Rank ${i + 1}: ${idea.title} [カテゴリ: ${idea.category}]`);
    console.log(`  推奨度: ${verdictLabel}`);
    console.log(`  面白さ向上度 (Fun Elevation) : [${fun.toFixed(1)}/5.0] ${formatBar(fun)}`);
    console.log(`  スマホUI適合 (Mobile Fit)    : [${mobile.toFixed(1)}/5.0] ${formatBar(mobile)}`);
    console.log(`  リスク緊張感 (Risk-Reward)   : [${tension.toFixed(1)}/5.0] ${formatBar(tension)}`);
    console.log(`  軽量性・無駄無さ (Lean Fit)  : [${lean.toFixed(1)}/5.0] ${formatBar(lean)}`);
    console.log(`  ルール複雑化リスク (Bloat)   : ${(bloat * 100).toFixed(0)}%`);
    console.log(`  解決課題: ${idea.target_problem}`);
    console.log(`  メカニクス要約: ${idea.summary}`);
    console.log("------------------------------------------------------------");
  }

  // Save results to JSON artifact for inspection
  const fs = require("fs");
  const outputPath = "./tmp-jev-ideas-report.json";
  fs.writeFileSync(outputPath, JSON.stringify(evaluatedIdeas, null, 2), "utf8");
  console.log(`\n詳細データを ${outputPath} に保存しました。`);
}

if (require.main === module) {
  main().catch((err) => {
    console.error("Evaluation script failed:", err);
    process.exit(1);
  });
}

module.exports = { IDEAS, evaluateIdeaWithJev };
