# Build prompt — Spanish study tracker (v2)

> **Status: built.** This spec is kept as the record of what was decided and
> why. The app is the source of truth now — see `../README.md`.
>
> Two things here were superseded during the build:
>
> 1. **Visual language.** The instruction to match the triathlon plan's
>    palette and emoji was dropped. The app uses the "study ledger"
>    treatment instead: monospace, hairline rules, two-letter activity
>    codes, one accent. See `design-direction.html` for the pitch.
> 2. **Storage.** localStorage-plus-manual-export was judged too fragile
>    for a 15-week run on iOS. Gist sync shipped in v1, not v1.1, and
>    localStorage is now the working copy rather than the system of record.

Paste into Claude Code in an empty repo. Plan content is stubbed; `plan.js` gets rewritten by hand later.

---

Build a mobile-only web app for tracking a personal Spanish study plan. Static site, no build step, deployed to GitHub Pages. Target device is an iPhone 15 in Safari, installed to the home screen.

## Constraints

- No build step, no framework, no npm. Vanilla JS and CSS.
- Files: `index.html`, `app.js`, `plan.js`, `styles.css`, `sw.js`, `manifest.json`, `icons/` (PNG), `fonts/` (woff2).
- **No ES modules.** Use plain `<script src>` with no `type="module"`, so the app also works when `index.html` is opened directly from disk. (Service-worker caching won't run over `file://` — that's expected and fine.)
- Mobile only. Design for a 390pt viewport. A centered `max-width: 480px` column is the whole desktop story.
- All state in `localStorage`, plus file-based export/import. No accounts, no network calls at runtime.

## Visual language

The same person's other planning tool is <https://choudhurisanjee.github.io/sanjee-tri-plan/>. These should read as siblings. Its design tokens, to reuse directly:

```css
:root {
  /* base */
  --paper:  #f0f0ec;   /* page background */
  --ink:    #1e2022;   /* text, and the dark header bar */
  --accent: #1a6b8a;
  --muted:  #666;
  --hairline: #ddd;

  /* one bg/border/text triplet per activity type */
  --grammar-bg: #cce8f4;  --grammar-border: #1a6b8a;  --grammar-text: #0d4a63;
  --anki-bg:    #fde9b0;  --anki-border:    #c47a0a;  --anki-text:    #7a4c00;
  --listen-bg:  #d4edcc;  --listen-border:  #3a8c3f;  --listen-text:  #1f5c24;
  --speak-bg:   #e8d5f7;  --speak-border:   #7c3aed;  --speak-text:   #4a1a9e;
  --mock-bg:    #fff0ee;  --mock-border:    #c0392b;  --mock-text:    #8c2419;
  --idle-bg:    #e8e8e4;  --idle-border:    #aaa;     --idle-text:    #666;
}
```

Typography: `DM Sans` (300/400/500/600) for UI, `DM Mono` (400/500) for dates, counts, and minutes. Base size 14px, `line-height: 1.4`, dense.

**Self-host the fonts** — put the woff2 files in `fonts/` and declare `@font-face` with `font-display: swap`. Do not `@import` from Google Fonts; that breaks offline and adds a render-blocking round trip. Fall back to `system-ui, sans-serif` and `ui-monospace, monospace`.

Structural cues to carry over: a dark full-bleed header bar with the plan name on the left and a goal badge on the right; emoji as the primary activity marker; phase-grouped content; generous use of the color triplets as soft chips rather than heavy fills.

## Data model

Two separate things. Do not conflate them.

### 1. The plan — static, in `plan.js`, committed

```js
const PLAN = {
  schemaVersion: 1,
  startDate: "2026-09-14",        // Monday of week 1, local time
  weekCount: 15,
  goal: { label: "DELE B2", date: "2026-12-20" },   // drives the header badge + countdown
  activityTypes: {
    grammar:   { label: "Grammar",   emoji: "📘", token: "grammar", resources: [{ label, url }] },
    anki:      { label: "Anki",      emoji: "🃏", token: "anki",    daily: true, resources: [...] },
    listening: { label: "Listening", emoji: "🎧", token: "listen",  resources: [...] },
    speaking:  { label: "Swap",      emoji: "💬", token: "speak",   resources: [...] },
    mock:      { label: "Mock exam", emoji: "📝", token: "mock",    resources: [...] },
  },
  phases: [
    {
      id: "p1",                   // stable — never renumber
      name: "Phase 1 — Foundations",
      weeks: [1, 2, 3, 4, 5],
      focus: "One line on what this phase is for.",
      budget: [                   // the weekly template for this phase
        { type: "grammar",   count: 3, targetMinutes: 45 },
        { type: "anki",      count: 5, targetMinutes: 20 },
        { type: "listening", count: 4, targetMinutes: 30 },
        { type: "speaking",  count: 2, targetMinutes: 60 },
      ],
    },
    // Phases 2 and 3, same shape, ids "p2" / "p3"
  ],
  milestones: [
    { id: "m1", week: 2, label: "Placeholder", detail: "Placeholder" },   // ids stable, never reused
  ],
};
```

