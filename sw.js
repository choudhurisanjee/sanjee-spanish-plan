/* sw.js — offline shell.
 *
 * Bump CACHE on every deploy. Without a bump the old files keep being
 * served, and edits to plan.js won't show up on the phone.
 *
 * Strategy is stale-while-revalidate: the cached copy answers instantly
 * (so the app opens on the subway), and a fresh copy is fetched in the
 * background for next launch.
 */

const CACHE = "espanol-v3";

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
        return hit || network;
      });
    })
  );
});
