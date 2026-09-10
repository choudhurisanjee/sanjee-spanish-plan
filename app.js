/* app.js — Español study tracker.
 *
 * Two things live here and they are deliberately not the same thing:
 *   PLAN   static, from plan.js, committed to the repo, safe to rewrite.
 *   weeks  per-week records in localStorage, keyed by the ISO date of
 *          that week's Monday. Never regenerated once they exist.
 *
 * Nothing in this file uses innerHTML. Notes are user text and a GitHub
 * token lives in localStorage, so every string goes in via textContent.
 */

/* ── dates ──────────────────────────────────────────────────────────
 * All local, never UTC. `new Date("2026-09-14")` parses as UTC midnight
 * and renders as Sunday the 13th in Chicago, which would shift the whole
 * app by a day. Build dates componentwise and format them by hand.
 */

const DAY_NAMES = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const DAY_MS = 86400000;

function ymd(d) {
  return d.getFullYear() + "-" +
    String(d.getMonth() + 1).padStart(2, "0") + "-" +
    String(d.getDate()).padStart(2, "0");
}
function parseYmd(s) {
  const p = String(s).split("-").map(Number);
  return new Date(p[0], p[1] - 1, p[2]);
}
function addDays(d, n) { return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n); }
function today() { const n = new Date(); return new Date(n.getFullYear(), n.getMonth(), n.getDate()); }
function mondayOf(d) { return addDays(d, -((d.getDay() + 6) % 7)); }
function shortDate(d) { return MONTHS[d.getMonth()] + " " + String(d.getDate()).padStart(2, "0"); }

/* Rounding matters: DST ends inside this plan, so a raw ms division
   between two Mondays can come out at 6.958 weeks instead of 7. */
function daysBetween(a, b) { return Math.round((b - a) / DAY_MS); }

const PLAN_START = mondayOf(parseYmd(PLAN.startDate));

function weekIndexOf(monday) { return Math.round(daysBetween(PLAN_START, monday) / 7) + 1; }
function mondayForWeek(i) { return addDays(PLAN_START, (i - 1) * 7); }
function phaseForWeek(i) {
  return PLAN.phases.find(function (p) { return p.weeks.indexOf(i) !== -1; }) || null;
}
function phaseById(id) {
  return PLAN.phases.find(function (p) { return p.id === id; }) || null;
}
/* plan.js is meant to be rewritten by hand, so a rewrite that drops
   `code` or `color` must degrade rather than render blanks. Codes fall
   back to the first two letters of the label; a missing colour just
   inherits the muted default through var(--tc, ...) in the stylesheet. */
function typeOf(t) {
  const d = PLAN.activityTypes[t] || {};
  const label = d.label || t;
  return {
    label: label,
    code: d.code || label.slice(0, 2).toUpperCase(),
    daily: Boolean(d.daily),
    resources: d.resources || [],
  };
}

function uid() {
  if (self.crypto && crypto.randomUUID) return crypto.randomUUID();
  return "i" + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

/* ── storage ────────────────────────────────────────────────────── */

const K_WEEK = "spanish:week:";
const K_META = "spanish:meta";
const K_PREV = "spanish:backup:prev";
const K_CONFLICT = "spanish:backup:conflict";

const Store = {
  raw: function (key) {
    try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : null; }
    catch (e) { console.warn("unreadable record", key, e); return null; }
  },
  write: function (key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); return true; }
    catch (e) { toast("Storage full — export now"); console.error(e); return false; }
  },
  remove: function (key) { localStorage.removeItem(key); },
  weekKeys: function () {
    const out = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.indexOf(K_WEEK) === 0) out.push(k.slice(K_WEEK.length));
    }
    return out.sort();
  },
  getWeek: function (key) {
    const rec = Store.raw(K_WEEK + key);
    return rec ? migrate(rec) : null;
  },
  putWeek: function (rec) { Store.write(K_WEEK + rec.weekStart, rec); },
  meta: function () {
    return Store.raw(K_META) || { schemaVersion: PLAN.schemaVersion, updatedAt: 0, lastExport: null, sync: {} };
  },
  putMeta: function (m) { Store.write(K_META, m); },
};

/* Runs on every read. Bump PLAN.schemaVersion and add a case when the
   week record shape changes; the record is written back on success so a
   migration only ever runs once per record. */
function migrate(rec) {
  let v = rec.schemaVersion || 1;
  if (v === PLAN.schemaVersion) return rec;

  // if (v === 1) { ...reshape rec...; v = 2; }

  if (v !== PLAN.schemaVersion) {
    console.warn("week " + rec.weekStart + " is schema v" + v + ", app is v" + PLAN.schemaVersion);
    return rec;
  }
  rec.schemaVersion = v;
  Store.write(K_WEEK + rec.weekStart, rec);
  return rec;
}

function touch() {
  const m = Store.meta();
  m.updatedAt = Date.now();
  Store.putMeta(m);
  Sync.schedulePush();
}

/* ── materialisation ────────────────────────────────────────────── */

function blankWeek(key, phase) {
  return {
    schemaVersion: PLAN.schemaVersion,
    weekStart: key,
    phaseId: phase ? phase.id : null,
    items: [],
    daily: {},
    weekNote: "",
    milestonesDone: [],
  };
}

/* The nth session of a budget entry lands on the nth day in `days`, so a
   fresh week arrives already laid out and you only move what differs from
   the norm. Missing, short, or invalid `days` just leaves it in the tray —
   which is the old behaviour, so a budget without `days` still works. */
function defaultDay(b, i) {
  if (!Array.isArray(b.days)) return null;
  const d = b.days[i];
  return Number.isInteger(d) && d >= 0 && d <= 6 ? d : null;
}

function materialize(key) {
  const idx = weekIndexOf(parseYmd(key));
  const phase = phaseForWeek(idx);
  const rec = blankWeek(key, phase);
  if (!phase) return rec;

  phase.budget.forEach(function (b) {
    const t = PLAN.activityTypes[b.type];
    if (!t) return;
    if (t.daily) {
      rec.daily[b.type] = {
        days: [false, false, false, false, false, false, false],
        targetMinutes: b.targetMinutes,
        targetCount: b.count,
      };
      return;
    }
    for (let i = 0; i < b.count; i++) {
      rec.items.push({
        id: uid(), type: b.type, targetMinutes: b.targetMinutes,
        day: defaultDay(b, i), done: false, actualMinutes: null, note: "",
      });
    }
  });
  return rec;
}

/* Weeks inside the plan materialise the first time they're rendered.
   Weeks outside it stay unwritten until you actually put something in
   one, so browsing past the end doesn't litter storage. */
