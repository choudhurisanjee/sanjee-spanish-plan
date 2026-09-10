// plan.js — Spanish study plan, Sep 14 2026 → Dec 27 2026
// Working target: DELE B1. Revisit B1 vs B2 in January on the week 15 evidence.
//
// This is the only file you hand-edit to change the plan.
// Editing `budget` affects weeks you have NOT yet opened in the app.
// Weeks already materialized keep whatever you set on them.
//
// Field notes — the app reads these, so keep them when you rewrite:
//   goal        the header countdown. Past its date it falls back to
//               weeks left in the plan.
//   phase.id    stable forever. Renaming a phase is fine; renumbering
//               ids orphans the weeks that recorded them.
//   type.code   the two-letter tag the app draws. `emoji` is kept for
//               your reference but is never rendered.
//   type.color  this activity's hue, used on the code, the row's left
//               rule, the glance strip and the progress bar.
//               `colorDark` is the same hue lightened for dark mode.
//   type.daily  renders as a seven-box strip instead of N tray items;
//               `count` becomes "days per week" rather than "sessions".
//   budget.days which days a new week lands on. 0=Mon … 6=Sun, one entry
//               per session, so `count: 3, days: [0, 2, 5]` is Mon/Wed/Sat.
//               Sessions past the end of the list start in the tray.

