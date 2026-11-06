# Contributing to Athena

Thanks for your interest. Athena is a local-first reader: no accounts, no
cloud, no telemetry. Read `docs/PRODUCT.md` first — it is the constitution;
anything that contradicts it gets rejected.

## House rules

All the rules live in `AGENTS.md` (short, in Spanish). The essentials:

- TypeScript strict, Bun, Next.js App Router, Tailwind (no inline styles).
- Every API response follows `{ ok: boolean, data?: T, error?: string }`.
- The Android offline engine (`public/athena-offline.js`) mirrors the API
  routes over IndexedDB/OPFS. One contract, two sides, same PR.
- Conventional Commits, English, first line ≤ 72 chars.
- Branches: `feat/…`, `fix/…`, `refactor/…`, `docs/…`, `chore/…` → PR into `main`.

## Workflow

1. Branch from an up-to-date `main`.
2. Make the change — one logical change per PR.
3. Run the gate locally:

   ```bash
   bunx tsc --noEmit
   bun run lint
   bun test
   ```

4. Open the PR using the template. CI must be green before merge.

## Reporting bugs

Use the bug report template and say where it happened (PC server or Android
APK): the fix usually lives on a different side of the contract.

## License

MIT. By contributing you agree that your contributions are MIT-licensed.
