import test from "node:test";
import assert from "node:assert/strict";
import {createRequire} from "node:module";
import {mkdir, writeFile, rm, stat} from "node:fs/promises";
import path from "node:path";
import {fileURLToPath} from "node:url";
const require = createRequire(import.meta.url);
const {pixeloramaArguments,localCandidateOutput,runPixeloramaExport,cli} = require("../scripts/pixelorama-export.cjs");
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

test("Pixelorama exports a native-scale sprite sheet with a shell-free command", async () => {
  const prefix = `pixelorama-gate-${process.pid}`;
  const sourceRel = `.qa/candidates/${prefix}.pxo`;
  const outputRel = `.qa/candidates/${prefix}.png`;
  const source = path.join(ROOT, sourceRel), output = path.join(ROOT, outputRel);
  await mkdir(path.dirname(source), {recursive: true});
  await writeFile(source, "mock Pixelorama project");
  let observed;
  try {
    const result = await runPixeloramaExport({project: sourceRel, output: outputRel, bin: "pixelorama-test"}, {
      execute: async (bin, args, options) => {
        observed = {bin, args, options};
        const stagingTarget = args[args.indexOf("--output") + 1];
        // Pixelorama v1.2.3 exports under its saved project name, not --output's basename.
        await writeFile(path.join(path.dirname(stagingTarget), "original-project-name.png"), "mock PNG bytes");
      },
    });
    assert.equal(result.candidate, outputRel);
    assert.equal(observed.bin, "pixelorama-test");
    assert.equal(observed.options.cwd, ROOT);
    assert.deepEqual(observed.args, pixeloramaArguments(source, observed.args[observed.args.indexOf("--output") + 1], 1));
    assert.ok(observed.args.includes("--headless"));
    assert.ok(observed.args.includes("--spritesheet"));
    assert.ok(observed.args[observed.args.indexOf("--output") + 1].includes(".pixelorama-export-"));
    await assert.rejects(runPixeloramaExport({project: sourceRel, output: outputRel}), /candidate_already_exists/);
  } finally {
    await rm(source, {force: true});
    await rm(output, {force: true});
  }
});

test("Pixelorama's missing output is rejected and temporary export directory is removed", async () => {
  const prefix = `pixelorama-empty-${process.pid}`;
  const sourceRel = `.qa/candidates/${prefix}.pxo`;
  const outputRel = `.qa/candidates/${prefix}.png`;
  const source = path.join(ROOT, sourceRel);
  await mkdir(path.dirname(source), {recursive: true});
  await writeFile(source, "mock Pixelorama project");
  let stagingDir;
  try {
    await assert.rejects(runPixeloramaExport({project: sourceRel, output: outputRel}, {
      execute: async (_bin, args) => {
        stagingDir = path.dirname(args[args.indexOf("--output") + 1]);
      },
    }), /pixelorama_expected_single_png/);
    await assert.rejects(stat(stagingDir), /ENOENT/);
  } finally {
    await rm(source, {force: true});
  }
});

test("Pixelorama output stays within unapproved candidates and scale is bounded", () => {
  assert.throws(() => localCandidateOutput("assets/action-forest/hero.png"), /candidate_output_scope_required/);
  assert.throws(() => localCandidateOutput(".qa/candidates/../../assets/hero.png"), /candidate_output_scope_required/);
  assert.throws(() => localCandidateOutput("../../tmp/out.png"), /candidate_output_scope_required|output_outside_repo/);
  assert.throws(() => pixeloramaArguments("a.pxo", "b.png", 0), /invalid_pixelorama_scale/);
  assert.equal(cli(["--project", "source.pxo", "--output", ".qa/candidates/test.png"]).scale, 1);
});