const PLAN = {
  schemaVersion: 1,
  startDate: "2026-09-14",
  weekCount: 15,

  goal: {
    label: "Year-end review",
    short: "REVIEW",           // the header is narrow; keep this short
    date: "2026-12-21",
    note: "Week 15. Sets B1 vs B2 on three months of evidence.",
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
      daily: true,
      emoji: "🃏",
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
        { label: "Mexican series, unsubtitled — pick two you'll actually watch", url: "" },
      ],
    },
    shadowing: {
      label: "Shadowing",
      code: "SH",
      color: "#7d3fa8", colorDark: "#a58ae0",
      emoji: "🔁",
      resources: [
        { label: "Method: play native audio, speak over it at full speed, don't pause", url: "" },
        { label: "Use a 60–90 sec clip, repeat until smooth, then move on", url: "" },
        { label: "Dreaming Spanish clips work well — you already know the content", url: "https://www.dreamingspanish.com/" },
      ],
    },
    monologue: {
      label: "Monologue",
      code: "ML",
      color: "#b03a63", colorDark: "#e08aab",
      emoji: "🎙️",
      resources: [
        { label: "DELE B1 oral prompts (tarea 1 y 2)", url: "https://examenes.cervantes.es/es/dele/preparar-prueba" },
        { label: "Method: read prompt, prep for the real exam time, record, listen back once", url: "" },
        { label: "Keep every recording. The archive is the progress metric.", url: "" },
      ],
    },
    writing: {
      label: "Writing",
      code: "WR",
      color: "#147a70", colorDark: "#5cb8ad",
      emoji: "✍️",
      resources: [
        { label: "DELE B1 past paper writing tasks", url: "https://examenes.cervantes.es/es/dele/preparar-prueba" },
      ],
    },
    mock: {
      label: "Mock exam",
      code: "MK",
      color: "#b0442e", colorDark: "#e0806f",
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
        "Sweep all of A2 at speed. Drop anything already solid. The goal is finding the real gaps, not relearning everything.",
      budget: [
        { type: "anki", count: 5, targetMinutes: 20 },
        { type: "textbook", count: 3, targetMinutes: 45 , days: [0, 2, 5] },
        { type: "listening", count: 4, targetMinutes: 30 , days: [1, 3, 4, 6] },
        { type: "shadowing", count: 2, targetMinutes: 15 , days: [1, 4] },
        { type: "monologue", count: 1, targetMinutes: 20 , days: [6] },
      ],
    },
    {
      id: "p2",
      name: "Phase 2 — Past tenses",
      weeks: [4, 5, 6, 7, 8],
      focus:
        "Preterite vs. imperfect until it's automatic. Biggest single gap, so it gets the most weeks. Shadowing steps up to three.",
      budget: [
        { type: "anki", count: 5, targetMinutes: 20 },
        { type: "textbook", count: 3, targetMinutes: 50 , days: [0, 2, 5] },
        { type: "listening", count: 4, targetMinutes: 30 , days: [1, 3, 4, 6] },
        { type: "shadowing", count: 3, targetMinutes: 15 , days: [1, 3, 4] },
        { type: "monologue", count: 1, targetMinutes: 25 , days: [6] },
      ],
    },
    {
      id: "p3",
      name: "Phase 3 — Subjunctive",
      weeks: [9, 10, 11, 12],
      focus:
        "Present subjunctive, plus writing under time. Monologues double — this is where output volume matters most.",
      budget: [
        { type: "anki", count: 5, targetMinutes: 20 },
        { type: "textbook", count: 3, targetMinutes: 50 , days: [0, 2, 5] },
        { type: "listening", count: 3, targetMinutes: 30 , days: [1, 3, 6] },
        { type: "shadowing", count: 3, targetMinutes: 15 , days: [1, 3, 4] },
        { type: "monologue", count: 2, targetMinutes: 25 , days: [2, 6] },
        { type: "writing", count: 1, targetMinutes: 30 , days: [5] },
      ],
    },
    {
      id: "p4",
      name: "Phase 4 — Consolidation",
      weeks: [13, 14, 15],
      focus:
        "Hold the habit through the holidays. Lighter by design — week 15 is Christmas and is meant to be easy.",
      budget: [
        { type: "anki", count: 5, targetMinutes: 20 },
        { type: "textbook", count: 2, targetMinutes: 45 , days: [0, 3] },
        { type: "listening", count: 3, targetMinutes: 30 , days: [1, 4, 6] },
        { type: "shadowing", count: 2, targetMinutes: 15 , days: [1, 4] },
        { type: "monologue", count: 1, targetMinutes: 25 , days: [6] },
        { type: "writing", count: 1, targetMinutes: 30 , days: [5] },
      ],
    },
  ],

  milestones: [
    {
      id: "m01",
      week: 1,
      label: "Baseline B1 paper",
      detail:
        "Full past paper, timed. For every error, mark whether you didn't know it or knew it but were too slow — those need opposite fixes. Record the oral section too, even though you can't score it properly.",
    },
    {
      id: "m02",
      week: 2,
      label: "First recording, two minutes",
      detail:
        "Any topic, unscripted. The point is clearing the hurdle of hearing yourself, not the content. Keep the file.",
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
        "Five minutes narrating something that happened last week. Tests preterite/imperfect in production, not recognition.",
    },
    {
      id: "m05",
      week: 6,
      label: "One episode, unsubtitled",
      detail: "Mexican series, start to finish. Following the plot is the bar, not catching every word.",
    },
    {
      id: "m06",
      week: 8,
      label: "Recording audit",
      detail:
        "Play week 2 and week 5 back to back. Count filler pauses and English substitutions in each. This is your only speaking metric until January.",
    },
    {
      id: "m07",
      week: 10,
      label: "Second B1 paper",
      detail:
        "Compare against week 1. DELE 2027 registration opens Nov 18 this week, but the May 22 sitting's deadline isn't until April 7 — no need to commit now. This is evidence, not a decision point.",
    },
    {
      id: "m08",
      week: 12,
      label: "Subjunctive production check",
      detail: "Same recording format, but an opinion prompt that forces the subjunctive.",
    },
    {
      id: "m09",
      week: 14,
      label: "First timed writing task",
      detail: "A real B1 prompt under exam conditions, handwritten, no dictionary.",
    },
    {
      id: "m10",
      week: 15,
      label: "Year-end review",
      detail:
        "Full B1 mock, Anki mature-card count, and pick a specific January swap to attend. Set B1 vs B2 here, with three months of evidence.",
    },
  ],
};
