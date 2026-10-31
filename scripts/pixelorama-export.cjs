#!/usr/bin/env node
"use strict";
// Optional desktop export adapter; never approves or registers production assets.
const fs = require("node:fs");
const fsp = require("node:fs/promises");
const path = require("node:path");
const {execFile} = require("node:child_process");
const {promisify} = require("node:util");
const ROOT = path.resolve(__dirname, "..");
const execFileAsync = promisify(execFile);

function localSource(relative) {
  if (typeof relative !== "string" || path.isAbsolute(relative) || !relative.endsWith(".pxo")) {
    throw Error("invalid_pixelorama_project");
  }
  const resolved = path.resolve(ROOT, relative);
  if (!resolved.startsWith(ROOT + path.sep)) throw Error("source_outside_repo");
  const real = fs.realpathSync(resolved);
  if (!real.startsWith(ROOT + path.sep)) throw Error("source_symlink_outside_repo");
  return real;
}

function localCandidateOutput(relative) {
  if (typeof relative !== "string" || path.isAbsolute(relative) || !relative.endsWith(".png")) {
    throw Error("invalid_candidate_output");
  }
  const normalized = relative.replace(/\\/g, "/");
  if (![".qa/candidates/", "docs/assets/candidates/", ".visual-director/candidates/"]
    .some(prefix => normalized.startsWith(prefix))) throw Error("candidate_output_scope_required");
  const resolved = path.resolve(ROOT, normalized);
  if (!resolved.startsWith(ROOT + path.sep)) throw Error("output_outside_repo");
  const scoped = path.relative(ROOT, resolved).replace(/\\/g, "/");
  if (![".qa/candidates/", "docs/assets/candidates/", ".visual-director/candidates/"]
    .some(prefix => scoped.startsWith(prefix))) throw Error("candidate_output_scope_required");
  return resolved;
}

function pixeloramaArguments(project, output, scale = 1) {
  if (!Number.isInteger(scale) || scale < 1 || scale > 16) throw Error("invalid_pixelorama_scale");
  return ["--headless", "--quit", "--", "--spritesheet", "--output", output,
    ...(scale === 1 ? [] : ["--scale", String(scale)]), project];
}

async function runPixeloramaExport({project, output, scale = 1, bin = process.env.PIXELORAMA_BIN || "pixelorama"},
  {execute = execFileAsync} = {}) {
  const source = localSource(project);
  const target = localCandidateOutput(output);
  await fsp.mkdir(path.dirname(target), {recursive: true});
  const parent = await fsp.realpath(path.dirname(target));
  if (!parent.startsWith(ROOT + path.sep)) throw Error("output_symlink_outside_repo");
  try { await fsp.access(target); throw Error("candidate_already_exists"); }
  catch (error) { if (error.code !== "ENOENT") throw error; }

  // Pixelorama v1.2.3 ignores the filename portion of --output and uses the
  // project's saved export name. Isolate its output so that neither behavior
  // can overwrite another candidate or write to an approved asset path.
  const stagingDir = await fsp.mkdtemp(path.join(path.dirname(target), ".pixelorama-export-"));
  const stagingTarget = path.join(stagingDir, path.basename(target));
  const args = pixeloramaArguments(source, stagingTarget, scale);
  try {
    try { await execute(bin, args, {cwd: ROOT, timeout: 120000}); }
    catch (error) {
      if (error.code === "ENOENT") throw Error("pixelorama_executable_not_found");
      throw error;
    }
    const entries = await fsp.readdir(stagingDir, {withFileTypes: true});
    const pngFiles = entries.filter(entry => entry.isFile() && entry.name.toLowerCase().endsWith(".png"));
    if (entries.length !== 1 || pngFiles.length !== 1) throw Error("pixelorama_expected_single_png");
    const exported = path.join(stagingDir, pngFiles[0].name);
    const stats = await fsp.stat(exported);
    if (!stats.size) throw Error("pixelorama_export_missing_or_empty");
    await fsp.copyFile(exported, target, fs.constants.COPYFILE_EXCL);
    return {candidate: path.relative(ROOT, target).replace(/\\/g, "/"), bytes: stats.size};
  } finally {
    await fsp.rm(stagingDir, {recursive: true, force: true});
  }
}

function cli(argv) {
  const value = name => {const i = argv.indexOf(name); return i < 0 ? undefined : argv[i + 1];};
  const project = value("--project"), output = value("--output"), scale = value("--scale");
  if (!project || !output) throw Error("usage: --project <source.pxo> --output <.qa/candidates/name.png> [--scale 1-16]");
  return {project, output, scale: scale === undefined ? 1 : Number(scale)};
}

if (require.main === module) runPixeloramaExport(cli(process.argv.slice(2)))
  .then(result => console.log(JSON.stringify(result)))
  .catch(error => {console.error(`pixelorama_export: ${error.message}`); process.exitCode = 2;});

module.exports = {localSource, localCandidateOutput, pixeloramaArguments, runPixeloramaExport, cli};