Stub three phases of five weeks with plausible budgets and milestone labels. `plan.js` must be obvious to hand-edit — it is the file that gets rewritten repeatedly. Comment it accordingly, including the note that editing `budget` only affects weeks that haven't been materialized yet.

### 2. Week state — per week, in `localStorage`

Key: `spanish:week:<ISO Monday>`, e.g. `spanish:week:2026-09-14`.

```js
{
  schemaVersion: 1,
  weekStart: "2026-09-14",
  phaseId: "p1",            // recorded at materialization; survives plan re-cuts
  items: [
    { id, type: "grammar", targetMinutes: 45,
      day: null,            // null = unscheduled, else 0–6 (Mon–Sun)
      done: false, actualMinutes: null, note: "" }
  ],
  daily: { anki: [false,false,false,false,false,false,false] },  // one array per daily-flagged type
  weekNote: "",
  milestonesDone: ["m1"]
}
```

A week is materialized from its phase's `budget` the first time it is *rendered*. Never regenerate a week that already exists in storage. Items can be added or deleted freely beyond the template.

### Rules the model has to enforce

- **Dates are local, never UTC.** `new Date("2026-09-14")` parses as UTC midnight and renders as Sunday Sept 13 in US Central. Build every date with `new Date(y, m - 1, d)` and format with manual `getFullYear/getMonth/getDate`. Do not use `toISOString()` to derive a local date key — write a `toKey(date)` helper and use it everywhere. This is the single most likely bug in the app; get it right once, centrally.
- **Materializing a week must not affect Progress.** Peeking at week 12 in September should not add its target minutes to your denominator. Progress counts weeks whose Monday is on or before the current week's Monday, whether or not they exist in storage. Materialization is a storage detail; elapsed time is the denominator.
- **Week rollover is not a debt ledger.** Undone items do not carry forward. When a week ends, whatever is left in its tray stays in that week and stops being visible unless you navigate back to it.
- **Plan edits never touch stored weeks.** Weeks are keyed by date, so changing `startDate` orphans existing weeks rather than corrupting them. Keep rendering and counting orphans; show them under a neutral "Off-plan" phase label. Provide an explicit per-week **Reset to template** action, confirmed, for when the plan is re-cut and you want a not-yet-started week to pick up the new budget.
- Generate ids with `crypto.randomUUID()` when available, with a short random-string fallback — `randomUUID` needs a secure context and can be missing over `file://`.

## Screens

Two tabs in a bottom bar: **Week** and **Progress**. Milestones do not get a tab — they show up inline in the week they belong to, which is where you'd actually notice them, and again as a list at the bottom of Progress.

### Week (default)

Header: phase name, focus line, week number and date range, and a compact `4.5 / 8.0 hrs` planned-vs-done summary. Prev/next arrows to move between weeks; a "today" affordance to jump back.

Then, in order:

1. **Milestone card**, if this week has one. Rendered clearly unlike a session — full-width, bordered, checkable. These are anchors, not chores.
2. **Daily strip**, for any activity type flagged `daily: true`. Seven small labelled checkboxes in a single row, Mon–Sun, with today emphasized. Anki is a daily habit; five discrete tray items models it badly.
3. **Unscheduled tray.** Items not yet assigned to a day — the visible representation of remaining budget. When empty, say so plainly and warmly. Never style it as a backlog.
4. **Day list.** Seven rows, Mon–Sun, vertical, each listing its assigned items. Not a 7-column grid.

**Two tap targets per item, and this matters.** Tapping the item's emoji/checkbox marks it done immediately at its target minutes — the common case is one tap. Tapping the item body opens the sheet.

The sheet contains: seven day chips to assign or reassign, a done toggle, a minutes input, a note field, delete, and the resource links for that activity type. **No drag and drop.**

Today gets visual emphasis. Past incomplete days read as past — dimmed, neutral. No red, no warnings, no counts of what you missed.