function loadWeek(key, createIfMissing) {
  let rec = Store.getWeek(key);
  if (rec) return rec;
  const idx = weekIndexOf(parseYmd(key));
  const inPlan = idx >= 1 && idx <= PLAN.weekCount;
  if (!inPlan && !createIfMissing) return null;
  rec = inPlan ? materialize(key) : blankWeek(key, null);
  Store.putWeek(rec);
  return rec;
}

/* ── derived numbers ────────────────────────────────────────────── */

function itemActual(it) {
  if (!it.done) return 0;
  return it.actualMinutes == null ? it.targetMinutes : it.actualMinutes;
}

function weekTotals(rec) {
  let target = 0, actual = 0;
  (rec.items || []).forEach(function (it) {
    target += it.targetMinutes || 0;
    actual += itemActual(it);
  });
  Object.keys(rec.daily || {}).forEach(function (t) {
    const d = rec.daily[t];
    target += d.targetCount * d.targetMinutes;
    actual += d.days.filter(Boolean).length * d.targetMinutes;
  });
  return { target: target, actual: actual };
}

function budgetTotals(phase) {
  const byType = {};
  let target = 0;
  if (phase) phase.budget.forEach(function (b) {
    byType[b.type] = (byType[b.type] || 0) + b.count * b.targetMinutes;
    target += b.count * b.targetMinutes;
  });
  return { byType: byType, target: target };
}

/* Elapsed weeks, not materialised weeks. Opening week 12 in September
   must not add its hours to the denominator. */
function currentWeekIndex() { return weekIndexOf(mondayOf(today())); }

function stats() {
  const upto = Math.max(0, Math.min(PLAN.weekCount, currentWeekIndex()));
  const byType = {};
  const weekly = [];        // actual minutes, or null for weeks not yet reached
  const weeklyTarget = [];  // so a full bar means "hit this week's budget"
  let target = 0, actual = 0;

  function bump(type, tgt, act) {
    if (!byType[type]) byType[type] = { target: 0, actual: 0 };
    byType[type].target += tgt;
    byType[type].actual += act;
    target += tgt;
    actual += act;
  }

  for (let i = 1; i <= PLAN.weekCount; i++) {
    const rec = Store.getWeek(ymd(mondayForWeek(i)));

    /* A week counts once it has started, or once there's work logged in
       it. The second half matters: starting early, or logging ahead,
       should never make the hours you actually did disappear. Opening a
       week to look at it still adds nothing, because materialising it
       creates no actuals -- which was the point of the elapsed-only rule
       in the first place. */
    const logged = rec ? weekTotals(rec).actual : 0;
    if (i > upto && logged === 0) {
      weekly.push(null);
      weeklyTarget.push(rec ? weekTotals(rec).target : budgetTotals(phaseForWeek(i)).target);
      continue;
    }

    let wActual = 0, wTarget = 0;
    if (rec) {
      (rec.items || []).forEach(function (it) {
        const a = itemActual(it);
        bump(it.type, it.targetMinutes || 0, a);
        wActual += a;
        wTarget += it.targetMinutes || 0;
      });
      Object.keys(rec.daily || {}).forEach(function (t) {
        const d = rec.daily[t];
        const a = d.days.filter(Boolean).length * d.targetMinutes;
        bump(t, d.targetCount * d.targetMinutes, a);
        wActual += a;
        wTarget += d.targetCount * d.targetMinutes;
      });
    } else {
      const b = budgetTotals(phaseForWeek(i));
      Object.keys(b.byType).forEach(function (t) { bump(t, b.byType[t], 0); });
      wTarget = b.target;
    }
    weekly.push(wActual);
    weeklyTarget.push(wTarget);
  }
  return {
    byType: byType, target: target, actual: actual,
    weekly: weekly, weeklyTarget: weeklyTarget, upto: upto,
  };
}

function hrs(min) { return (min / 60).toFixed(1); }

/* ── app state ──────────────────────────────────────────────────── */

const state = {
  tab: "week",
  weekKey: null,
  flashId: null,
};

function defaultWeekKey() {
  const idx = currentWeekIndex();
  if (idx < 1) return ymd(mondayForWeek(1));
  if (idx > PLAN.weekCount) return ymd(mondayForWeek(PLAN.weekCount));
  return ymd(mondayOf(today()));
}

/* ── dom helpers ────────────────────────────────────────────────── */

/* Types carry their own colour in plan.js, so adding one there needs no
   CSS. Emitting real rules (rather than inline styles) lets the media
   query handle the dark-mode swap for free. */
function injectTypeColours() {
  const rules = [];
  Object.keys(PLAN.activityTypes).forEach(function (k) {
    const key = k.replace(/[^a-zA-Z0-9_-]/g, "");
    const t = PLAN.activityTypes[k];
    if (!key || !t.color) return;
    rules.push('[data-t="' + key + '"]{--tc:' + t.color + '}');
    if (t.colorDark) {
      rules.push('@media (prefers-color-scheme:dark){[data-t="' + key +
        '"]{--tc:' + t.colorDark + '}}');
    }
  });
  const style = document.createElement("style");
  style.textContent = rules.join("\n");
  document.head.appendChild(style);
}

function el(tag, cls, text) {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text != null) n.textContent = text;
  return n;
}
function frag() { return document.createDocumentFragment(); }

let toastTimer = null;
function toast(msg) {
  const t = document.getElementById("toast");
  t.textContent = msg;
  t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(function () { t.hidden = true; }, 2600);
}

function debounce(fn, ms) {
  let t = null;
  return function () {
    const args = arguments, self = this;
    clearTimeout(t);
    t = setTimeout(function () { fn.apply(self, args); }, ms);
  };
}

/* ── header ─────────────────────────────────────────────────────── */

function renderHeader() {
  const sub = document.getElementById("hdrSub");
  const goal = document.getElementById("goal");
  goal.textContent = "";

  const idx = weekIndexOf(parseYmd(state.weekKey));
  const phase = phaseForWeek(idx);
  sub.textContent = phase ? phase.name : "Off-plan week";

  const t = today();
  let n, unit;
  const goalDate = PLAN.goal && PLAN.goal.date ? parseYmd(PLAN.goal.date) : null;
  if (goalDate && goalDate > t) {
    n = Math.ceil(daysBetween(t, goalDate) / 7);
    unit = "wks to " + (PLAN.goal.short || PLAN.goal.label || "goal");
  } else {
    const end = addDays(mondayForWeek(PLAN.weekCount), 6);
    n = Math.max(0, Math.ceil(daysBetween(t, end) / 7));
    unit = n > 0 ? "wks left" : "plan done";
  }
  goal.appendChild(el("span", "n", String(n)));
  goal.appendChild(el("span", "u", unit));
}

