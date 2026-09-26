"use strict";

const { test, expect } = require("@playwright/test");
const fs = require("node:fs");
const path = require("node:path");

const OUT = path.join(process.cwd(), "playtest-artifacts");
fs.mkdirSync(OUT, { recursive: true });

test.use({ viewport: { width: 390, height: 844 } });

test("issue #582 Loot Hunt phone-size runtime gate", async ({ page }) => {
  const observation = { viewport: { width: 390, height: 844 } };

  await page.goto("http://127.0.0.1:4173/expedition.html");
  await page.waitForFunction(() => Boolean(window.CrownlessSlice));

  observation.seed = await page.evaluate(() => {
    const E = window.CrownlessSlice;
    let s = E.initial();
    s.mode = "demo";
    s.runs = 1;
    s.expedition = {
      place: "wood",
      depth: 2,
      room: 4,
      hp: E.maxHp(s),
      stamina: 3,
      focus: 0,
      potions: 2,
      scrap: 12,
      gear: [],
      seals: [],
      enemy: {
        kind: E.place("wood").enemy,
        hp: 1,
        maxHp: 27,
        turn: 0,
        depth: 2,
        elite: true,
        risky: false,
      },
      stage: "fight",
      log: [],
    };

    s = E.act(s, "strike");
    const found = s.expedition.gear[0];
    localStorage.setItem("crownless-expedition-mode", "demo");
    localStorage.setItem("crownless-expedition-v1-demo", E.serialize(s));

    return {
      found,
      foundName: E.GEAR[found]?.name,
      current: s.equipped,
      currentName: E.GEAR[s.equipped]?.name,
      stage: s.expedition.stage,
      atRiskGearCount: s.expedition.gear.length,
    };
  });

  await page.reload();
  await page.waitForLoadState("domcontentloaded");

  const comparison = page.locator(".loot-comparison-moment");
  await expect(comparison).toBeVisible();
  const comparisonText = (await comparison.innerText()).trim();
  const comparisonBox = await comparison.boundingBox();
  const returnButton = page.locator('button[data-action="return"]');
  const deeperButton = page.locator('button[data-action="deeper"]');

  observation.cleared = {
    comparisonText,
    comparisonBox,
    returnVisible: await returnButton.isVisible(),
    deeperVisible: await deeperButton.isVisible(),
    bodyScrollHeight: await page.evaluate(() => document.body.scrollHeight),
    viewportHeight: await page.evaluate(() => innerHeight),
  };

  await comparison.scrollIntoViewIfNeeded();
  await page.screenshot({ path: path.join(OUT, "01-loot-comparison-390x844.png"), fullPage: false });

  await returnButton.click();
  await expect(page.locator(".report-panel")).toBeVisible();
  observation.report = {
    text: (await page.locator(".report-panel").innerText()).trim(),
  };
  await page.screenshot({ path: path.join(OUT, "02-safe-return-390x844.png"), fullPage: false });

  await page.locator('button[data-action="continue"]').click();
  await expect(page.locator(".gear-home")).toBeVisible();

  const foundId = observation.seed.found;
  const foundButton = page.locator(`button[data-action="equip"][data-value="${foundId}"]`);
  await expect(foundButton).toBeVisible();
  observation.gear = {
    foundButtonText: (await foundButton.innerText()).trim(),
    gearPanelText: (await page.locator(".panel").innerText()).trim(),
  };
  await foundButton.scrollIntoViewIfNeeded();
  await page.screenshot({ path: path.join(OUT, "03-gear-choice-390x844.png"), fullPage: false });

  await foundButton.click();
  observation.equipped = {
    foundId,
    selected: await foundButton.getAttribute("class"),
    panelText: (await page.locator(".panel").innerText()).trim(),
  };
  await page.screenshot({ path: path.join(OUT, "04-equipped-variant-390x844.png"), fullPage: false });

  fs.writeFileSync(path.join(OUT, "observation.json"), JSON.stringify(observation, null, 2));
  console.log("LOOT_HUNT_OBSERVATION=" + JSON.stringify(observation));
});
