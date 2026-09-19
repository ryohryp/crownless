"use strict";
let input = "";
process.stdin.setEncoding("utf8");
process.stdin.on("data", (chunk) => { input += chunk; });
process.stdin.on("end", () => {
  JSON.parse(input);
  process.stdout.write(JSON.stringify({
    choice: "retry",
    confidence: 0.82,
    probabilities: { done: 0.12, retry: 0.82, change_strategy: 0.04, needs_human: 0.02 }
  }));
});
