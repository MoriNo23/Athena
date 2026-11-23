# Proposal

## Why

`bun outdated` shows major versions pending in almost every layer: Capacitor 7→8, pdf.js 6.4→6.5, lucide-react 0.525→1.77, TypeScript 5.9→7, Vite 7→8, ESLint 9→10, `@vitejs/plugin-react` 5→6. Dependabot only groups minor and patch updates, so these jumps never arrive by themselves; leaving them means the toolchain and the runtime libraries keep drifting away from upstream fixes.

## What Changes

- **Runtime libraries**: upgrade `@capacitor/{android,core,cli}` to 8.x, `pdfjs-dist` to 6.5.x, `lucide-react` to 1.x and `tailwind-merge` to 3.7.1 using `bun update` and a committed `bun.lock`.
- **pdf.js compatibility**: after the upgrade, re-audit the `Promise.try`, `URL.parse`, `Uint8Array.toHex`/`toBase64` polyfills in `src/lib/pdfjs-webview-polyfills.ts` and `scripts/patch-pdf-worker.mjs`. Remove any that the new version no longer needs and add any new API the older Android WebView lacks.
- **BREAKING — Capacitor 8**: adapt `android/` (Gradle plugin, plugin APIs, `capacitor.config.ts`) and re-run `bun run apk:sync` plus the APK smoke.
- **BREAKING — toolchain**: upgrade TypeScript 6.0.3 (7 is blocked: `typescript-eslint` only supports `<6.1`), Vite 8, `@vitejs/plugin-react` 6 and ESLint 10; fix config and type errors, keeping `tsc`, `lint`, `test` and the production build green.
- **Release sequencing**: three PRs with patch bumps (2.1.9, 2.1.10, 2.1.11), because every push to `main` publishes a release and Android needs a new `versionCode`.
- **New skill**: install and use `softaworks/agent-toolkit@dependency-updater` (4.1 K installs, repo with 2.7 K stars) for the upgrade workflow. No new runtime dependency.

This change does not alter product behavior: it is a dependency and tooling upgrade. Specs describe behavior, so there is no spec delta; `.openspec.yaml` sets `skip_specs: true`.

## Capabilities

### New Capabilities

None: no product behavior changes.

### Modified Capabilities

None.

## Impact

- `package.json` / `bun.lock`, `capacitor.config.ts`, `android/**`, `vite.config.ts`, `eslint.config.mjs`, `tsconfig.json`.
- `src/lib/pdfjs-webview-polyfills.ts`, `scripts/patch-pdf-worker.mjs`, `public/pdf.worker.min.mjs`, `public/pdfjs/**`.
- `src/components/**` only where TS 7 or lucide 1.x force API fixes.
- CI workflows and `.github/dependabot.yml` (major updates stay manual on purpose).
- Depends on PRs #7, #8 and #9 of `honest-reading-teleprompter` being merged first.