/* ── week screen ────────────────────────────────────────────────── */

/* Week at a glance: one column per day, one cell per session, filled when
   done. It answers "what shape is this week and where am I in it" without
   scrolling past seven day headers. Tapping a column jumps to that day. */
function renderGlance(rec, monday) {
  const tot = weekTotals(rec);
  const wrap = el("div", "glance");
  const strip = el("div", "g-strip");
  const todayIdx = sameWeek(monday) ? (today().getDay() + 6) % 7 : -1;
  const dailyKeys = Object.keys(rec.daily || {});

  for (let d = 0; d < 7; d++) {
    const col = el("button", "g-day" + (d === todayIdx ? " today" : ""));
    col.type = "button";
    col.setAttribute("aria-label", "Jump to " + DAY_NAMES[d]);
    col.appendChild(el("span", "g-l", DAY_NAMES[d][0]));

    const cells = el("span", "g-cells");
    rec.items.filter(function (it) { return it.day === d; }).forEach(function (it) {
      const c = el("span", "g-c" + (it.done ? " done" : ""));
      c.dataset.t = it.type;
      cells.appendChild(c);
    });
    col.appendChild(cells);

    dailyKeys.forEach(function (k) {
      const bar = el("span", "g-an" + (rec.daily[k].days[d] ? " on" : ""));
      bar.dataset.t = k;
      col.appendChild(bar);
    });

    col.addEventListener("click", function () {
      const head = document.getElementById("day-" + d);
      if (head) head.scrollIntoView({ block: "start", behavior: "smooth" });
    });
    strip.appendChild(col);
  }
  wrap.appendChild(strip);

  const tally = el("div", "g-tally");
  const v = el("span", "v");
  v.appendChild(document.createTextNode(hrs(tot.actual) + " / " + hrs(tot.target) + " "));
  v.appendChild(el("span", "k", "hrs"));
  tally.appendChild(v);
  tally.appendChild(el("span", "k", tot.target
    ? Math.round(tot.actual / tot.target * 100) + "% of plan"
    : "nothing planned"));
  wrap.appendChild(tally);
  return wrap;
}

function renderWeek() {
  const out = frag();
  const key = state.weekKey;
  const monday = parseYmd(key);
  const idx = weekIndexOf(monday);
  const inPlan = idx >= 1 && idx <= PLAN.weekCount;
  const phase = phaseForWeek(idx);
  const rec = loadWeek(key, false);

  /* week navigation */
  const nav = el("div", "weeknav");
  const prev = el("button", "arw", "←");
  prev.type = "button";
  prev.setAttribute("aria-label", "Previous week");
  prev.addEventListener("click", function () { gotoWeek(-1); });

  const mid = el("div", "mid" + (inPlan ? "" : " off"));
  mid.textContent = (inPlan ? "Week " + String(idx).padStart(2, "0") + " · " : "") +
    shortDate(monday) + " – " + shortDate(addDays(monday, 6));

  const next = el("button", "arw", "→");
  next.type = "button";
  next.setAttribute("aria-label", "Next week");
  next.addEventListener("click", function () { gotoWeek(1); });

  nav.append(prev, mid, next);
  out.appendChild(nav);

  /* phase focus + tally */
  if (rec) out.appendChild(renderGlance(rec, monday));

  const focus = el("div", "focus");
  focus.appendChild(el("div", "ph", phase ? "Focus" : "Outside the plan"));
  focus.appendChild(el("div", "fl", phase ? phase.focus :
    "This week isn't part of the plan. Anything you add here still counts toward nothing — it's just a scratch week."));
  out.appendChild(focus);

  /* milestones landing in this week */
  PLAN.milestones.filter(function (m) { return m.week === idx; }).forEach(function (m) {
    out.appendChild(milestoneRow(m, rec));
  });

  if (!rec) {
    const empty = el("div", "empty", "Nothing here yet.");
    out.appendChild(empty);
    const add = el("div", "btn-row");
    add.appendChild(button("Add a session", "btn", function () { openAddSheet(); }));
    out.appendChild(add);
    return out;
  }

  /* daily strips */
  Object.keys(rec.daily || {}).forEach(function (t) {
    const d = rec.daily[t];
    const type = typeOf(t);
    const doneCount = d.days.filter(Boolean).length;

    const h = el("div", "sec-h");
    h.appendChild(el("span", null, type.label + " · daily"));
    h.appendChild(el("span", null, doneCount + " / " + d.targetCount));
    out.appendChild(h);

    const strip = el("div", "strip");
    const boxes = el("div", "boxes");
    const todayIdx = sameWeek(monday) ? (today().getDay() + 6) % 7 : -1;
    d.days.forEach(function (on, i) {
      const b = el("button", "bx" + (on ? " on" : "") + (i === todayIdx ? " today" : ""), DAY_NAMES[i][0]);
      b.type = "button";
      b.dataset.t = t;
      b.setAttribute("aria-pressed", String(on));
      b.setAttribute("aria-label", type.label + ", " + DAY_NAMES[i]);
      b.addEventListener("click", function () {
        d.days[i] = !d.days[i];
        Store.putWeek(rec); touch(); render();
      });
      boxes.appendChild(b);
    });
    strip.appendChild(boxes);
    strip.appendChild(el("span", "cnt", d.targetMinutes + "m"));
    out.appendChild(strip);
  });

  /* unscheduled tray */
  const tray = rec.items.filter(function (it) { return it.day == null; });
  const th = el("div", "sec-h");
  th.appendChild(el("span", null, "Unscheduled"));
  th.appendChild(el("span", null, String(tray.length)));
  out.appendChild(th);

  if (!tray.length) {
    out.appendChild(el("div", "empty", "Everything's assigned to a day."));
  } else {
    tray.forEach(function (it) { out.appendChild(itemRow(it, rec)); });
  }

  /* seven days */
  for (let i = 0; i < 7; i++) {
    const date = addDays(monday, i);
    const isToday = ymd(date) === ymd(today());
    const dayItems = rec.items.filter(function (it) { return it.day === i; });
    const mins = dayItems.reduce(function (s, it) { return s + itemActual(it); }, 0);

    const head = el("div", "day" + (isToday ? " today" : ""));
    head.id = "day-" + i;
    head.appendChild(el("span", null, DAY_NAMES[i] + " " + String(date.getDate()).padStart(2, "0") + (isToday ? " · Today" : "")));
    head.appendChild(el("span", "d-r", mins ? hrs(mins) + " hrs" : "—"));
    out.appendChild(head);

    if (!dayItems.length) out.appendChild(el("div", "empty", "Nothing scheduled."));
    else dayItems.forEach(function (it) { out.appendChild(itemRow(it, rec)); });
  }

  /* week footer */
  const noteField = el("div", "field");
  const lab = el("label", null, "Week note");
  lab.setAttribute("for", "weekNote");
  const ta = el("textarea");
  ta.id = "weekNote";
  ta.value = rec.weekNote || "";
  ta.placeholder = "Travelling, sick, went well — anything that explains this week later.";
  const saveNote = debounce(function () {
    rec.weekNote = ta.value;
    Store.putWeek(rec); touch();
  }, 350);
  ta.addEventListener("input", saveNote);
  ta.addEventListener("blur", function () { rec.weekNote = ta.value; Store.putWeek(rec); touch(); });
  noteField.append(lab, ta);
  out.appendChild(noteField);

  const actions = el("div", "btn-row");
  actions.appendChild(button("Add session", "btn", function () { openAddSheet(); }));
  if (inPlan) {
    actions.appendChild(button("Reset to plan", "btn quiet", function () {
      const tot = weekTotals(rec);
      const msg = tot.actual > 0
        ? "This week has " + hrs(tot.actual) + " logged hours. Reset it to the plan template and lose them?"
        : "Reset this week to the plan template?";
      if (!confirm(msg)) return;
      Store.putWeek(materialize(key)); touch(); render();
      toast("Week reset");
    }));
  }
  out.appendChild(actions);

  return out;
}

