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

Vercel is reserved for deliberate stable releases and server-side APIs that GitHub Pages cannot host.

- Automatic Git deployments remain disabled in `vercel.json` with `git.deploymentEnabled = false`.
- Do not spend Vercel deployment quota on every branch or incremental commit.
- Production deploys are started manually from GitHub Actions using `.github/workflows/vercel-production.yml`.
- The workflow only deploys when invoked from `main`, reruns the test suite, pulls the Vercel Production project settings, builds locally in CI, and deploys the exact prebuilt output with `vercel deploy --prebuilt --prod`.
- The workflow serializes Production releases so two manual deploys cannot race each other.
- After deployment it smoke-tests the Production homepage and the `/api/geography` route without depending on a live Overpass success response.

#### One-time repository setup

Add one GitHub Actions secret before the first workflow run:

1. Create a Vercel access token with permission to deploy the Crownless project.
2. Open **GitHub → crownless → Settings → Secrets and variables → Actions**.
3. Add repository secret `VERCEL_TOKEN` with that token value.
4. Optional but recommended: create a GitHub Environment named `production` and add required reviewers if Production deploys should need an approval gate.

The Vercel team ID and Crownless project ID are intentionally fixed in the workflow because they identify this repository's deployment target and are not credentials.

#### Production deployment procedure

1. Merge the intended release commit to `main`.
2. Confirm `main` CI and GitHub Pages are healthy.
3. Open **Actions → deploy-vercel-production → Run workflow**.
4. Select the `main` branch and run the workflow.
5. The workflow deploys the exact selected `main` commit and writes the deployment URL and smoke-test result to the job summary.
6. Use the stable Production domain `https://crownless-iota.vercel.app` for final verification.

This flow does not require re-enabling Vercel Git auto-deployment.

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
6. Add a manual Vercel Production workflow only when server-side features or a stable release environment become necessary.

The exact build command can vary by framework. The environment separation should stay the same.

## Release checklist

Before a Vercel production release:

1. The chosen commit is on `main`.
2. `main` CI is green.
3. The GitHub Pages version has been playtested on the target device where applicable.
4. Known progression/save compatibility issues are understood.
5. Run `deploy-vercel-production` manually from `main`.
6. Confirm the workflow's Production smoke tests passed.
7. Perform the feature-specific Production check, such as Android location discovery through `/api/geography`.

## Guardrail

`test/deployment-policy.test.js` protects the deployment rules most likely to regress accidentally:

- Vercel Git auto-deployment remains disabled.
- GitHub Pages remains gated by successful `main` CI rather than publishing every feature commit.
- Vercel Production deployment remains manual-only, restricted to `main`, and deploys a prebuilt Production artifact.