### Progress

- Cumulative actual minutes per activity type against cumulative target, one horizontal bar per type. No charting library.
- Total hours to date, and weeks remaining until `goal.date`.
- A per-week row of small bars across all 15 weeks — sparkline in spirit, plain divs in practice.
- The full milestone list, grouped by phase, with week and date, checkable here too.
- Footer: export, import, and a "last backup" timestamp.

## Storage durability — read this before building

This is the part that decides whether the app survives 15 weeks.

iOS Safari deletes all script-writable storage — including `localStorage` — after **7 days without user interaction with the site**. Home-screen web apps are exempt: they are outside Safari, keep their own use counter, and ITP skips them. So installing to the home screen is not cosmetic polish; it is the durability mechanism.

Two consequences that must shape the build:

1. **Home-screen storage is a separate jar from Safari's.** Data entered in Safari does not appear in the installed app. Ship a small first-run note: install to the home screen *first*, then start logging.
2. **Even installed, storage is not guaranteed.** Clearing Safari website data, deleting the icon, or storage pressure will take it. Export has to be effortless and habitual.

So:

- **Export** writes a `.json` file via `Blob` + `<a download>` — it lands in Files on iOS. Also offer copy-to-clipboard as a secondary path. Filename `spanish-YYYY-MM-DD.json`.
- **Import** accepts a file via `<input type="file">` and a paste-a-blob textarea. Validate shape and `schemaVersion` before writing. Show what it will do — "replaces 6 weeks, 84 items" — and require confirmation.
- Before any import or destructive action, snapshot current state to `spanish:backup:prev` so there is exactly one level of undo.
- Surface a quiet "last exported N days ago" line on Progress once it exceeds 14 days. One line, no nagging.
- Put reads and writes behind a tiny `store.get/set/list` adapter rather than calling `localStorage` inline. If a remote sync is added later it should be one file, not a refactor.

**Schema versioning.** Every record carries `schemaVersion`. On load, if the stored version is below `PLAN.schemaVersion`, run `migrate(record)` — write the scaffold with an empty `1 → 2` case and a comment about what belongs there. Migrations run on read and write back on success. Editing `plan.js` and redeploying must never destroy saved weeks.

## iPhone specifics

- `<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">`. Do **not** set `maximum-scale=1` — it blocks pinch-zoom.
- Respect safe areas: `padding-top: env(safe-area-inset-top)` on the header, `padding-bottom: env(safe-area-inset-bottom)` on the tab bar and the bottom sheet. Dynamic Island and the home indicator will otherwise clip content.
- `<meta name="apple-mobile-web-app-capable" content="yes">` and `apple-mobile-web-app-status-bar-style` = `black-translucent`, paired with the top inset padding so the dark header runs under the status bar cleanly.
- `manifest.json`: `name`, `short_name`, `display: "standalone"`, `theme_color: "#1e2022"`, `background_color: "#f0f0ec"`, `start_url: "./"`, icons at 192 and 512.
- `apple-touch-icon` at 180×180, **PNG, fully opaque** — iOS ignores SVG here and composites transparency to black.
- **All inputs at `font-size: 16px` minimum.** Anything smaller makes iOS zoom the viewport on focus and it does not zoom back out.
- Minutes field: `inputmode="numeric"`, not `type="number"`. Prefill with target so the common case is confirm-and-dismiss.
- `overscroll-behavior: none` on body; `-webkit-tap-highlight-color: transparent`.

## Offline

`sw.js`: cache-first over a hardcoded list of the app's own files, with a version constant at the top to bump on deploy. Roughly 30 lines. Register it only when `location.protocol !== 'file:'`. Without a service worker an installed iOS web app shows an error page when offline, so this is required, not optional.

## Quality floor

Touch targets at least 44pt. No layout shift when an item is checked — reserve the space. Writes debounced ~300ms and flushed on `visibilitychange` so a mid-edit app switch doesn't lose the note you were typing. Respect `prefers-reduced-motion`. Animate only what confirms an action: an item moving from the tray to a day should be visible; nothing else needs motion.

## Deliverable

Build it, then walk me through:
1. The file structure and what each file owns.
2. How to edit `plan.js` — adding a phase, changing a budget, adding a milestone — and what each edit does to already-saved weeks.
3. How to run it locally (`python3 -m http.server 8000`) and reach it from the phone on the same network.
4. The exact deploy steps to GitHub Pages, including bumping the service worker cache version.
