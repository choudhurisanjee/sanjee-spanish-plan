/* sw.js — offline shell.
 *
 * Bump CACHE on every deploy. A new name makes install() refetch every
 * file from the network, and activate() delete the old generation.
 *
 * Serving is cache-first so the app opens instantly on the subway. The
 * freshness problem is handled on the other side, in app.js: an iOS
 * home-screen app resumes from a snapshot instead of reloading, so
 * nothing would ever ask whether this file changed. app.js calls
 * registration.update() on launch and on every return to the foreground,
 * and reloads once the new worker takes over.
 */

const CACHE = "espanol-v5";

const SHELL = [
  "./",
  "./index.html",
  "./styles.css",
  "./plan.js",
  "./sync.js",
  "./app.js",
  "./manifest.json",
  "./icons/icon-180.png",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
];

self.addEventListener("install", function (e) {
  e.waitUntil(
    caches.open(CACHE)
      .then(function (c) { return c.addAll(SHELL); })
      .then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener("activate", function (e) {
  e.waitUntil(
    caches.keys()
      .then(function (keys) {
        return Promise.all(keys.map(function (k) {
          return k === CACHE ? null : caches.delete(k);
        }));
      })
      .then(function () { return self.clients.claim(); })
  );
});

self.addEventListener("fetch", function (e) {
  const req = e.request;
  if (req.method !== "GET") return;

  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;   // never touch api.github.com

  e.respondWith(
    caches.open(CACHE).then(function (cache) {
      return cache.match(req).then(function (hit) {
        const network = fetch(req).then(function (res) {
          if (res && res.ok) cache.put(req, res.clone());
          return res;
        }).catch(function () {
          return hit || cache.match("./index.html");
        });
        /* Without waitUntil the browser may kill the worker after the
           cached response is returned, and the refresh never lands. */
        if (hit) e.waitUntil(network);
        return hit || network;
      });
    })
  );
});
