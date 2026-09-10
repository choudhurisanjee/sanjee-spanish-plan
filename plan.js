// plan.js — Spanish study plan, Sep 14 2026 → Dec 27 2026
//
// This is the only file you hand-edit to change the plan.
// Editing `budget` affects weeks you have NOT yet opened in the app.
// Weeks already materialized keep whatever you set on them.
//
// Field notes:
//   goal        the forward-looking deadline in the header. Once its date
//               passes, the header falls back to weeks left in the plan.
//   phase.id    stable forever. Renaming a phase is fine; renumbering ids
//               orphans the weeks that recorded them.
//   type.code   the two-letter tag the app renders. `emoji` is kept for
//               your reference but is not drawn anywhere.
//   type.color  the hue for this activity, used on the code, the left rule
//               of each row, the glance strip and the progress bar.
//               `colorDark` is the same hue lightened for dark mode.
//               Add a type here and its colour flows through the app.
//   type.daily  renders as a seven-box strip instead of N tray items, and
//               `count` becomes "days per week" rather than "sessions".
//   budget.days which days a new week lands on. 0=Mon … 6=Sun, one entry
//               per session, so `count: 3, days: [0, 2, 5]` means Mon, Wed,
//               Sat. Sessions past the end of the list start in the tray.
//               Omit `days` to leave everything unscheduled. Daily types
//               ignore it -- they already cover the whole week.

