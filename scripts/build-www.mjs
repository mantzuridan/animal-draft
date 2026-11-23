// Copies the game's web files into www/ for the phone apps (Capacitor). The website keeps using the files in place.
// Leaves out the source art, tools and app projects.
import { rmSync, mkdirSync, cpSync, readdirSync } from "node:fs";
const KEEP_DIRS = ["img"];
const KEEP_EXT = /\.(html|js|css|svg|webmanifest)$/;
const SKIP = new Set(["sw.js"]);   // no service worker inside the app: the files are already on the phone
rmSync("www", { recursive: true, force: true }); mkdirSync("www");
for (const f of readdirSync(".")) if (KEEP_EXT.test(f) && !SKIP.has(f) && !f.endsWith(".mjs") && f !== "capacitor.config.json") cpSync(f, "www/" + f);
for (const d of KEEP_DIRS) cpSync(d, "www/" + d, { recursive: true });
console.log("www ready");
