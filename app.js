// Animal Draft start-up: the home screen and its buttons. The screens live in their own files:
// game.js (draft, assign, results), collection.js (stats, album, achievements), shop.js (shop, wardrobe).
// Game rules and bots live in engine.js; saved progress lives in save.js.
import * as E from "./engine.js";
import * as Save from "./save.js";
import * as Sk from "./skins.js";
import { $, picSrc, show, shortName, renderStars, goHome } from "./ui.js";
import * as Game from "./game.js";
import { renderStats } from "./collection.js";
import "./shop.js";

/* ---------- Sport descriptions on Home (tap a sport icon) ---------- */
const SPORT_HINT_DEFAULT=$("sportHint").textContent;
let openSport=-1;
$("homeSports").innerHTML=E.ALL_SPORTS.map((s,i)=>`<button type="button" data-sport="${i}"><b>${s.icon}</b>${shortName(s)}</button>`).join("");
$("homeSports").querySelectorAll("button").forEach(b=>b.onclick=()=>{
  const i=+b.dataset.sport; openSport = openSport===i ? -1 : i;
  $("homeSports").querySelectorAll("button").forEach(x=>x.classList.toggle("on", +x.dataset.sport===openSport));
  const h=$("sportHint"), sp=E.ALL_SPORTS[i];
  h.innerHTML = openSport<0 ? SPORT_HINT_DEFAULT : `<b>${sp.icon} ${sp.name}:</b> ${sp.desc}`;
  h.classList.toggle("open", openSport>=0);
});

/* ---------- Navigation ---------- */
$("playBtn").onclick=()=>{ Game.setLevel("hard"); Game.newGame(); };
$("practiceBtn").onclick=()=>{ Game.setLevel("easy"); Game.newGame(); };
$("againBtn").onclick=Game.newGame;   // same mode as the game just played
$("homeBtn").onclick=goHome;
$("statsBtn").onclick=()=>{ renderStats(); show("stats"); };
$("rulesBtn").onclick=()=>show("rules");
document.querySelectorAll("[data-home]").forEach(b=>b.onclick=goHome);
document.querySelectorAll("[data-quit]").forEach(b=>b.onclick=()=>{ if(confirm("Quit this game? It won't count in your stats.")) goHome(); });
$("resetBtn").onclick=()=>{ if(confirm("Reset your whole account (stats, album, achievements, stars and skins)? This can't be undone.")){ Save.resetAccount(); renderStats(); } };

if("serviceWorker" in navigator && location.protocol==="https:"){ navigator.serviceWorker.register("sw.js").catch(()=>{}); }

// Hook for automated tests in the browser (read-only view of the current game)
window.__ad = { E, Save, Sk, get G(){ return Game.getGame(); }, get A(){ return Game.getAssign(); },
  newGame:Game.newGame, goHome, startResults:Game.startResults, renderAssign:Game.renderAssign, setLevel:Game.setLevel };

// Load the player's animal pictures in the background so reveals don't pop in
setTimeout(()=>E.ALL_ANIMALS.forEach(a=>{ const i=new Image(); i.src=picSrc(a); }), 1500);

// Stars for medals earned before stars existed (and any not paid yet)
Save.syncMedalStars(Sk.medalStarsTotal(Save.loadFacts()));
renderStars();
