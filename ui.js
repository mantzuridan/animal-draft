// Shared screen helpers: element lookup, animal pictures, toast, screens, timers, stars, bottom sheet, going home.
import * as Save from "./save.js";
import * as Sk from "./skins.js";

export const $ = id => document.getElementById(id);

// Animal pictures in the player's chosen skin (or in a given pack)
export const skinOf = a => Save.equipped(Save.loadSkins(), a.id);
export const picSrc = (a, packId=skinOf(a)) => Sk.skinSrc(a, packId);
const pxClass = packId => Sk.packById(packId).pixel ? " px" : "";
export const pic = (a, packId=skinOf(a)) => `<img class="pic${pxClass(packId)}" src="${picSrc(a,packId)}" alt="${a.name}" draggable="false">`;
export const ipic = a => `<img class="ipic${pxClass(skinOf(a))}" src="${picSrc(a)}" alt="">`;

export const sleep = ms => new Promise(r=>setTimeout(r,ms));
export const shortName = s => s.name.replace("100m ","");
// A sport's picture (img/sports/<key>.webp). small=true: a little one inside a line of text
export const sportPic = (s, small=false) => `<img class="${small?"sp-ic-s":"sp-ic"}" src="img/sports/${s.key}.webp" alt="" draggable="false">`;

let toastT;
export function toast(msg, ms=1500){ const t=$("toast"); t.innerHTML=msg; t.classList.add("on"); clearTimeout(toastT); toastT=setTimeout(()=>t.classList.remove("on"),ms); }
export function show(id){ document.querySelectorAll(".screen").forEach(s=>s.classList.toggle("on", s.id===id)); window.scrollTo(0,0); syncBack(); }

/* ---------- Timer (one at a time) ---------- */
let timerId=null;
export function startTimer(barId, wrapId, secs, onDone){
  stopTimer();
  const bar=$(barId), wrap=$(wrapId), end=Date.now()+secs*1000;
  wrap.style.visibility="visible";
  const tick=()=>{
    const left=Math.max(0,end-Date.now());
    bar.style.transform=`scaleX(${left/(secs*1000)})`;
    wrap.classList.toggle("warn", left<5000);
    if(left<=0){ stopTimer(); onDone(); }
  };
  tick(); timerId=setInterval(tick,100);
}
export function stopTimer(){ if(timerId){ clearInterval(timerId); timerId=null; } }
export function hideTimer(wrapId){ stopTimer(); $(wrapId).style.visibility="hidden"; }

/* ---------- Stars ---------- */
export function renderStars(){ const s=Save.loadWallet().stars; document.querySelectorAll(".starsVal").forEach(e=>e.textContent=s.toLocaleString("en-US")); }

/* ---------- Bottom sheet (preview, buy, choose) ---------- */
export function openSheet(html){ $("sheetCard").innerHTML=html; $("sheet").classList.add("on"); syncBack(); }
const sheetHooks=[];
export const onCloseSheet = f => sheetHooks.push(f);
export function closeSheet(){ const was=$("sheet").classList.contains("on"); $("sheet").classList.remove("on"); syncBack(); if(was) sheetHooks.forEach(f=>f()); }
$("sheet").onclick=e=>{ if(e.target.id==="sheet") closeSheet(); };

/* ---------- Home ---------- */
// Other modules register what must stop when the player goes home (e.g. a running game)
const homeHooks=[];
export const onGoHome = f => homeHooks.push(f);
export function goHome(){ homeHooks.forEach(f=>f()); closeSheet(); renderStars(); show("home"); }

/* ---------- Phone back button ---------- */
// While anything other than the plain home screen is showing, one extra browser-history entry is kept.
// The phone's back button pops it and we do one step back inside the app instead of leaving the site.
let backArmed=false, ignorePop=false, backQueued=false;
const curScreen = () => (document.querySelector(".screen.on")||{}).id;
const sheetOpen = () => $("sheet").classList.contains("on");
// Runs after the current click/handler is done, so close-then-open in one go doesn't touch history twice
function syncBack(){
  if(backQueued) return; backQueued=true;
  setTimeout(()=>{ backQueued=false;
    const need = sheetOpen() || curScreen()!=="home";
    if(need && !backArmed){ history.pushState({ad:1},""); backArmed=true; }
    else if(!need && backArmed){ backArmed=false; ignorePop=true; history.back(); }
  },0);
}
// One step back: close the sheet, else the screen's own back (✕, "‹ All packs", quit-game question)
function stepBack(){
  if(sheetOpen()){ closeSheet(); return; }
  const s=curScreen();
  if(s==="shop" && $("shopUp")){ $("shopUp").click(); return; }
  if(s==="results"){ if($("resBtns").style.visibility!=="hidden") $("homeBtn").click(); return; }
  const b=document.querySelector(`#${s} .topbar .iconbtn`); if(b) b.click();
}
window.addEventListener("popstate",()=>{
  if(ignorePop){ ignorePop=false; return; }
  backArmed=false; stepBack(); syncBack();
});
