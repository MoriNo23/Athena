<div align="center">

<img src="public/brand/athena-wordmark.svg" alt="ATHENA" height="76" />

### FINISH YOUR BOOKS.

A local-first reading app that treats **the last page** as the product.

React 19 · Next.js 16 · TypeScript · Tailwind 4 · Prisma + SQLite · PDF.js

</div>

---

## THE PROBLEM

People don't abandon books at a bad chapter. They abandon them when the habit dies.

One missed day becomes three. Three becomes "I'll restart next month." Meanwhile every
e-reader on earth shows you the same sterile thing: a percentage. A number that shames
you instead of moving you.

**Athena is built on a different contract:**

> Your library lives on your machine, and the app's only job
> is to get you back on the rail today.

The rail — *el riel* — is a segmented progress track that lives under every book.
It has milestones, it has a streak, it tells you the honest ETA to the final page,
and it throws confetti when you cross a milestone. Not gamification noise. One clear
instrument, tuned for consistency.

## WHAT IT LOOKS LIKE

| The library at night — *egean* blue | The library by day — *marble* morning |
|:---:|:---:|
| ![Library, dark](.github/assets/library-dark.png) | ![Library, light](.github/assets/library-light.png) |

| Teleprompter — one stream, letter by letter | The same stream by day — the type is yours (A− / A+) |
|:---:|:---:|
| ![Teleprompter, dark](.github/assets/teleprompter-dark.png) | ![Teleprompter, light](.github/assets/teleprompter-light.png) |

### What you get

- **Rail + streak + ETA** under every book — honest progress, not a percentage.
- **Teleprompter** — one continuous stream, letter by letter, font `0.8×–1.6×`, rewind with `←`.
- **Immersion** — UI hides on idle (`H`), fullscreen with wider measure, teleprompter controls fade out.
- **EPUBs & PDFs** paginated the same way (~320 words/virtual page); rail and header track real pages.
- **Literature settings** — X-ray, outline, dictionary, natural pauses, argument skeleton, locked notes, dual read.
- **ES / EN / PT** — interface, dates, everything switches.
- **Neo-brutalist UI** — zero radius, hard 2px borders, offset shadows, buttons that press.
- **Offline-first** — your library (`db/custom.db` + `public/uploads/`) never leaves your machine.

## RUN IT

**Prerequisites:** [Bun](https://bun.sh) (it replaces Node + npm), any modern browser.
Internet is only needed for the install and the first OCR language download —
**reading works offline.**

```bash
git clone https://github.com/MoriNo23/Athena.git
cd Athena

cp .env.example .env     # one line: DATABASE_URL=file:../db/custom.db
bun install              # also runs prisma generate (postinstall)
bunx prisma db push      # creates the empty SQLite library on first run
bun run dev              # → http://localhost:3000
```

Drop a PDF or EPUB on the library. That's the whole onboarding.

> Why `file:../db/custom.db`? Prisma resolves the SQLite path relative to
> `prisma/`, so this single line lands the library at `<repo>/db/custom.db`
> on any machine — no edits, no absolute paths, no `prisma/db/` strays.

**Everyday scripts:**

| Command | What it does |
|---|---|
| `bun run dev` | Dev server on port 3000 |
| `bun run build` + `bun run start` | Optional production mode |
| `bun run lint` | ESLint pass |
| `bun run db:push` | Apply Prisma schema changes |

Your books, covers and progress live in `db/custom.db` + `public/uploads/` — copy those
two to back everything up. They are gitignored on purpose: **your library never leaves
your machine.** The Spanish quick-start guide with troubleshooting lives in
[`LEEME.md`](LEEME.md).

## RELEASE CHECKLIST

Everything a clone must pass before a release or a pull request — run them from
the repo root, in this order:

```bash
bunx tsc --noEmit        # 0 type errors
bun run lint             # 0 errors, 0 warnings
bun run build            # production build compiles
```


## LICENSE

[MIT](LICENSE) — clone it, modify it, self-host it. Your library stays yours.

---

<div align="center">

**ATHENA** — *the rail takes you to the last page.*

</div>