const PLAN = {
  schemaVersion: 1,
  startDate: "2026-09-14",
  weekCount: 15,

  goal: {
    label: "DELE registration",
    short: "DELE",              // the header is narrow; keep this to ~6 chars
    date: "2026-11-18",
    note: "Week 10. The second B1 paper decides B1 or B2.",
  },

  activityTypes: {
    textbook: {
      label: "Textbook",
      code: "TB",
      color: "#2f6f8f", colorDark: "#6fb3d2",
      emoji: "📘",
      resources: [
        { label: "Aula Internacional Plus 2 (A2) — phase 1", url: "" },
        { label: "Aula Internacional Plus 3 (B1) — phases 2–4", url: "" },
        { label: "SpanishDict conjugator", url: "https://www.spanishdict.com/conjugation" },
        { label: "Language Transfer — Complete Spanish (audio, free)", url: "https://www.languagetransfer.org/" },
      ],
    },
    anki: {
      label: "Anki",
      code: "AN",
      color: "#9c6f08", colorDark: "#d6a437",
      emoji: "🃏",
      daily: true,
      resources: [
        { label: "Spanish Top 5000 frequency deck", url: "https://ankiweb.net/shared/decks" },
        { label: "AnkiDroid (free) / AnkiMobile (paid on iOS)", url: "https://apps.ankiweb.net/" },
      ],
    },
    listening: {
      label: "Listening",
      code: "LI",
      color: "#3f7a45", colorDark: "#74b87b",
      emoji: "🎧",
      resources: [
        { label: "Dreaming Spanish — intermediate ladder", url: "https://www.dreamingspanish.com/" },
        { label: "Radio Ambulante (podcast, Latin American)", url: "https://radioambulante.org/" },
        { label: "Mexican series, unsubtitled — Club de Cuervos, La Casa de las Flores", url: "" },
      ],
    },
    speaking: {
      label: "Swap",
      code: "SW",
      color: "#7d3fa8", colorDark: "#a58ae0",
      emoji: "💬",
      resources: [
        { label: "Chicago language exchange meetups", url: "https://www.meetup.com/find/?keywords=spanish%20language%20exchange&location=us--il--Chicago" },
        { label: "Tandem / HelloTalk — backup when a week has no meetup", url: "" },
        { label: "Rule: 30 min each language, timed. Ask to be corrected on tenses.", url: "" },
      ],
    },
    writing: {
      label: "Writing",
      code: "WR",
      color: "#a8397e", colorDark: "#e08ac0",
      emoji: "✍️",
      resources: [
        { label: "DELE B1 past paper writing tasks", url: "https://examenes.cervantes.es/es/dele/preparar-prueba" },
      ],
    },
    mock: {
      label: "Mock exam",
      code: "MO",
      color: "#b03a2e", colorDark: "#e0806f",
      emoji: "📝",
      resources: [
        { label: "Instituto Cervantes — modelos de examen (free)", url: "https://examenes.cervantes.es/es/dele/preparar-prueba" },
        { label: "DELE Chicago — dates & fees", url: "https://chicago.cervantes.es/en/diplomas_spanish/diplomas_dele_prices_dates_spanish.htm" },
      ],
    },
  },

  phases: [
    {
      id: "p1",
      name: "Phase 1 — Reactivation",
      weeks: [1, 2, 3],
      focus:
        "Sweep all of A2 at speed. Drop anything already solid. The goal is to find the real gaps, not to relearn everything.",
      budget: [
        { type: "anki", count: 5, targetMinutes: 20 },
        { type: "textbook", count: 3, targetMinutes: 45, days: [0, 2, 5] },
        { type: "listening", count: 4, targetMinutes: 30, days: [1, 3, 4, 6] },
        { type: "speaking", count: 1, targetMinutes: 60, days: [2] },
      ],
    },
    {
      id: "p2",
      name: "Phase 2 — Past tenses",
      weeks: [4, 5, 6, 7, 8],
      focus:
        "Preterite vs. imperfect until it is automatic. This is the biggest single gap and it gets the most weeks.",
      budget: [
        { type: "anki", count: 5, targetMinutes: 20 },
        { type: "textbook", count: 3, targetMinutes: 45, days: [0, 2, 5] },
        { type: "listening", count: 4, targetMinutes: 30, days: [1, 3, 4, 6] },
        { type: "speaking", count: 2, targetMinutes: 60, days: [2, 6] },
      ],
    },
    {
      id: "p3",
      name: "Phase 3 — Subjunctive",
      weeks: [9, 10, 11, 12],
      focus:
        "Present subjunctive, and the start of writing under time. Week 10 decides which exam you register for.",
      budget: [
        { type: "anki", count: 5, targetMinutes: 20 },
        { type: "textbook", count: 3, targetMinutes: 45, days: [0, 2, 5] },
        { type: "listening", count: 3, targetMinutes: 30, days: [1, 3, 6] },
        { type: "speaking", count: 2, targetMinutes: 60, days: [2, 6] },
        { type: "writing", count: 1, targetMinutes: 30, days: [5] },
      ],
    },
    {
      id: "p4",
      name: "Phase 4 — Consolidation",
      weeks: [13, 14, 15],
      focus:
        "Hold the habit through the holidays. Reduced volume by design — week 15 is Christmas and is meant to be light.",
      budget: [
        { type: "anki", count: 5, targetMinutes: 20 },
        { type: "textbook", count: 2, targetMinutes: 45, days: [0, 3] },
        { type: "listening", count: 3, targetMinutes: 30, days: [1, 4, 6] },
        { type: "speaking", count: 1, targetMinutes: 60, days: [2] },
        { type: "writing", count: 1, targetMinutes: 30, days: [5] },
      ],
    },
  ],

  milestones: [
    {
      id: "m01",
      week: 1,
      label: "Baseline B1 paper",
      detail:
        "Full past paper, all four sections, timed. For every error, mark whether you didn't know it or knew it but were too slow. Those need opposite fixes.",
    },
    {
      id: "m02",
      week: 2,
      label: "First language swap",
      detail: "Attend one. Being unready is the expected condition, not a reason to defer.",
    },
    {
      id: "m03",
      week: 3,
      label: "A2 gaps retested",
      detail: "Redo only the items you missed in week 1. Confirms the sweep worked before you build on it.",
    },
    {
      id: "m04",
      week: 5,
      label: "Narration recording",
      detail:
        "Five minutes, unscripted, narrating something that happened last week. Listen back. Tests preterite/imperfect in production, not recognition.",
    },
    {
      id: "m05",
      week: 6,
      label: "One episode, unsubtitled",
      detail: "Mexican series, start to finish, no subtitles. Followed the plot is the bar — not caught every word.",
    },
    {
      id: "m06",
      week: 8,
      label: "Thirty minutes, no English",
      detail: "A full swap half without switching. This is the habit that caps you below B2 if it survives.",
    },
    {
      id: "m07",
      week: 10,
      label: "Second B1 paper — registration decision",
      detail:
        "Compare against week 1. DELE 2027 registration opens Nov 18, inside this week. This result decides whether you register for B1 or go straight to B2.",
    },
    {
      id: "m08",
      week: 12,
      label: "Subjunctive production check",
      detail: "Same five-minute recording format, but on an opinion topic that forces the subjunctive.",
    },
    {
      id: "m09",
      week: 14,
      label: "First timed writing task",
      detail: "A real B1 writing prompt under exam conditions, handwritten, no dictionary.",
    },
    {
      id: "m10",
      week: 15,
      label: "Year-end mock and word count",
      detail:
        "Full B1 mock, plus your Anki mature-card count against the ~4,000 words B2 needs. Sets the spring plan.",
    },
  ],
};