function sameWeek(monday) { return ymd(mondayOf(today())) === ymd(monday); }

function itemRow(it, rec) {
  const type = typeOf(it.type);
  const row = el("div", "row" + (it.done ? " done" : "") + (state.flashId === it.id ? " flash" : ""));
  row.dataset.id = it.id;
  row.dataset.t = it.type;

  const box = el("button", "bx", it.done ? "[×]" : "[ ]");
  box.type = "button";
  box.setAttribute("aria-pressed", String(it.done));
  box.setAttribute("aria-label", (it.done ? "Mark not done: " : "Mark done: ") + type.label);
  box.addEventListener("click", function () {
    it.done = !it.done;
    it.actualMinutes = it.done ? (it.actualMinutes == null ? it.targetMinutes : it.actualMinutes) : null;
    Store.putWeek(rec); touch(); render();
  });

  const body = el("button", "body");
  body.type = "button";
  body.appendChild(el("span", "code", type.code));
  body.appendChild(el("span", "name", it.note ? it.note : type.label));
  body.appendChild(el("span", "min", (it.done && it.actualMinutes != null ? it.actualMinutes : it.targetMinutes) + "m"));
  body.addEventListener("click", function () { openItemSheet(it.id); });

  row.append(box, body);
  return row;
}

function milestoneRow(m, rec) {
  const done = rec ? rec.milestonesDone.indexOf(m.id) !== -1 : false;
  const b = el("button", "milestone" + (done ? " done" : ""));
  b.type = "button";
  b.setAttribute("aria-pressed", String(done));
  b.appendChild(el("span", "bx", done ? "[×]" : "[ ]"));
  const txt = el("div");
  txt.appendChild(el("div", "ms-l", "Milestone · wk " + String(m.week).padStart(2, "0")));
  txt.appendChild(el("div", "ms-t", m.label));
  b.appendChild(txt);
  b.addEventListener("click", function () { openMilestoneSheet(m.id); });
  return b;
}

function toggleMilestone(id) {
  const m = PLAN.milestones.find(function (x) { return x.id === id; });
  if (!m) return;
  const rec = loadWeek(ymd(mondayForWeek(m.week)), true);
  const i = rec.milestonesDone.indexOf(id);
  if (i === -1) rec.milestonesDone.push(id); else rec.milestonesDone.splice(i, 1);
  Store.putWeek(rec); touch();
}

function gotoWeek(delta) {
  state.weekKey = ymd(addDays(parseYmd(state.weekKey), delta * 7));
  state.flashId = null;
  render();
  document.getElementById("screen").scrollTop = 0;
}

/* ── progress screen ────────────────────────────────────────────── */

