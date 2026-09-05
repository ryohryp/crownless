from pathlib import Path

path = Path("scripts/check-atlas-viewport.cjs")
text = path.read_text()
old = '''      assert.equal(await page.evaluate(() => window.__atlasReloadCount), 1);
      await page.waitForSelector(".world-atlas-next-actions");
      assert.equal(await page.locator(".world-atlas-next-action").count(), 2, "Nearby Atlas should surface two next moves");
      assert.equal(await page.locator('.world-atlas-next-action[data-next-action-source="signal"]').count(), 1, "One transient lead should stay visible");
      assert.equal(await page.locator('.world-atlas-next-action[data-next-action-source="place"]').count(), 1, "One stable-place action should stay visible");
      await page.locator(".world-atlas-close").click();
      await openAtlasFromHearth();
      await page.waitForSelector(".world-atlas-map--nearby");
      assert.equal(await page.evaluate(() => window.__atlasReloadCount), 1, "Returning to Atlas must reuse the last scan");'''
new = '''      assert.equal(await page.evaluate(() => window.__atlasReloadCount), 1);
      // The explicit scan preserves the currently selected World Atlas view.
      // Verify the nearby next-move surface after returning, when the fresh scan
      // makes the nearby manuscript the natural default again.
      await page.locator(".world-atlas-close").click();
      await openAtlasFromHearth();
      await page.waitForSelector(".world-atlas-map--nearby");
      await page.waitForSelector(".world-atlas-next-actions");
      assert.equal(await page.locator(".world-atlas-next-action").count(), 2, "Nearby Atlas should surface two next moves");
      assert.equal(await page.locator('.world-atlas-next-action[data-next-action-source="signal"]').count(), 1, "One transient lead should stay visible");
      assert.equal(await page.locator('.world-atlas-next-action[data-next-action-source="place"]').count(), 1, "One stable-place action should stay visible");
      assert.equal(await page.evaluate(() => window.__atlasReloadCount), 1, "Returning to Atlas must reuse the last scan");'''
if text.count(old) != 1:
    raise SystemExit("expected next-action QA block not found exactly once")
path.write_text(text.replace(old, new, 1))
