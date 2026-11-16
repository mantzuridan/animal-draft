// The player's collection screens: stats, the animal album (with each animal's skins) and achievements.
import * as E from "./engine.js";
import * as Save from "./save.js";
import * as Ach from "./achievements.js";
import * as Sk from "./skins.js";
import { $, pic, show } from "./ui.js";
import { openShopAnimal } from "./shop.js";

/* ---------- Stats ---------- */
export function renderStats(){
  const s=Save.loadStats("hard");
  $("stGames").textContent=s.games; $("stWins").textContent=s.wins; $("stStreak").textContent=s.streak; $("stBest").textContent=s.best;
}

/* ---------- Album ---------- */
export function renderAlbum(){
  const alb=Save.loadAlbum(), unlocked=E.ALL_ANIMALS.filter(a=>Save.isUnlocked(alb,a.id)).length;
  $("albumCount").textContent=`${unlocked} / ${E.ALL_ANIMALS.length} animals`;
  $("albumBar").style.width=(100*unlocked/E.ALL_ANIMALS.length)+"%";
  const g=$("albumGrid"); g.innerHTML="";
  E.ALL_ANIMALS.forEach(a=>{
    const e=alb[a.id], open=Save.isUnlocked(alb,a.id), seen=e && e.played>0;
    const d=document.createElement("div");
    d.className="acard"+(open?"":" locked");
    d.innerHTML=`<div class="e">${pic(a)}</div><div class="n">${seen?a.name:"???"}</div>`;
    d.onclick=()=>showAlbumAnimal(a);
    g.appendChild(d);
  });
}
export function showAlbumAnimal(a){
  const alb=Save.loadAlbum(), e=alb[a.id], open=Save.isUnlocked(alb,a.id), seen=e && e.played>0;
  $("adEmoji").innerHTML=pic(a); $("adEmoji").classList.toggle("locked",!open);
  $("adName").textContent= seen ? a.name : "???";
  $("adSummary").textContent= seen ? `Played ${e.played} · Won ${e.won} game${e.won===1?"":"s"}` : "You haven't drafted this animal yet.";
  const box=$("adSports"); box.innerHTML="";
  if(seen) E.ALL_SPORTS.forEach((sp,i)=>{
    const r=e.sports[i]||{played:0,won:0};
    const d=document.createElement("div"); d.className="sline"+(r.won>0?" won":"");
    d.innerHTML=`<div class="sicon">${sp.icon}</div><div class="sname">${sp.name}</div>`+
      `<div class="rec">${r.played ? `Won ${r.won} of ${r.played}` : "Not tried"}</div><div class="mark">${r.won>0?"🏅":""}</div>`;
    box.appendChild(d);
  });
  $("adHint").textContent = open ? "🏅 = this animal has won in that sport" : "Win a game with this animal in your team to unlock it.";
  renderAnimalSkins(a, $("adSkins"), ()=>showAlbumAnimal(a));
  show("animal");
}
// Row of the skins the player owns for one animal; tapping one puts it on
export function renderAnimalSkins(a, box, onChange, onMore=()=>openShopAnimal(a)){
  const sk=Save.loadSkins(), cur=Save.equipped(sk,a.id);
  const owned=Sk.SKIN_PACKS.filter(p=>Save.owns(sk,p.id,a.id));
  box.innerHTML=`<div class="skin-row">`+owned.map(p=>
    `<button type="button" class="skin-opt${p.id===cur?" on":""}" data-pack="${p.id}"><span class="e">${pic(a,p.id)}</span><span>${p.name}</span></button>`).join("")+
    `<button type="button" class="skin-opt more" data-more="1"><span class="e big">🛒</span><span>More</span></button></div>`;
  box.querySelectorAll(".skin-opt").forEach(b=>b.onclick=()=>{
    if(b.dataset.more){ onMore(); return; }
    Save.equip(a.id, b.dataset.pack); onChange();
  });
}
$("albumBtn").onclick=()=>{ renderAlbum(); show("album"); };
$("animalBack").onclick=()=>{ renderAlbum(); show("album"); };

/* ---------- Achievements ---------- */
const TIER_LABEL=["Bronze","Silver","Gold","Diamond"];
function renderAchievements(){
  const f=Save.loadFacts();
  const done=Ach.ACHIEVEMENTS.reduce((s,a)=>s+Ach.tiersDone(a,f),0), total=Ach.totalTiers();
  $("achCount").textContent=`${done} / ${total} medals`;
  $("achBar").style.width=(100*done/total)+"%";
  const left=Ach.ACHIEVEMENTS.reduce((s,a)=>s+Sk.MEDAL_STARS.slice(Ach.tiersDone(a,f)).reduce((x,y)=>x+y,0),0);
  $("achLeft").textContent = left ? `⭐ ${left.toLocaleString("en-US")} more stars to win from medals` : "⭐ You've won every medal star!";
  $("achList").innerHTML=Ach.ACHIEVEMENTS.map(a=>{
    const n=Ach.tiersDone(a,f), next=a.tiers[n];
    const medals=Ach.TIER_ICONS.map((ic,i)=>`<span class="${i<n?"got":""}">${ic}</span>`).join("");
    let goal;
    if(!next) goal=`<div class="agoal done">All 4 medals earned!</div>`;
    else {
      const p=next.progress ? next.progress(f) : null;
      goal=`<div class="agoal">${TIER_LABEL[n]}: ${next.text} <span class="reward">+${Sk.MEDAL_STARS[n]} ⭐</span></div>`+
        (p ? `<div class="abar"><i style="width:${100*p[0]/p[1]}%"></i></div><div class="anum">${p[0]} / ${p[1]}</div>` : "");
    }
    return `<div class="ach${n===4?" full":""}"><div class="aicon">${a.icon}</div><div class="abody"><div class="atop"><b>${a.name}</b><span class="medals4">${medals}</span></div>${goal}</div></div>`;
  }).join("");
}
$("achBtn").onclick=()=>{ renderAchievements(); show("achievements"); };
