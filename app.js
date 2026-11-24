// Animal Draft start-up: the home screen and its buttons. The screens live in their own files:
// game.js (draft, assign, results), collection.js (stats, album, achievements), shop.js (shop, wardrobe).
// Game rules and bots live in engine.js; saved progress lives in save.js.
import * as E from "./engine.js";
import * as Save from "./save.js";
import * as Sk from "./skins.js";
import { $, picSrc, show, shortName, sportPic, renderStars, goHome, openSheet, closeSheet, toast } from "./ui.js";
import * as Game from "./game.js";
import { renderStats } from "./collection.js";
import "./shop.js";
import * as Online from "./online.js";
import * as Cloud from "./cloud.js";

/* ---------- Sport descriptions on Home (tap a sport icon) ---------- */
const SPORT_HINT_DEFAULT=$("sportHint").textContent;
let openSport=-1;
$("homeSports").innerHTML=E.ALL_SPORTS.map((s,i)=>`<button type="button" data-sport="${i}"><b>${sportPic(s)}</b>${shortName(s)}</button>`).join("");
$("homeSports").querySelectorAll("button").forEach(b=>b.onclick=()=>{
  const i=+b.dataset.sport; openSport = openSport===i ? -1 : i;
  $("homeSports").querySelectorAll("button").forEach(x=>x.classList.toggle("on", +x.dataset.sport===openSport));
  const h=$("sportHint"), sp=E.ALL_SPORTS[i];
  h.innerHTML = openSport<0 ? SPORT_HINT_DEFAULT : `<b>${sportPic(sp,true)} ${sp.name}:</b> ${sp.desc}`;
  h.classList.toggle("open", openSport>=0);
});

/* ---------- Navigation ---------- */
$("playBtn").onclick=()=>{ Game.setLevel("hard"); Game.newGame(); };
$("practiceBtn").onclick=()=>{ Game.setLevel("easy"); Game.newGame(); };
$("againBtn").onclick=()=> Game.inFriendGame() ? Online.playAgain() : Game.newGame();   // same mode as the game just played
$("homeBtn").onclick=goHome;
$("statsBtn").onclick=()=>{ renderStats(); show("stats"); };
$("rulesBtn").onclick=()=>show("rules");
document.querySelectorAll("[data-home]").forEach(b=>b.onclick=goHome);
document.querySelectorAll("[data-quit]").forEach(b=>b.onclick=()=>{ if(confirm("Quit this game? It won't count in your stats.")) goHome(); });
$("resetBtn").onclick=()=>{ if(confirm("Reset your whole account (stats, album, achievements, stars and skins)? This can't be undone.")){ Save.resetAccount(); renderStats(); } };

// No service worker inside the phone app (Capacitor): its files are already on the phone
if("serviceWorker" in navigator && location.protocol==="https:" && !window.Capacitor){ navigator.serviceWorker.register("sw.js").catch(()=>{}); }

// Hook for automated tests in the browser (read-only view of the current game)
window.__ad = { E, Save, Sk, get G(){ return Game.getGame(); }, get A(){ return Game.getAssign(); },
  newGame:Game.newGame, goHome, startResults:Game.startResults, renderAssign:Game.renderAssign, setLevel:Game.setLevel };

// Load the player's animal pictures in the background so reveals don't pop in
setTimeout(()=>E.ALL_ANIMALS.forEach(a=>{ const i=new Image(); i.src=picSrc(a); }), 1500);

// Stars for medals earned before stars existed (and any not paid yet)
Save.syncMedalStars(Sk.medalStarsTotal(Save.loadFacts()));
renderStars();

/* ---------- Cloud save (stats screen) ---------- */
const CLOUD_TEXT = {off:"Not connected", connecting:"Connecting…", saving:"Saving…", saved:"✓ Your progress is saved in the cloud",
  offline:"Offline: your progress is kept on this phone and saved when you're back online"};
const showCloud = s => { $("cloudStatus").textContent=CLOUD_TEXT[s]||""; $("cloudCodeBtn").disabled=$("cloudUseBtn").disabled = s==="off"||s==="connecting"; };
Cloud.onStatus(showCloud); showCloud(Cloud.getStatus());
$("cloudCodeBtn").onclick=async()=>{
  openSheet(`<div class="aname">📲 Move to a new phone</div><div class="muted">Getting a code…</div>`);
  try{
    const code=await Cloud.makeTransferCode();
    openSheet(`<div class="aname">📲 Move to a new phone</div><div class="muted">On the new phone open Stats → Cloud save → I have a code, and type:</div>`+
      `<div class="room-code">${code}</div><div class="muted small-note">The code works once, for 15 minutes. This phone keeps its progress too.</div>`+
      `<button class="btn ghost" id="sheetNo">Close</button>`);
  }catch(e){ openSheet(`<div class="aname">Couldn't get a code</div><div class="muted">Check the internet connection and try again.</div><button class="btn ghost" id="sheetNo">Close</button>`); }
  $("sheetNo").onclick=closeSheet;
};
$("cloudUseBtn").onclick=()=>{
  openSheet(`<div class="aname">📲 Bring your progress here</div><div class="muted">Type the code from your old phone. The progress on <b>this</b> phone will be replaced by it.</div>`+
    `<div class="join-row"><input id="cloudIn" maxlength="6" placeholder="CODE" autocomplete="off" autocapitalize="characters" spellcheck="false"><button class="btn" id="sheetGo" disabled>Use</button></div>`+
    `<div class="hint" id="cloudErr"></div><button class="btn ghost" id="sheetNo">Cancel</button>`);
  const inp=$("cloudIn");
  inp.oninput=()=>{ inp.value=inp.value.toUpperCase().replace(/[^A-Z0-9]/g,"").slice(0,6); $("sheetGo").disabled=inp.value.length<6; };
  $("sheetNo").onclick=closeSheet;
  $("sheetGo").onclick=async()=>{
    $("sheetGo").disabled=true; $("cloudErr").textContent="";
    try{ await Cloud.useTransferCode(inp.value); closeSheet(); renderStats(); renderStars(); toast("✓ Your progress is here!", 2500); }
    catch(e){ $("cloudErr").textContent="That code didn't work. Check it, or make a new one on the old phone."; $("sheetGo").disabled=false; }
  };
  setTimeout(()=>inp.focus(),100);
};
// Back up the progress; if a newer copy came from the cloud, redraw what's on screen
Cloud.start(()=>{ renderStars(); renderStats(); });
