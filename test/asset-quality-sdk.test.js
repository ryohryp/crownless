import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);

test("official TypeSafe SDK sends candidate/reference images as multipart with opt-in", {timeout: 15000}, async () => {
  const sharp = require("sharp");
  const sdk = require("@typesafe-ai/sdk");
  const { evaluate } = require("../scripts/asset-quality-gate.cjs");
  const dir = await mkdtemp(join(tmpdir(), "crownless-sdk-wire-"));
  const oldKey = process.env.TYPESAFE_API_KEY;
  process.env.TYPESAFE_API_KEY = "local-only-test-key";
  try {
    const first = join(dir, "candidate.png"), second = join(dir, "reference.png");
    await writeFile(first, await sharp({ create: { width: 512, height: 512, channels: 4,
      background: { r: 235, g: 226, b: 212, alpha: 1 } } }).png().toBuffer());
    await writeFile(second, await sharp({ create: { width: 512, height: 512, channels: 4,
      background: { r: 25, g: 31, b: 35, alpha: 1 } } }).png().toBuffer());
    let requests = 0, observed;
    class MockWireClient extends sdk.TypeSafeClient {
      constructor() {
        super({
          apiKey: "local-only-test-key",
          compression: false,
          retry: { maxRetries: 0 },
          fetch: async (url, init) => {
            requests++;
            observed = {url, init};
            return Response.json({
              model: "jev-latest",
              usage: { input_tokens: 101, output_tokens: 9 },
              answers: {
                verdict: { choice: "accept_candidate", confidence: 0.93 },
                main_issue: { choice: "none" },
                style: { score: 4 }, quality: { score: 5 },
                identity_mismatch: { noul: 0.05 }, artifacts: { noul: 0.03 }
              }
            });
          }
        });
      }
    }
    const manifest = {
      kind: "background", subject: "test fictional watchtower", usage: "demo background",
      generationPrompt: "charcoal ink fantasy ruin", targetSize: [512, 512],
      transparent: false, references: [], attempt: 0
    };
    const result = await evaluate({images: [first, second], manifest}, {
      TypeSafeClient: MockWireClient,
      image: sdk.image
    });
    assert.equal(result.available, true, JSON.stringify(result));
    assert.ok(observed, "the official SDK must reach the mocked fetch");
            assert.match(String(observed.url), /\/v1\/systemone$/);
            const headers = new Headers(observed.init.headers);
            assert.equal(headers.get("TypeSafe-Danger-Zone-Images"), "true");
            assert.equal(headers.get("Authorization"), "Bearer local-only-test-key");
            assert.ok(observed.init.body instanceof FormData, "official SDK must construct multipart FormData");
            const requestPart = observed.init.body.get("request");
            assert.ok(requestPart);
            const requestBody = JSON.parse(typeof requestPart === "string" ? requestPart : await requestPart.text());
            assert.equal(requestBody.model, "jev-latest");
            assert.equal(requestBody.questions.verdict.type, "choice");
            assert.equal(requestBody.questions.quality.type, "score");
            assert.equal(requestBody.questions.artifacts.type, "noul");
            assert.ok(Array.isArray(requestBody.state.canon));
            assert.ok(requestBody.state.canon.some(x => x.file === "docs/visual-canon.md"));
            assert.equal(requestBody.state.contract.subject, "test fictional watchtower");
            const assets = requestBody.assets;
            assert.ok(assets && Object.keys(assets).length === 2, "candidate and approved reference are both sent");
            assert.ok(assets[requestBody.state.candidate], "candidate reference is present");
            assert.ok(assets[requestBody.state.approvedReference], "approved anchor is referenced");
            for (const entry of Object.values(assets)) {
              const file = observed.init.body.get(entry.part);
              assert.ok(file, "multipart image part exists");
              assert.ok(file.size > 100, "nonempty file image");
              assert.equal(file.type, "image/png");
            }

    assert.equal(result.calls, 1);
    assert.equal(result.answers.verdict.choice, "accept_candidate");
    assert.equal(result.usage.input_tokens, 101);
    assert.equal(requests, 1);
  } finally {
    if (oldKey === undefined) delete process.env.TYPESAFE_API_KEY;
    else process.env.TYPESAFE_API_KEY = oldKey;
    await rm(dir, { recursive: true, force: true });
  }
});

test("SDK transport failure is unavailable, not rejected art", {timeout: 15000}, async () => {
  const sdk = require("@typesafe-ai/sdk");
  const { evaluate, interpret } = require("../scripts/asset-quality-gate.cjs");
  const sharp = require("sharp");
  const dir = await mkdtemp(join(tmpdir(), "crownless-sdk-error-"));
  const oldKey = process.env.TYPESAFE_API_KEY;
  process.env.TYPESAFE_API_KEY = "local-only-test-key";
  try {
    const candidate = join(dir, "candidate.png");
    await writeFile(candidate, await sharp({ create: {
      width: 400, height: 400, channels: 3, background: "#ededed"
    }}).png().toBuffer());
    class OutageClient extends sdk.TypeSafeClient {
      constructor() {
        super({apiKey:"local-only-test-key", compression:false, retry:{maxRetries:0},
          fetch: async () => Response.json({error:"unavailable"},{status:503})});
      }
    }
    const result = await evaluate({images: [candidate],manifest:{
      kind:"background",subject:"fictional area",usage:"test",generationPrompt:"ink",targetSize:[400,400],
      transparent:false,references:[],attempt:0}}, {TypeSafeClient:OutageClient,image:sdk.image});
    assert.equal(result.available, false);
    assert.equal(result.calls, 1);
    assert.equal(interpret(result).status,"evaluation_unavailable");
  } finally {
    if(oldKey===undefined)delete process.env.TYPESAFE_API_KEY;
    else process.env.TYPESAFE_API_KEY=oldKey;
    await rm(dir,{recursive:true,force:true});
  }
});
