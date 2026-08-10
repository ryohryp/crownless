# Deployment strategy

This repository follows the default deployment pattern for lightweight apps developed in rapid iteration.

## Environments

### 1. GitHub Pages — development / playtest

Use GitHub Pages for the latest tested `main` build while the app is under active development.

- `.github/workflows/test.yml` validates every relevant branch and `main`.
- `.github/workflows/pages.yml` runs after the `test` workflow completes on `main` and publishes only when that run succeeded.
- Feature branches are validated by CI but do not need a hosted preview for every commit.
- This is the primary URL for frequent phone and browser playtests.

#### One-time repository setup

GitHub does not allow the repository `GITHUB_TOKEN` to create the first Pages site in this repository. Enable it once in the UI:

1. Open **Settings → Pages**.
2. Under **Build and deployment**, set **Source** to **GitHub Actions**.
3. Re-run `deploy-pages` once, or let the next successful `main` test run trigger it.

Until Pages is enabled, the deployment workflow exits successfully with a notice instead of turning every `main` build red.

### 2. Vercel — release / stable production

Vercel is reserved for deliberate stable releases.

- Automatic Git deployments are disabled in `vercel.json` with `git.deploymentEnabled = false`.
- Do not spend Vercel deployment quota on every branch or incremental commit.
- Deploy manually only when a milestone is ready for a stable public build.
- Verify CI and the GitHub Pages build before promoting the same commit to Vercel.
- A manual Production release may be performed through the connected Vercel tooling or the Vercel CLI; it must not require re-enabling automatic Git deployments.

### 3. ChatGPT Sites — disposable experiments

Use ChatGPT Sites for isolated UI or interaction experiments when it is faster to test a bold idea outside the main repository flow.

Examples:

- a radically different mobile combat layout
- a map / GPS interaction mock
- a one-off onboarding experiment

Treat these as experiments, not the source of truth. Successful ideas should be implemented and tested in the repository before becoming part of the product.

## Default rule for future apps

For lightweight browser apps, prefer this order unless the architecture requires something else:

1. **GitHub + CI** is the source of truth.
2. **GitHub Pages** hosts frequent development/playtest builds when the app is static-compatible.
3. **Vercel** is used for deliberate stable releases or when server-side/platform features are genuinely required.
4. **ChatGPT Sites** is used for fast disposable experiments.

Do not introduce production hosting complexity before the app needs it.

## New-app bootstrap

For a new static-compatible app, start with the same minimum controls:

1. Add a CI workflow that runs on pull requests and `main`.
2. Add a Pages workflow that deploys only after successful `main` CI.
3. Add `vercel.json` with automatic Git deployments disabled.
4. Enable GitHub Pages with **GitHub Actions** as the source once per repository.
5. Use the Pages URL during rapid iteration.
6. Promote a chosen tested commit to Vercel only at a release milestone.

The exact build command can vary by framework. The environment separation should stay the same.

## Release checklist

Before a Vercel production release:

1. The chosen commit is on `main`.
2. `main` CI is green.
3. The GitHub Pages version has been playtested on the target device.
4. Known progression/save compatibility issues are understood.
5. Deploy that exact commit manually to Vercel Production.
6. Smoke-test the Production URL after deployment.

## Guardrail

`test/deployment-policy.test.js` protects the two rules most likely to regress accidentally:

- Vercel Git auto-deployment remains disabled.
- GitHub Pages remains gated by successful `main` CI rather than publishing every feature commit.