function renderProgress() {
  const out = frag();
  const s = stats();

  if (s.target === 0 && s.actual === 0) {
    const start = mondayForWeek(1);
    const days = daysBetween(today(), start);
    const box = el("div", "focus");
    box.appendChild(el("div", "ph", "Not started"));
    box.appendChild(el("div", "fl", "Week 1 begins " + shortDate(start) + " — " +
      (days === 1 ? "tomorrow." : "in " + days + " days.") +
      " Nothing counts against you until then."));
    out.appendChild(box);
  } else {
    const total = el("div", "total");
    const left = el("div");
    left.appendChild(el("div", "big", hrs(s.actual)));
    left.appendChild(el("div", "k", "hours logged"));
    const right = el("div");
    right.style.textAlign = "right";
    const pct = el("div", "big");
    pct.appendChild(document.createTextNode(s.target ? String(Math.round(s.actual / s.target * 100)) : "0"));
    pct.appendChild(el("span", "pc", "%"));
    right.appendChild(pct);
    right.appendChild(el("div", "k", "of target"));
    total.append(left, right);
    out.appendChild(total);
  }

  const h = el("div", "sec-h");
  h.appendChild(el("span", null, "By activity"));
  h.appendChild(el("span", null, "actual / target"));
  out.appendChild(h);

  const types = Object.keys(PLAN.activityTypes).filter(function (t) {
    const d = s.byType[t];
    return d && (d.target > 0 || d.actual > 0);
  });

  if (!types.length) {
    out.appendChild(el("div", "empty", "Nothing logged yet."));
  } else types.forEach(function (t) {
    const d = s.byType[t];
    const type = typeOf(t);
    const row = el("div", "bar-row");
    row.dataset.t = t;
    const top = el("div", "bar-top");
    top.appendChild(el("span", "lb", type.code + " " + type.label));
    top.appendChild(el("span", "vl", hrs(d.actual) + " / " + hrs(d.target)));
    const track = el("div", "track");
    const fill = el("div", "fill");
    fill.style.width = Math.min(100, d.target ? d.actual / d.target * 100 : 0) + "%";
    track.appendChild(fill);
    row.append(top, track);
    out.appendChild(row);
  });

  /* Weekly bars, scaled against each week's own target rather than the
     observed peak — a full bar means you hit that week's budget. Weeks
     not yet reached are hairlines, so "did nothing" and "hasn't happened"
     never look the same. */
  const spark = el("div", "spark");
  const axis = el("div", "axis");
  axis.appendChild(el("span", null, "Weekly hours"));
  axis.appendChild(el("span", null, "full bar = target"));
  const bars = el("div", "bars");
  const cur = currentWeekIndex();
  s.weekly.forEach(function (v, i) {
    const isFuture = v === null;
    const tgt = s.weeklyTarget[i] || 0;
    const b = el("div", "b" + (isFuture ? " fut" : (i + 1 === cur ? " cur" : "")));
    if (!isFuture) {
      b.style.height = (tgt ? Math.min(100, (v / tgt) * 100) : 0) + "%";
    }
    b.title = "Week " + (i + 1) + (isFuture ? " — not yet" :
      ": " + hrs(v) + " / " + hrs(tgt) + " hrs");
    bars.appendChild(b);
  });
  const scale = el("div", "spark-scale");
  for (let i = 1; i <= PLAN.weekCount; i++) {
    scale.appendChild(el("span", null, (i === 1 || i % 5 === 0) ? String(i) : ""));
  }
  spark.append(axis, bars, scale);
  out.appendChild(spark);

  /* milestones by phase */
  const doneIds = {};
  Store.weekKeys().forEach(function (k) {
    const rec = Store.getWeek(k);
    (rec && rec.milestonesDone || []).forEach(function (id) { doneIds[id] = true; });
  });

  const mh = el("div", "sec-h");
  mh.appendChild(el("span", null, "Milestones"));
  mh.appendChild(el("span", null, PLAN.milestones.filter(function (m) { return doneIds[m.id]; }).length + " / " + PLAN.milestones.length));
  out.appendChild(mh);

  PLAN.phases.forEach(function (p) {
    const ms = PLAN.milestones.filter(function (m) { return p.weeks.indexOf(m.week) !== -1; });
    if (!ms.length) return;
    out.appendChild(el("div", "phase-h", p.name));
    ms.forEach(function (m) {
      const row = el("div", "row" + (doneIds[m.id] ? " done" : ""));
      const box = el("button", "bx", doneIds[m.id] ? "[×]" : "[ ]");
      box.type = "button";
      box.setAttribute("aria-label", "Toggle milestone: " + m.label);
      box.addEventListener("click", function () { toggleMilestone(m.id); render(); });
      const body = el("button", "body");
      body.type = "button";
      body.appendChild(el("span", "code", "◆"));
      body.appendChild(el("span", "name", m.label));
      body.appendChild(el("span", "min", "wk " + String(m.week).padStart(2, "0")));
      body.addEventListener("click", function () { openMilestoneSheet(m.id); });
      row.append(box, body);
      out.appendChild(row);
    });
  });

  /* data */
  const meta = Store.meta();
  const dh = el("div", "sec-h");
  dh.appendChild(el("span", null, "Data"));
  out.appendChild(dh);

  const syncRow = el("button", "linkrow");
  syncRow.type = "button";
  syncRow.appendChild(el("span", "k", "Backup & sync"));
  syncRow.appendChild(el("span", "v", Sync.isOn() ? "gist · " + Sync.status() : "not set up"));
  syncRow.addEventListener("click", function () { state.tab = "settings"; render(); });
  out.appendChild(syncRow);

  const expRow = el("div", "linkrow");
  expRow.appendChild(el("span", "k", "Last export"));
  const age = meta.lastExport ? daysBetween(new Date(meta.lastExport), today()) : null;
  expRow.appendChild(el("span", "v", age == null ? "never" : (age === 0 ? "today" : age + " days ago")));
  out.appendChild(expRow);

  if (!Sync.isOn() && (age == null || age > 14)) {
    const warn = el("div", "foot");
    warn.textContent = "No backup configured and nothing exported recently. iOS clears local storage in more situations than you'd expect — set up sync, or export from the Data screen.";
    out.appendChild(warn);
  }

  return out;
}

/* ── settings screen ────────────────────────────────────────────── */

