// Network-first service worker: always tries the latest version, falls back to cache offline.
const CACHE = "animal-draft-v5";
const FILES = ["./", "index.html", "app.js", "engine.js", "save.js", "achievements.js", "manifest.webmanifest", "icon.svg",
  "img/animals/bison.png","img/animals/camel.png","img/animals/cheetah.png","img/animals/chimpanzee.png","img/animals/crocodile.png","img/animals/dolphin.png","img/animals/eagle.png","img/animals/elephant.png","img/animals/fox.png","img/animals/frog.png","img/animals/giraffe.png","img/animals/gorilla.png","img/animals/grizzly.png","img/animals/hippo.png","img/animals/honeybadger.png","img/animals/horse.png","img/animals/impala.png","img/animals/jaguar.png","img/animals/kangaroo.png","img/animals/komodo.png","img/animals/lion.png","img/animals/moose.png","img/animals/mountaingoat.png","img/animals/ostrich.png","img/animals/otter.png","img/animals/panda.png","img/animals/penguin.png","img/animals/polarbear.png","img/animals/puma.png","img/animals/rabbit.png","img/animals/rhino.png","img/animals/sealion.png","img/animals/shark.png","img/animals/sloth.png","img/animals/squirrel.png","img/animals/tiger.png","img/animals/tortoise.png","img/animals/wildboar.png","img/animals/wolf.png","img/animals/zebra.png"];
self.addEventListener("install", e => { e.waitUntil(caches.open(CACHE).then(c => c.addAll(FILES))); self.skipWaiting(); });
self.addEventListener("activate", e => { e.waitUntil(self.clients.claim()); });
self.addEventListener("fetch", e => {
  if (e.request.method !== "GET") return;
  e.respondWith(
    fetch(e.request).then(r => {
      if (r.ok && new URL(e.request.url).origin === location.origin) {
        const copy = r.clone(); caches.open(CACHE).then(c => c.put(e.request, copy));
      }
      return r;
    }).catch(() => caches.match(e.request))
  );
});
