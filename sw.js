// Service worker: the game works offline, and a new release only downloads what changed.
// - Code: network-first (always the latest version), kept in CODE_CACHE. Bump the version on every release.
// - Pictures: shown straight from IMG_CACHE (fast, offline) and refreshed in the background, so a replaced
//   picture appears on the next visit. IMG_CACHE keeps its name across releases, so pictures aren't re-downloaded.
//   Only the base animals are fetched up front; skin pictures are saved the first time they're shown.
// - Old caches (previous versions) are deleted when a new version takes over.
const CODE_CACHE = "animal-draft-code-v21";
const IMG_CACHE = "animal-draft-img";
const CODE = ["./", "index.html", "style.css", "app.js", "ui.js", "game.js", "collection.js", "shop.js", "online.js", "net.js",
  "engine.js", "save.js", "achievements.js", "skins.js", "manifest.webmanifest", "icon.svg"];
const ANIMALS = ("bison camel cheetah chimpanzee crocodile dolphin eagle elephant fox frog giraffe gorilla grizzly hippo " +
  "honeybadger horse impala jaguar kangaroo komodo lion moose mountaingoat ostrich otter panda penguin polarbear puma " +
  "rabbit rhino sealion shark sloth squirrel tiger tortoise wildboar wolf zebra").split(" ").map(n => `img/animals/${n}.webp`);

self.addEventListener("install", e => {
  e.waitUntil((async () => {
    await (await caches.open(CODE_CACHE)).addAll(CODE);
    const img = await caches.open(IMG_CACHE);   // base pictures: only the ones not saved yet
    await Promise.all(ANIMALS.map(async u => { if (!(await img.match(u))) await img.add(u).catch(() => {}); }));
  })());
  self.skipWaiting();
});

self.addEventListener("activate", e => {
  e.waitUntil((async () => {
    for (const k of await caches.keys()) if (k !== CODE_CACHE && k !== IMG_CACHE) await caches.delete(k);
    await self.clients.claim();
  })());
});

self.addEventListener("fetch", e => {
  if (e.request.method !== "GET") return;
  const url = new URL(e.request.url);
  if (url.origin !== location.origin) return;   // e.g. Google Fonts: let the browser handle it
  if (url.pathname.includes("/img/")) e.respondWith(picture(e));
  else e.respondWith(code(e.request));
});

async function code(req) {
  try {
    const r = await fetch(req);
    if (r.ok) { const copy = r.clone(); caches.open(CODE_CACHE).then(c => c.put(req, copy)); }
    return r;
  } catch (err) {
    return (await caches.match(req, { ignoreSearch: true })) || Response.error();
  }
}

async function picture(e) {
  const cache = await caches.open(IMG_CACHE);
  const hit = await cache.match(e.request, { ignoreSearch: true });
  const fresh = fetch(e.request).then(r => { if (r.ok) cache.put(e.request, r.clone()); return r; });
  if (hit) { e.waitUntil(fresh.catch(() => {})); return hit; }
  return fresh;
}
