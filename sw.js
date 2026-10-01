const CACHE = "mojdei-v11";
const ASSETS = [
  "./",
  "./index.html",
  "./styles.css?v=11",
  "./app.js?v=11",
  "./manifest.webmanifest",
  "./icon.svg",
  "./icon-180.png",
];

self.addEventListener("install", (e) => {
  e.waitUntil(
    caches.open(CACHE).then((c) => c.addAll(["./", "./index.html", "./styles.css", "./app.js", "./manifest.webmanifest", "./icon.svg", "./icon-180.png"])).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  e.respondWith(
    fetch(req)
      .then((res) => {
        const copy = res.clone();
        caches.open(CACHE).then((c) => c.put(req, copy));
        return res;
      })
      .catch(() => caches.match(req).then((c) => c || caches.match("./index.html")))
  );
});
