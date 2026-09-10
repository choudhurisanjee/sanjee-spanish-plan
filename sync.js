/* sync.js — keeps a copy of everything in a secret GitHub gist.
 *
 * Why this exists: iOS wipes localStorage in a handful of ordinary
 * situations (clearing Safari data, deleting the home-screen icon,
 * storage pressure, restoring the phone). localStorage is the working
 * copy; the gist is the thing you'd actually be sad to lose.
 *
 * Resolution is last-write-wins on `updatedAt`. Before adopting a
 * remote copy the app snapshots the local one, so a bad reconcile is
 * always recoverable from Settings.
 *
 * "Secret" gist means unlisted, not private — anyone with the URL can
 * read it. For a study log that's fine. If it isn't, point BASE/FILE at
 * a file in a private repo via the contents API instead; the shape of
 * this module doesn't change.
 */

const Sync = (function () {
  const API = "https://api.github.com";
  const FILE = "spanish-state.json";
  const PUSH_DELAY = 2000;

  let cfg = { gistId: "", token: "" };
  let hooks = { getPayload: null, applyPayload: null, persistConfig: null };
  let status = "off";
  let detail = "";
  let timer = null;
  let inFlight = false;
  let again = false;
  const listeners = [];

  function setStatus(s, d) {
    status = s;
    detail = d || "";
    listeners.forEach(function (fn) { fn(s, detail); });
  }

  function headers() {
    return {
      "Authorization": "Bearer " + cfg.token,
      "Accept": "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
      "Content-Type": "application/json",
    };
  }

  async function req(path, opts) {
    const res = await fetch(API + path, Object.assign({ headers: headers() }, opts || {}));
    if (res.status === 401) throw new Error("Token rejected");
    if (res.status === 403) throw new Error("Token lacks gist permission");
    if (res.status === 404) throw new Error("Gist not found");
    if (!res.ok) throw new Error("GitHub returned " + res.status);
    return res.json();
  }

  /* Reads the gist. Returns the parsed payload, or null if the gist
     exists but has no state file in it yet. */
  async function fetchPayload() {
    const gist = await req("/gists/" + encodeURIComponent(cfg.gistId));
    const file = gist.files && gist.files[FILE];
    if (!file) return null;
    let text = file.content;
    if (file.truncated || text == null) {
      const raw = await fetch(file.raw_url);
      if (!raw.ok) throw new Error("Could not read gist contents");
      text = await raw.text();
    }
    try {
      return JSON.parse(text);
    } catch (e) {
      throw new Error("Gist contains invalid JSON");
    }
  }

  async function put(payload) {
    const files = {};
    files[FILE] = { content: JSON.stringify(payload, null, 2) };
    await req("/gists/" + encodeURIComponent(cfg.gistId), {
      method: "PATCH",
      body: JSON.stringify({ files: files }),
    });
  }

  async function pushNow() {
    if (!isOn()) return;
    if (inFlight) { again = true; return; }
    inFlight = true;
    setStatus("syncing");
    try {
      await put(hooks.getPayload());
      setStatus("ok");
    } catch (e) {
      setStatus("error", e.message);
    } finally {
      inFlight = false;
      if (again) { again = false; schedulePush(); }
    }
  }

  function schedulePush() {
    if (!isOn()) return;
    setStatus("pending");
    clearTimeout(timer);
    timer = setTimeout(pushNow, PUSH_DELAY);
  }

  function flush() {
    if (!isOn()) return;
    if (timer) { clearTimeout(timer); timer = null; pushNow(); }
  }

  function isOn() { return Boolean(cfg.gistId && cfg.token); }

  return {
    init: function (h, saved) {
      hooks = h;
      cfg = { gistId: (saved && saved.gistId) || "", token: (saved && saved.token) || "" };
      setStatus(isOn() ? "pending" : "off");
    },

    getConfig: function () { return { gistId: cfg.gistId, token: cfg.token }; },

    setConfig: function (next) {
      cfg = { gistId: (next.gistId || "").trim(), token: (next.token || "").trim() };
      if (hooks.persistConfig) hooks.persistConfig(cfg);
      setStatus(isOn() ? "pending" : "off");
    },

    isOn: isOn,
    status: function () { return status; },
    detail: function () { return detail; },
    onStatus: function (fn) { listeners.push(fn); },

    /* Makes a fresh secret gist seeded with current state, and adopts its id. */
    create: async function () {
      if (!cfg.token) throw new Error("Add a token first");
      const files = {};
      files[FILE] = { content: JSON.stringify(hooks.getPayload(), null, 2) };
      const gist = await req("/gists", {
        method: "POST",
        body: JSON.stringify({
          description: "Español — study tracker state",
          public: false,
          files: files,
        }),
      });
      cfg.gistId = gist.id;
      if (hooks.persistConfig) hooks.persistConfig(cfg);
      setStatus("ok");
      return gist.id;
    },

    /* Boot-time reconcile. Newest `updatedAt` wins. */
    reconcile: async function () {
      if (!isOn()) return { action: "off" };
      setStatus("syncing");
      try {
        const remote = await fetchPayload();
        const local = hooks.getPayload();
        if (!remote) {
          await put(local);
          setStatus("ok");
          return { action: "seeded" };
        }
        const rT = remote.updatedAt || 0;
        const lT = local.updatedAt || 0;
        if (rT > lT) {
          hooks.applyPayload(remote);
          setStatus("ok");
          return { action: "pulled", weeks: Object.keys(remote.weeks || {}).length };
        }
        if (lT > rT) {
          await put(local);
          setStatus("ok");
          return { action: "pushed" };
        }
        setStatus("ok");
        return { action: "in-sync" };
      } catch (e) {
        setStatus("error", e.message);
        return { action: "error", message: e.message };
      }
    },

    schedulePush: schedulePush,
    pushNow: pushNow,
    flush: flush,
  };
})();
