<div align="center">

<img src="public/brand/athena-wordmark.svg" alt="ATHENA" height="76" />

### FINISH YOUR BOOKS.

A local-first reading app that treats **the last page** as the product.

React 19 · Vite · Express · TypeScript · Tailwind 4 · Prisma + SQLite · PDF.js

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
- **Keyboard shortcuts** — a shortcuts panel in the library and reader menus
  (Android and desktop): every key, what it does, in your language. The
  ghost reminder only appears on real desktop input — no desktop overlays
  on your phone.
- **Home copy** — pull/push your library and progress between the Android app
  and your own server over your home network, always by hand (Amendment 1:
  no cloud, no accounts, silent degradation).
- **Neo-brutalist UI** — zero radius, hard 2px borders, offset shadows, buttons that press.
- **Offline-first** — your library lives on your machine (data home at
  `~/.local/share/athena`), never on someone else's server.

## THE STACK (deliberately boring)

One Vite SPA (`index.html` + `login.html`) served by one Express server
(`server/index.ts`) that also hosts the `/api/**` routes and the password
lock. No framework runtime, no SSR, no Node modules magic: `bun run build`
produces `dist/` (web) + `server-dist/server.cjs` (server) and Node serves
it all from one port. The APK is the same SPA compiled without the login
page — the offline engine (`public/athena-offline.js`) answers `/api/*`
inside the WebView over IndexedDB/OPFS.

## INSTALL

**Prerequisites:** [Bun](https://bun.sh) (it replaces Node + npm), any modern browser.
Internet is only needed for the install and the first OCR language download —
**reading works offline.**

### Debian / Ubuntu — installer

Download `athena_<version>_amd64.deb` from
[releases](https://github.com/MoriNo23/Athena/releases) and:

```bash
sudo apt install ./athena_<version>_amd64.deb   # app in /opt/athena + `athena` on your PATH
athena init      # first time only: data home + schema
athena start     # → http://localhost:3000   (LAN mode: athena start --lan)
```

The package ships the production build — nothing recompiles. Your data lives
in the data home (`~/.local/share/athena`), so updates and removals never
touch a single book.

### Docker

```bash
git clone https://github.com/MoriNo23/Athena && cd Athena
docker compose up -d --build
```

### Linux tarball — build included

`Athena-<version>-linux-x64.tar.gz` from
[releases](https://github.com/MoriNo23/Athena/releases): unpack it and follow
the `COMO-ARRANCAR.txt` inside — no compilation, straight to reading.

### Android — offline APK

`Athena-v<version>.apk` from
[releases](https://github.com/MoriNo23/Athena/releases): the same app in a
WebView with an offline engine that mirrors the whole experience on-device —
including the **home copy**: pull or push your library and progress to your
own computer over the home network, always by hand.

### From source

```bash
git clone https://github.com/MoriNo23/Athena.git
cd Athena

cp .env.example .env     # one line: DATABASE_URL=file:../db/custom.db
bun install              # also runs prisma generate (postinstall)
bunx prisma db push      # creates the empty SQLite library on first run
bun run dev              # → http://localhost:3000
```

Drop a PDF or EPUB on the library. That's the whole onboarding.

> **Sizes:** each book can weigh up to **200 MB** (PDF or EPUB). The upload
> path has a 256 MB transport cap so heavy books reach the API whole; above
> 200 MB the API answers 413 with a friendly notice.

> Why `file:../db/custom.db`? Prisma resolves the SQLite path relative to
> `prisma/`, so this single line lands the library at `<repo>/db/custom.db`
> on any machine — no edits, no absolute paths, no `prisma/db/` strays.

**Everyday scripts:**

| Command | What it does |
|---|---|
| `bun run dev` | Dev: Vite web on 3000 + Bun API on 3001 |
| `bun run build` + `bun run start` | Production mode (Node serves web + API) |
| `bun run lint` | ESLint pass |
| `bun run db:push` | Apply Prisma schema changes |
| `bun run athena` | House CLI: `init · start · doctor · backup · bundle · home` |

Your books, covers and progress live **outside the code**: new installs keep
them in the data home (`~/.local/share/athena`, overridable with
`ATHENA_HOME`); the classic in-repo layout (`db/` + `public/uploads/`) still
works. They are gitignored on purpose: **your library never leaves your
machine.**

## RELEASE CHECKLIST

Everything a clone must pass before a release or a pull request — run them from
the repo root, in this order:

```bash
bunx tsc --noEmit        # 0 type errors
bun run lint             # 0 errors, 0 warnings
bun test                 # full suite green (the CI workflow enforces all three)
bun run build            # production build compiles (dist/ + server-dist/)
```


## LICENSE

[MIT](LICENSE) — clone it, modify it, self-host it. Your library stays yours.

---

<div align="center">

**ATHENA** — *the rail takes you to the last page.*

</div>
