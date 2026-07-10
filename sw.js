// sw.js — Offline-Cache. App-Hülle wird gecacht; Inhalte kommen network-first,
// damit der neue Tag frisch geladen wird, aber offline trotzdem lesbar bleibt.

const SHELL = "denken-shell-v1";
const SHELL_FILES = [
  "./",
  "./index.html",
  "./app.js",
  "./style.css",
  "./manifest.webmanifest",
  "./icon.svg",
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(SHELL).then((c) => c.addAll(SHELL_FILES)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== SHELL).map((k) => caches.delete(k)))).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const url = new URL(e.request.url);
  const isContent = url.pathname.includes("/content/");

  if (isContent) {
    // network-first: frischer Tag, aber offline aus Cache
    e.respondWith(
      fetch(e.request)
        .then((res) => {
          const copy = res.clone();
          caches.open(SHELL).then((c) => c.put(e.request, copy));
          return res;
        })
        .catch(() => caches.match(e.request))
    );
  } else {
    // cache-first für die App-Hülle
    e.respondWith(caches.match(e.request).then((hit) => hit || fetch(e.request)));
  }
});
