## What this PR does

<!-- 1-3 lines. Link the issue if there is one. -->

## How to test it

<!-- Concrete steps: commands, pages, expected results. -->

## Checklist

- [ ] `bunx tsc --noEmit` passes
- [ ] `bun run lint` passes
- [ ] `bun test` passes
- [ ] If `prisma/schema.prisma` changed → migration included
- [ ] If any `src/app/api/**` route changed → `public/athena-offline.js`
      and `tests/offline-engine.test.ts` updated with the same contract
- [ ] If reading UI changed → smoke-tested in the APK (not only desktop browser)
- [ ] Keeps the product contract: local-first, no cloud, no accounts, no telemetry