function renderSettings() {
  const out = frag();
  const meta = Store.meta();
  const cfg = Sync.getConfig();

  const back = el("button", "linkrow");
  back.type = "button";
  back.appendChild(el("span", "k", "‹ Progress"));
  back.addEventListener("click", function () { state.tab = "progress"; render(); });
  out.appendChild(back);

  out.appendChild(sectionHead("Backup & sync"));

  const help = el("div", "field");
  const helpTxt = el("div", "help");
  helpTxt.textContent = "State is mirrored to a secret GitHub gist so losing this phone, clearing Safari's data, or deleting the icon doesn't lose the plan. Secret means unlisted, not private — anyone with the URL could read it.";
  help.appendChild(helpTxt);
  const help2 = el("div", "help");
  help2.appendChild(document.createTextNode("Make a fine-grained token with gist access at "));
  const a = el("a", null, "github.com/settings/tokens");
  a.href = "https://github.com/settings/tokens";
  a.target = "_blank";
  a.rel = "noopener";
  help.appendChild(help2);
  help2.appendChild(a);
  out.appendChild(help);

  const tokField = el("div", "field");
  const tokLab = el("label", null, "GitHub token");
  tokLab.setAttribute("for", "tok");
  const tok = el("input");
  tok.type = "password";
  tok.id = "tok";
  tok.value = cfg.token;
  tok.autocomplete = "off";
  tok.spellcheck = false;
  tok.placeholder = "github_pat_…";
  tokField.append(tokLab, tok);
  out.appendChild(tokField);

  const gidField = el("div", "field");
  const gidLab = el("label", null, "Gist id");
  gidLab.setAttribute("for", "gid");
  const gid = el("input");
  gid.type = "text";
  gid.id = "gid";
  gid.value = cfg.gistId;
  gid.autocomplete = "off";
  gid.spellcheck = false;
  gid.placeholder = "leave empty and press Create";
  gidField.append(gidLab, gid);
  out.appendChild(gidField);

  const syncBtns = el("div", "btn-row");
  syncBtns.appendChild(button("Save", "btn solid", function () {
    Sync.setConfig({ gistId: gid.value, token: tok.value });
    toast(Sync.isOn() ? "Sync on" : "Sync off");
    render();
  }));
  syncBtns.appendChild(button("Create gist", "btn", async function () {
    Sync.setConfig({ gistId: "", token: tok.value });
    try {
      const id = await Sync.create();
      toast("Gist created");
      render();
      console.log("gist id", id);
    } catch (e) { toast(e.message); }
  }));
  out.appendChild(syncBtns);

  if (Sync.isOn()) {
    const pull = el("div", "btn-row");
    pull.appendChild(button("Sync now", "btn", async function () {
      const r = await Sync.reconcile();
      toast(r.action === "pulled" ? "Pulled " + r.weeks + " weeks" :
        r.action === "error" ? r.message : "Synced");
      render();
    }));
    out.appendChild(pull);

    const st = el("div", "linkrow");
    st.appendChild(el("span", "k", "Status"));
    st.appendChild(el("span", "v", Sync.status() + (Sync.detail() ? " · " + Sync.detail() : "")));
    out.appendChild(st);
  }

  out.appendChild(sectionHead("Export & import"));

  const expBtns = el("div", "btn-row");
  expBtns.appendChild(button("Download", "btn", function () { downloadExport(); }));
  expBtns.appendChild(button("Copy", "btn", function () { copyExport(); }));
  out.appendChild(expBtns);

  const impField = el("div", "field");
  const impLab = el("label", null, "Import");
  const impHelp = el("div", "help");
  impHelp.textContent = "Replaces every stored week. The current state is snapshotted first, so one level of undo is always available below.";
  const file = el("input");
  file.type = "file";
  file.accept = "application/json,.json";
  file.addEventListener("change", function () {
    const f = file.files && file.files[0];
    if (!f) return;
    const r = new FileReader();
    r.onload = function () { doImport(String(r.result)); };
    r.readAsText(f);
  });
  const paste = el("textarea");
  paste.placeholder = "…or paste the JSON here and press Import";
  impField.append(impLab, impHelp, file, paste);
  out.appendChild(impField);

  const impBtn = el("div", "btn-row");
  impBtn.appendChild(button("Import pasted", "btn", function () {
    if (!paste.value.trim()) { toast("Nothing pasted"); return; }
    doImport(paste.value);
  }));
  out.appendChild(impBtn);

  if (Store.raw(K_PREV) || Store.raw(K_CONFLICT)) {
    const undo = el("div", "btn-row");
    if (Store.raw(K_PREV)) {
      undo.appendChild(button("Undo last import", "btn quiet", function () {
        if (!confirm("Restore the snapshot taken before the last import?")) return;
        applyPayload(Store.raw(K_PREV), false);
        toast("Restored");
        render();
      }));
    }
    if (Store.raw(K_CONFLICT)) {
      undo.appendChild(button("Restore pre-sync copy", "btn quiet", function () {
        if (!confirm("Restore the local copy that was replaced by a sync?")) return;
        applyPayload(Store.raw(K_CONFLICT), false);
        toast("Restored");
        render();
      }));
    }
    out.appendChild(undo);
  }

  out.appendChild(sectionHead("App version"));

  const ver = el("div", "linkrow");
  ver.appendChild(el("span", "k", "Running"));
  ver.appendChild(el("span", "v", Updates.running || "not cached yet"));
  out.appendChild(ver);

  const upd = el("div", "btn-row");
  upd.appendChild(button("Check for updates", "btn", function () { checkForUpdates(); }));
  out.appendChild(upd);

  const foot = el("div", "foot");
  foot.textContent = "Stored weeks: " + Store.weekKeys().length +
    ". Exports never include the GitHub token. The app checks for a new " +
    "version every time you switch back to it.";
  out.appendChild(foot);

  return out;
}

function sectionHead(txt) {
  const h = el("div", "sec-h");
  h.appendChild(el("span", null, txt));
  return h;
}

function button(label, cls, fn) {
  const b = el("button", cls, label);
  b.type = "button";
  b.addEventListener("click", fn);
  return b;
}

/* ── sheets ─────────────────────────────────────────────────────── */

function openSheet(build) {
  const sheet = document.getElementById("sheet");
  const scrim = document.getElementById("scrim");
  sheet.textContent = "";
  sheet.appendChild(build());
  sheet.hidden = false;
  scrim.hidden = false;
}

function closeSheet() {
  document.getElementById("sheet").hidden = true;
  document.getElementById("scrim").hidden = true;
}

function sheetHeader(title, onClose) {
  const h = el("div", "sheet-h");
  h.appendChild(el("div", "t", title));
  const x = el("button", "x", "Close");
  x.type = "button";
  x.addEventListener("click", onClose || closeSheet);
  h.appendChild(x);
  return h;
}

function findItem(id) {
  const rec = loadWeek(state.weekKey, false);
  if (!rec) return null;
  const it = rec.items.find(function (x) { return x.id === id; });
  return it ? { rec: rec, it: it } : null;
}

