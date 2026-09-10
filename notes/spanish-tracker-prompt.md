# Build prompt — Spanish study tracker

Paste this into Claude Code in an empty repo. Content is deliberately stubbed; the plan data gets filled in later.

---

Build a mobile-only web app for tracking a personal Spanish study plan, deployed as a static site on GitHub Pages.

## Constraints

- No build step. Plain `index.html`, `app.js`, `styles.css`, plus `manifest.json` and an icon. It must work by opening `index.html` directly and by pushing to a `gh-pages`-style GitHub Pages repo with no CI.
- No backend, no framework, no npm dependencies. Vanilla JS and CSS.
- Mobile only. Target a 390px viewport. Do not build a desktop layout — a sensible max-width centered column is enough.
- All state in `localStorage`. No accounts, no network calls.

## Reference for visual language

Fetch `https://choudhurisanjee.github.io/sanjee-tri-plan/` and match its visual language: the phase-grouped structure, the emoji activity markers, the density, the typography feel. This is the same person's second planning tool and they should look related. Follow that reference over any default styling instincts.

## Data model

Two separate things. Do not conflate them.

**1. The plan (static, defined in `plan.js`, committed to the repo)**

```js
const PLAN = {
  schemaVersion: 1,
  startDate: "2026-09-14",   // Monday of week 1
  weekCount: 15,             // through week of 2026-12-21
  activityTypes: {
    grammar:   { label: "Grammar", emoji: "📘", resources: [...] },
    anki:      { label: "Anki",    emoji: "🃏", resources: [...] },
    listening: { label: "Listening", emoji: "🎧", resources: [...] },
    speaking:  { label: "Swap",    emoji: "💬", resources: [...] },
    mock:      { label: "Mock exam", emoji: "📝", resources: [...] },
  },
  phases: [
    {
      name: "Phase 1 — <name>",
      weeks: [1, 2, 3, 4, 5],
      focus: "<one line>",
      budget: [                       // the weekly template for this phase
        { type: "grammar",   count: 3, targetMinutes: 45 },
        { type: "anki",      count: 5, targetMinutes: 20 },
        { type: "listening", count: 4, targetMinutes: 30 },
        { type: "speaking",  count: 2, targetMinutes: 60 },
      ],
    },
    // Phases 2 and 3 — same shape
  ],
  milestones: [
    { week: 2, label: "<placeholder>", detail: "<placeholder>" },
  ],
};
```

Stub the content: three phases of five weeks, plausible placeholder budgets and milestone labels. Make `plan.js` obvious to hand-edit — this file gets rewritten repeatedly. Note in a comment that changing `budget` only affects weeks not yet materialized.

**2. Week state (per-week, in `localStorage`)**

Keyed by the ISO date of that week's Monday, e.g. `spanish:week:2026-09-14`.

```js
{
  schemaVersion: 1,
  weekStart: "2026-09-14",
  items: [
    { id: "<uuid>", type: "grammar", targetMinutes: 45,
      day: null,            // null = unscheduled, else 0–6 (Mon–Sun)
      done: false,
      actualMinutes: null,
      note: "" }
  ],
  milestonesDone: ["<milestone id>"]
}
```

A week is materialized from its phase's `budget` the first time it's opened, then edited independently. Never regenerate a week that already exists in storage. Items can be added or deleted by the user beyond the template.

## Screens

Three, with a bottom tab bar.

**Week (default).** Shows the current week, with prev/next arrows to move between weeks. Two zones:

- *Unscheduled tray* at top — items not yet assigned to a day. This is the visible representation of remaining budget. When empty, say so plainly.
- *Day list below* — seven rows, Mon–Sun, each listing its assigned items. Vertical list, not a 7-column grid.

Tapping an item opens a bottom sheet with: seven day chips to assign or reassign, a done toggle, a minutes input, a note field, delete, and the resource links for that activity type. **No drag and drop.** Assignment is tap-to-open, tap-a-chip, done.

Show the week's phase name and focus line at the top, and a compact planned-vs-done summary (e.g. `4.5 / 8.0 hrs`).

**Progress.** Cumulative actual minutes per activity type against cumulative target, across all materialized weeks. A simple horizontal bar per type is enough — no charting library. Plus total hours to date, and a per-week sparkline-style row if it stays simple. Weeks not yet reached are not counted against you.

**Milestones.** All milestones from the plan, grouped by phase, with their week and date. Checkable, and rendered clearly differently from ordinary sessions — these are the navigation anchors, not chores.

## Non-obvious requirements

- **Export / import.** A button that copies all state as JSON to the clipboard, and a paste-to-import that validates before overwriting. Clearing browser data must not be an unrecoverable event.
- **Schema versioning.** Store `schemaVersion` in every record. On load, if the stored version is lower than `PLAN.schemaVersion`, run a migration function (write the scaffold with an empty v1→v2 case). Editing `plan.js` and redeploying must never destroy saved weeks.
- **Home screen install.** `manifest.json` with name, standalone display, theme color, and a 180px `apple-touch-icon`. It should look like an app when added to a phone home screen, including no browser chrome and a correct status bar treatment.
- **Resources live on activity types, not sessions.** One link list per type, surfaced in the item sheet.
- **Minutes are the progress signal.** The done checkbox alone is not enough — prompt for actual minutes when marking done, defaulting to the target so it stays one tap when accurate.
- **Today gets visual emphasis** in the day list. Past incomplete days should read as past, not as failures — no red, no warnings.

## Quality floor

Works offline after first load. Touch targets at least 44px. No layout shift when items are checked. State writes are debounced and survive a mid-edit app switch. Respect `prefers-reduced-motion`. Animate only what confirms an action — an item moving from the tray to a day should be visible, nothing else needs motion.

Build it, then walk me through the file structure and how to edit `plan.js`.
