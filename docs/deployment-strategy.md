# Deployment strategy

This repository follows the default deployment pattern for lightweight apps developed in rapid iteration.

## Environments

### 1. GitHub Pages — development / playtest

Use GitHub Pages for the latest `main` build while the app is under active development.

- Every push to `main` publishes the current static app through `.github/workflows/pages.yml`.
- This is the primary URL for frequent phone and browser playtests.
- Feature branches are validated by CI but do not need a hosted preview for every commit.

### 2. Vercel — release / stable production

Vercel is reserved for deliberate stable releases.

- Automatic Git deployments are disabled in `vercel.json`.
- Do not spend Vercel deployment quota on every branch or incremental commit.
- Deploy manually only when a milestone is ready for a stable public build.
- Verify CI and the GitHub Pages build before promoting the same commit to Vercel.

### 3. ChatGPT Sites — disposable experiments

Use ChatGPT Sites for isolated UI or interaction experiments when it is faster to test a bold idea outside the main repository flow.

Examples:

- a radically different mobile combat layout
- a map / GPS interaction mock
- a one-off onboarding experiment

Treat these as experiments, not the source of truth. Successful ideas should be implemented and tested in the repository.

## Default rule for future apps

For lightweight browser apps, prefer this order unless the app's architecture requires something else:

1. **GitHub + CI** as the source of truth.
2. **GitHub Pages** for frequent development/playtest hosting when the app is static-compatible.
3. **Vercel** only for stable releases or when server-side/platform features are actually required.
4. **ChatGPT Sites** for fast disposable experiments.

Do not introduce production hosting complexity before the app needs it.

## Release checklist

Before a Vercel production release:

1. `main` CI is green.
2. GitHub Pages version has been playtested on the target device.
3. Known progression/save compatibility issues are understood.
4. Deploy the chosen `main` commit manually to Vercel.
5. Smoke-test the production URL after deployment.