function openItemSheet(id) {
  openSheet(function () {
    const found = findItem(id);
    if (!found) return el("div", "empty", "That session is gone.");
    const rec = found.rec, it = found.it;
    const type = typeOf(it.type);
    const out = frag();

    const sh = sheetHeader(type.code + " · " + type.label);
    sh.dataset.t = it.type;
    out.appendChild(sh);

    /* day assignment -- seven chips on one row, unassign is its own control */
    const dayField = el("div", "field");
    dayField.appendChild(el("label", null, it.day == null ? "Day · unscheduled" : "Day"));
    const chips = el("div", "chips days");
    DAY_NAMES.forEach(function (d, i) {
      const c = el("button", "chip" + (it.day === i ? " on" : ""), d[0] + d[1]);
      c.type = "button";
      c.setAttribute("aria-label", d);
      c.setAttribute("aria-pressed", String(it.day === i));
      c.addEventListener("click", function () {
        const moved = it.day !== i;
        it.day = i;
        Store.putWeek(rec); touch();
        if (moved) { state.flashId = it.id; }
        render();
        openItemSheet(id);
        if (moved) setTimeout(function () { state.flashId = null; }, 1000);
      });
      chips.appendChild(c);
    });
    dayField.appendChild(chips);
    if (it.day != null) {
      dayField.appendChild(button("Back to tray", "btn quiet", function () {
        it.day = null; Store.putWeek(rec); touch();
        render(); openItemSheet(id);
      }));
    }
    out.appendChild(dayField);

    /* done + minutes */
    const doneRow = el("button", "toggle-row");
    doneRow.type = "button";
    doneRow.setAttribute("aria-pressed", String(it.done));
    doneRow.appendChild(el("span", "bx", it.done ? "[×]" : "[ ]"));
    doneRow.appendChild(el("span", "lbl", it.done ? "Done" : "Mark done"));
    doneRow.addEventListener("click", function () {
      it.done = !it.done;
      it.actualMinutes = it.done ? (it.actualMinutes == null ? it.targetMinutes : it.actualMinutes) : null;
      Store.putWeek(rec); touch();
      render(); openItemSheet(id);
    });
    out.appendChild(doneRow);

    const minField = el("div", "field");
    const minLab = el("label", null, "Minutes" + (it.done ? "" : " · target " + it.targetMinutes));
    minLab.setAttribute("for", "mins");
    const mins = el("input");
    mins.type = "text";
    mins.inputMode = "numeric";
    mins.id = "mins";
    mins.value = it.done ? String(it.actualMinutes == null ? it.targetMinutes : it.actualMinutes) : "";
    mins.placeholder = String(it.targetMinutes);
    const saveMins = debounce(function () {
      const n = parseInt(mins.value, 10);
      if (mins.value.trim() === "") { it.actualMinutes = null; }
      else if (!isNaN(n) && n >= 0) { it.actualMinutes = n; if (!it.done) it.done = true; }
      Store.putWeek(rec); touch(); render();
    }, 400);
    mins.addEventListener("input", saveMins);
    minField.append(minLab, mins);
    out.appendChild(minField);

    /* note */
    const noteField = el("div", "field");
    const noteLab = el("label", null, "Note · replaces the label in the list");
    noteLab.setAttribute("for", "inote");
    const note = el("textarea");
    note.id = "inote";
    note.value = it.note || "";
    note.placeholder = "Aula 3, unit 4 — por vs para";
    const saveNote = debounce(function () {
      it.note = note.value; Store.putWeek(rec); touch(); render();
    }, 400);
    note.addEventListener("input", saveNote);
    noteField.append(noteLab, note);
    out.appendChild(noteField);

    /* resources */
    if (type.resources && type.resources.length) {
      out.appendChild(sectionHead("Resources"));
      const res = el("div", "res");
      type.resources.forEach(function (r) {
        if (r.url) {
          const a = el("a", null, r.label);
          a.href = r.url; a.target = "_blank"; a.rel = "noopener";
          res.appendChild(a);
        } else {
          res.appendChild(el("div", "plain", r.label));
        }
      });
      out.appendChild(res);
    }

    const del = el("div", "btn-row");
    del.appendChild(button("Delete session", "btn quiet", function () {
      if (!confirm("Delete this session?")) return;
      rec.items = rec.items.filter(function (x) { return x.id !== id; });
      Store.putWeek(rec); touch(); closeSheet(); render();
      toast("Deleted");
    }));
    out.appendChild(del);

    return out;
  });
}

function openAddSheet() {
  openSheet(function () {
    const out = frag();
    out.appendChild(sheetHeader("Add a session"));
    const idx = weekIndexOf(parseYmd(state.weekKey));
    const phase = phaseForWeek(idx);

    Object.keys(PLAN.activityTypes).forEach(function (t) {
      const type = typeOf(t);
      if (type.daily) return;
      const budgeted = phase && phase.budget.find(function (b) { return b.type === t; });
      const target = budgeted ? budgeted.targetMinutes : 30;

      const row = el("button", "row");
      row.type = "button";
      row.appendChild(el("span", "code", type.code));
      row.appendChild(el("span", "name", type.label));
      row.appendChild(el("span", "min", target + "m"));
      row.addEventListener("click", function () {
        const rec = loadWeek(state.weekKey, true);
        const it = {
          id: uid(), type: t, targetMinutes: target,
          day: null, done: false, actualMinutes: null, note: "",
        };
        rec.items.push(it);
        Store.putWeek(rec); touch();
        state.flashId = it.id;
        closeSheet(); render();
        setTimeout(function () { state.flashId = null; }, 1000);
      });
      out.appendChild(row);
    });
    return out;
  });
}

function openMilestoneSheet(id) {
  openSheet(function () {
    const m = PLAN.milestones.find(function (x) { return x.id === id; });
    const out = frag();
    if (!m) return el("div", "empty", "Unknown milestone.");
    out.appendChild(sheetHeader("Milestone · wk " + String(m.week).padStart(2, "0")));

    const body = el("div", "field");
    const t = el("div", "help");
    t.style.fontSize = "15px";
    t.style.color = "var(--ink)";
    t.textContent = m.label;
    const d = el("div", "help");
    d.textContent = m.detail;
    const when = el("div", "help");
    when.textContent = "Week of " + shortDate(mondayForWeek(m.week)) + ".";
    body.append(t, d, when);
    out.appendChild(body);

    const rec = loadWeek(ymd(mondayForWeek(m.week)), false);
    const done = rec ? rec.milestonesDone.indexOf(id) !== -1 : false;
    const b = el("div", "btn-row");
    b.appendChild(button(done ? "Mark not done" : "Mark done", "btn solid", function () {
      toggleMilestone(id); closeSheet(); render();
    }));
    out.appendChild(b);

    const go = el("div", "btn-row");
    go.appendChild(button("Go to week " + m.week, "btn", function () {
      state.weekKey = ymd(mondayForWeek(m.week));
      state.tab = "week";
      closeSheet(); render();
      document.getElementById("screen").scrollTop = 0;
    }));
    out.appendChild(go);

    return out;
  });
}

/* ── export / import / payload ──────────────────────────────────── */

function payload() {
  const weeks = {};
  Store.weekKeys().forEach(function (k) {
    const rec = Store.getWeek(k);
    if (rec) weeks[k] = rec;
  });
  const meta = Store.meta();
  return {
    app: "spanish-tracker",
    schemaVersion: PLAN.schemaVersion,
    planStart: PLAN.startDate,
    updatedAt: meta.updatedAt || 0,
    exportedAt: new Date().toISOString(),
    lastExport: meta.lastExport || null,
    weeks: weeks,
  };
}

function validPayload(p) {
  if (!p || typeof p !== "object") return "Not an object";
  if (!p.weeks || typeof p.weeks !== "object") return "No weeks in that file";
  if (p.schemaVersion && p.schemaVersion > PLAN.schemaVersion) {
    return "That file is schema v" + p.schemaVersion + ", this app is v" + PLAN.schemaVersion;
  }
  const keys = Object.keys(p.weeks);
  for (let i = 0; i < keys.length; i++) {
    const w = p.weeks[keys[i]];
    if (!w || !w.weekStart || !Array.isArray(w.items)) return "Week " + keys[i] + " is malformed";
  }
  return null;
}

/* snapshot=true keeps the copy being replaced, so an import or a
   surprising sync is always reversible from Settings. */
function applyPayload(p, snapshot, slot) {
  if (snapshot) Store.write(slot || K_PREV, payload());
  Store.weekKeys().forEach(function (k) { Store.remove(K_WEEK + k); });
  Object.keys(p.weeks).forEach(function (k) {
    const w = p.weeks[k];
    Store.write(K_WEEK + w.weekStart, w);
  });
  const meta = Store.meta();
  meta.updatedAt = p.updatedAt || Date.now();
  if (p.lastExport) meta.lastExport = p.lastExport;
  Store.putMeta(meta);
}

function doImport(text) {
  let p;
  try { p = JSON.parse(text); }
  catch (e) { toast("That isn't valid JSON"); return; }
  const err = validPayload(p);
  if (err) { toast(err); return; }

  const incoming = Object.keys(p.weeks).length;
  const current = Store.weekKeys().length;
  if (!confirm("Replace " + current + " stored week" + (current === 1 ? "" : "s") +
    " with " + incoming + " from this file?")) return;

  applyPayload(p, true, K_PREV);
  Sync.schedulePush();
  toast("Imported " + incoming + " weeks");
  render();
}

function downloadExport() {
  const p = payload();
  const blob = new Blob([JSON.stringify(p, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "spanish-" + ymd(today()) + ".json";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  markExported();
}

async function copyExport() {
  const text = JSON.stringify(payload(), null, 2);
  try {
    await navigator.clipboard.writeText(text);
    markExported();
    toast("Copied to clipboard");
  } catch (e) {
    toast("Clipboard blocked — use Download");
  }
}

function markExported() {
  const m = Store.meta();
  m.lastExport = Date.now();
  Store.putMeta(m);
  toast("Exported");
}

/* ── render ─────────────────────────────────────────────────────── */

function render() {
  renderHeader();
  const screen = document.getElementById("screen");
  const top = screen.scrollTop;
  screen.textContent = "";
  screen.appendChild(
    state.tab === "week" ? renderWeek() :
    state.tab === "progress" ? renderProgress() :
    renderSettings()
  );
  screen.scrollTop = top;

  document.querySelectorAll("#tabs .tab").forEach(function (b) {
    const on = b.dataset.tab === state.tab ||
      (state.tab === "settings" && b.dataset.tab === "progress");
    b.classList.toggle("on", on);
    b.setAttribute("aria-current", on ? "page" : "false");
  });
  renderSyncDot();
}

function renderSyncDot() {
  const dot = document.getElementById("syncDot");
  const txt = document.getElementById("syncTxt");
  const s = Sync.status();
  dot.dataset.s = s;
  txt.textContent = s === "off" ? "no sync" : s;
}

/* ── init ───────────────────────────────────────────────────────── */

function init() {
  injectTypeColours();
  state.weekKey = defaultWeekKey();

  Sync.init({
    getPayload: payload,
    applyPayload: function (p) { applyPayload(p, true, K_CONFLICT); render(); },
    persistConfig: function (cfg) {
      const m = Store.meta();
      m.sync = { gistId: cfg.gistId, token: cfg.token };
      Store.putMeta(m);
    },
  }, Store.meta().sync);

  Sync.onStatus(renderSyncDot);

  document.getElementById("tabs").addEventListener("click", function (e) {
    const b = e.target.closest(".tab");
    if (!b) return;
    state.tab = b.dataset.tab;
    render();
    document.getElementById("screen").scrollTop = 0;
  });

  document.getElementById("scrim").addEventListener("click", closeSheet);
  document.getElementById("syncDot").addEventListener("click", function () {
    state.tab = "settings"; render();
  });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") closeSheet();
  });

  /* Flush pending writes before iOS suspends the app. */
  document.addEventListener("visibilitychange", function () {
    if (document.visibilityState === "hidden") Sync.flush();
  });
  window.addEventListener("pagehide", function () { Sync.flush(); });

  render();

  if (Sync.isOn()) {
    Sync.reconcile().then(function (r) {
      if (r.action === "pulled") toast("Pulled " + r.weeks + " weeks from gist");
      if (r.action === "error") toast("Sync: " + r.message);
      render();
    });
  }

  setupUpdates();
}

/* ── keeping the installed app current ──────────────────────────────
 * An iOS home-screen app resumes from a snapshot rather than reloading,
 * so left alone it will happily run last month's code forever: nothing
 * ever re-fetches sw.js, so a bumped CACHE is never noticed. Three
 * things fix that -- check on launch, check on every return to the
 * foreground, and reload once the new worker takes over.
 */

const Updates = { reg: null, running: null, reloading: false };

function setupUpdates() {
  if (!("serviceWorker" in navigator) || location.protocol === "file:") return;

  /* On a first ever visit there's no controller yet, and the worker's
     initial claim() would otherwise read as "new version" and reload for
     nothing. So the first claim only flips the flag; every controller
     change after that is a genuine update. Tracking it as mutable state
     matters -- reading it once at startup would leave the whole first
     session unable to auto-update. */
  let hasController = Boolean(navigator.serviceWorker.controller);

  navigator.serviceWorker.addEventListener("controllerchange", function () {
    askVersion();
    if (!hasController) { hasController = true; return; }
    if (Updates.reloading) return;
    Updates.reloading = true;
    toast("New version — reloading");
    /* Long enough for the debounced note and minutes writes to land. */
    setTimeout(function () { location.reload(); }, 1200);
  });

  navigator.serviceWorker
    .register("sw.js", { updateViaCache: "none" })
    .then(function (reg) {
      Updates.reg = reg;
      reg.update().catch(function () {});
      askVersion();
    })
    .catch(function (e) { console.warn("service worker failed", e); });

  /* The moment that actually matters on a phone: coming back to the app. */
  document.addEventListener("visibilitychange", function () {
    if (document.visibilityState !== "visible") return;
    if (Updates.reg) Updates.reg.update().catch(function () {});
    askVersion();
  });
}

/* The active cache name is the version. Reading it straight from the
   Cache API beats messaging the worker: it's correct the moment install()
   finishes, rather than only once a controller has claimed the page. */
async function askVersion() {
  if (!window.caches) return;
  try {
    const keys = await caches.keys();
    const found = keys.filter(function (k) { return k.indexOf("espanol-") === 0; }).sort().pop();
    if (found && found !== Updates.running) {
      Updates.running = found;
      if (state.tab === "settings") render();
    }
  } catch (e) { /* private mode can refuse; the row just stays blank */ }
}

/* Settings button, for when you want an answer right now. */
async function checkForUpdates() {
  if (!Updates.reg) { toast("No service worker — open over https"); return; }
  toast("Checking…");
  try {
    await Updates.reg.update();
    await new Promise(function (r) { setTimeout(r, 1200); });
    if (!Updates.reloading) toast("Already up to date");
  } catch (e) {
    toast("Check failed — are you online?");
  }
}

init();
