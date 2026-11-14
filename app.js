// Animal Draft screens: everything the player sees and taps.
// Game rules and bots live in engine.js; saved progress lives in save.js.
import * as E from "./engine.js";
import * as Save from "./save.js";

/* ---------- Helpers ---------- */
const $ = id => document.getElementById(id);
// Animal pictures: img/animals/<name without spaces>.png (a few names are shortened)
const PIC_FILE = {"grizzlybear":"grizzly","komododragon":"komodo"};
const picSrc = a => { const k=a.name.toLowerCase().replace(/ /g,""); return `img/animals/${PIC_FILE[k]||k}.png`; };
const pic = a => `<img class="pic" src="${picSrc(a)}" alt="${a.name}" draggable="false">`;
const ipic = a => `<img class="ipic" src="${picSrc(a)}" alt="">`;
const sleep = ms => new Promise(r=>setTimeout(r,ms));
let toastT;
function toast(msg, ms=1500){ const t=$("toast"); t.innerHTML=msg; t.classList.add("on"); clearTimeout(toastT); toastT=setTimeout(()=>t.classList.remove("on"),ms); }
function show(id){ document.querySelectorAll(".screen").forEach(s=>s.classList.toggle("on", s.id===id)); window.scrollTo(0,0); }
const shortName = s => s.name.replace("100m ","");

/* ---------- Timer ---------- */
let timerId=null;
function startTimer(barId, wrapId, secs, onDone){
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
function stopTimer(){ if(timerId){ clearInterval(timerId); timerId=null; } }
function hideTimer(wrapId){ stopTimer(); $(wrapId).style.visibility="hidden"; }

/* ---------- Game ---------- */
// The bot is the "hard" level; "easy" is only used for practice games, which don't count anywhere
let level="hard";
let G=null;      // the engine's game state
let token=0;     // invalidates pending steps after quitting
const alive = t => G && t===token;

function newGame(){
  token++;
  G=E.createGame({level});
  renderGameSports();
  $("draftLevel").textContent = level==="hard" ? "" : "🐣 Practice";
  $("draftLevel").hidden = level==="hard";
  show("draft");
  renderDraft();
  step();
}

function renderDraft(){
  for(const side of ["you","bot"]){
    const S=side==="you"?"You":"Bot";
    $("coins"+S).textContent=G[side].coins+" 🪙";
    const t=$("team"+S); t.innerHTML="";
    for(let i=0;i<E.RULES.teamSize;i++){
      const a=G[side].team[i]; const d=document.createElement("div");
      d.className="slot"+(a?" f":""); if(a){ d.innerHTML=pic(a); d.title=a.name; }
      t.appendChild(d);
    }
  }
  const c=G.cur;
  $("sideYou").classList.toggle("active", !!c && c.turn==="you");
  $("sideBot").classList.toggle("active", !!c && c.turn==="bot");
  $("bidLine").innerHTML = c && c.mode==="auction"
    ? (c.bid>0 ? `${c.leader==="you"?"You":"🤖 Bot"} bid <b>${c.bid} 🪙</b>` : `<span class="muted">${c.turn==="you"?"You open":"Bot opens"} the bidding</span>`)
    : "";
}

function setControls(kind){ // 'auction' | 'rich' | 'none'
  $("controls").style.display = kind==="auction" ? "grid" : "none";
  $("richControls").style.display = kind==="rich" ? "grid" : "none";
  $("picker").classList.remove("on");
}

// Moves the draft forward until someone has to decide, animating what happens on the way
async function step(){
  const t=token;
  setControls("none"); hideTimer("timer");
  const events=E.advance(G);
  for(const ev of events){
    if(ev.type==="draftDone") return startAssign();
    if(ev.type==="fill"){
      $("status").textContent = ev.side==="you" ? "Bot's team is full — you get random animals!" : "Your team is full — the bot gets random animals.";
      showAnimal(ev.animal); renderDraft();
      await sleep(900); if(!alive(t)) return;
      return step();
    }
    if(ev.type==="reveal"){
      showAnimal(ev.animal); renderDraft();
      if(ev.mode==="auction"){ await sleep(500); if(!alive(t)) return; return takeTurn(); }
      if(ev.mode==="rich"){
        if(G.cur.rich==="you"){
          $("status").textContent="Bot is out of coins. Buy it for 1, or it goes to the bot.";
          setControls("rich");
          startTimer("timerBar","timer",E.RULES.bidSecs,()=>doAct("you", E.timeoutAction(G,"you")));
        } else {
          $("status").textContent="You're out of coins — the bot decides…";
          await sleep(1300); if(!alive(t)) return;
          doAct("bot", E.botAction(G));
        }
        return;
      }
      // "free": nobody has coins; the award event follows
      $("status").textContent="No coins left on either side…";
      await sleep(1000); if(!alive(t)) return;
      continue;
    }
    if(ev.type==="award"){ await showAward(ev); if(!alive(t)) return; return step(); }
  }
}

function showAnimal(a){
  const e=$("aEmoji"); e.innerHTML=pic(a); e.classList.remove("pop"); void e.offsetWidth; e.classList.add("pop");
  $("aName").textContent=a.name;
  $("counter").textContent="Animal #"+G.shown;
  // Sparkle = not unlocked in the album yet (only Hard games count, so only shown there)
  const fresh = G.level==="hard" && !Save.isUnlocked(Save.loadAlbum(), a.id);
  document.querySelectorAll("#draft .sparkle").forEach(s=>s.hidden=!fresh);
  $("aNewTag").hidden=!fresh;
  $("bidLine").innerHTML="";
}

function takeTurn(){
  const c=G.cur; renderDraft();
  if(c.turn==="you"){
    const o=E.options(G,"you");
    $("status").textContent = c.bid===0 ? "Your turn — open with at least 1" : "Your turn — raise or pass";
    setControls("auction");
    $("plusBtn").textContent = `+1  (bid ${o.minBid})`;
    $("plusBtn").disabled = !o.canBid;
    $("chooseBtn").disabled = !o.canBid;
    $("passBtn").disabled = !o.canPass;
    pickVal=Math.min(o.minBid,o.maxBid); renderPick();
    startTimer("timerBar","timer",E.RULES.bidSecs,()=>{
      const a=E.timeoutAction(G,"you");
      toast(a.type==="bid" ? "⏰ Time's up — auto bid "+a.amount : "⏰ Time's up — not enough coins, pass");
      doAct("you", a);
    });
  } else {
    setControls("none"); hideTimer("timer");
    $("status").textContent="🤖 Bot is thinking…";
    const t=token;
    setTimeout(()=>{ if(alive(t) && G.cur && G.cur.turn==="bot") doAct("bot", E.botAction(G)); }, 900+Math.random()*700);
  }
}

// Sends a decision to the engine and shows the outcome
async function doAct(side, action){
  const t=token;
  const events=E.act(G, side, action);
  if(!events) return; // not allowed (e.g. a double tap)
  stopTimer();
  const ev=events[0];
  if(ev.type==="bid") return takeTurn();
  if(ev.type==="award"){ await showAward(ev); if(!alive(t)) return; step(); }
}

async function showAward(ev){
  setControls("none"); hideTimer("timer");
  renderDraft();
  const who = ev.side==="you" ? "You got" : "🤖 Bot got";
  const cost = ev.price>0 ? ` for ${ev.price} 🪙` : " for free";
  $("status").textContent = `${who} the ${ev.animal.name}${cost}!`;
  await sleep(1500);
}

/* Custom bid picker */
let pickVal=1;
function renderPick(){ $("pickVal").textContent=pickVal; }
$("chooseBtn").onclick=()=>{ $("picker").classList.toggle("on"); };
$("minusStep").onclick=()=>{ pickVal=Math.max(G.cur.bid+1,pickVal-1); renderPick(); };
$("plusStep").onclick=()=>{ pickVal=Math.min(G.you.coins,pickVal+1); renderPick(); };
$("pickBid").onclick=()=>doAct("you",{type:"bid", amount:pickVal});
$("plusBtn").onclick=()=>doAct("you",{type:"bid", amount:G.cur.bid+1});
$("passBtn").onclick=()=>doAct("you",{type:"pass"});
$("buyBtn").onclick=()=>doAct("you",{type:"buy"});
$("letBtn").onclick=()=>doAct("you",{type:"letGo"});

/* ---------- Assignment ---------- */
let A=null; // {plan:[animal|null per sport], selected:animal|null}
function startAssign(){
  setControls("none"); hideTimer("timer");
  A={plan:Array(G.view.sports.length).fill(null), selected:null};
  show("assign"); renderAssign();
  const t=token;
  startTimer("atimerBar","atimer",E.RULES.assignSecs,()=>{
    if(!alive(t)) return;
    A.plan=E.autoAssignPlayer(G, A.plan);
    renderAssign(); toast("⏰ Time's up — auto-assigned!");
    setTimeout(()=>{ if(alive(t)) startResults(); }, 1200);
  });
}
function renderAssign(){
  const slots=$("sportSlots"); slots.innerHTML="";
  G.view.sports.forEach((sp,i)=>{
    const a=A.plan[i]; const d=document.createElement("div");
    d.className="sslot"+(A.selected && !a ? " target":"");
    d.innerHTML=`<div class="sicon">${sp.icon}</div><div class="sname">${sp.name}</div>`+
      (a ? `<div class="who"><span class="e">${pic(a)}</span><span>${a.name}</span></div>` : `<div class="empty">empty</div>`);
    d.onclick=()=>{
      if(A.selected){
        const prev=A.plan[i], from=A.plan.indexOf(A.selected);
        if(from>=0) A.plan[from]=prev; // swap if moving a placed animal
        A.plan[i]=A.selected; A.selected=null;
      } else if(a){ A.plan[i]=null; }
      renderAssign();
    };
    slots.appendChild(d);
  });
  const tray=$("tray"); tray.innerHTML="";
  G.you.team.filter(a=>!A.plan.includes(a)).forEach(a=>{
    const c=document.createElement("div");
    c.className="chip"+(A.selected===a?" sel":"");
    c.innerHTML=`<div class="e">${pic(a)}</div><div class="n">${a.name}</div>`;
    c.onclick=()=>{ A.selected = A.selected===a ? null : a; renderAssign(); };
    tray.appendChild(c);
  });
  if(!tray.children.length) tray.innerHTML=`<div class="hint" style="align-self:center">All set! Tap a sport to swap.</div>`;
  $("confirmBtn").disabled = A.plan.some(x=>!x);
}
$("confirmBtn").onclick=()=>{ if(!A.plan.some(x=>!x)){ hideTimer("atimer"); startResults(); } };

/* ---------- Results ---------- */
async function startResults(){
  hideTimer("atimer");
  const res=E.resolve(G, A.plan); if(!res) return;
  const t=token, lvl=G.level;
  show("results");
  const list=$("resList"); list.innerHTML=""; $("banner").textContent=""; $("resBtns").style.visibility="hidden";
  let ys=0, bs=0; setScore(0,0);
  for(const r of res.rows){
    const row=document.createElement("div"); row.className="res";
    const cell=(a,side)=>`<div class="a ${side} ${r.winner===side?"win":"lose"}"><span class="e">${pic(a)}</span><span class="n">${a.name}</span></div>`;
    row.innerHTML = cell(r.you,"you") + `<div class="mid"><b>${r.sport.icon}</b>${r.sport.name}${r.close?'<br><span class="close">Close match!</span>':""}</div>` + cell(r.bot,"bot");
    list.appendChild(row);
    await sleep(80); if(!alive(t)) return;
    row.classList.add("show");
    await sleep(r.close?1300:950); if(!alive(t)) return;
    r.winner==="you" ? ys++ : bs++;
    setScore(ys,bs);
  }
  const s = lvl==="hard" ? Save.recordGame(lvl, res.won) : null;
  $("banner").innerHTML = res.won ? "🏆 You win!" : "🤖 The bot wins";
  if(!s) $("banner").innerHTML += `<div class="muted" style="font-size:15px;font-weight:500">🐣 Practice game, not counted</div>`;
  if(res.won){ confetti(); if(s && s.streak>1) $("banner").innerHTML += `<div class="muted" style="font-size:16px;font-weight:500">🔥 ${s.streak} wins in a row</div>`; }
  if(lvl==="hard"){
    const news=Save.recordAlbum(res.rows, res.won), lines=[];
    if(news.unlocked.length) lines.push(`📖 New in your album: <b>${news.unlocked.map(a=>ipic(a)+" "+a.name).join(", ")}</b>`);
    news.firstSport.forEach(({animal,sport})=>lines.push(`🏅 ${ipic(animal)} ${animal.name} won its first ${sport.name}!`));
    if(lines.length) $("banner").innerHTML += `<div class="album-news">${lines.join("<br>")}</div>`;
  }
  $("resBtns").style.visibility="visible";
  G=null; // game finished
}
function setScore(y,b){ $("scoreLine").innerHTML=`<span class="y">${y}</span> – <span class="b">${b}</span>`; }
function confetti(){
  const set=["🎉","🏅","⭐","🎊","🥇"];
  for(let i=0;i<26;i++){
    const d=document.createElement("div"); d.className="confetti";
    d.textContent=set[i%set.length]; d.style.left=Math.random()*100+"vw";
    d.style.animationDuration=(1.8+Math.random()*1.6)+"s"; d.style.animationDelay=(Math.random()*.6)+"s";
    document.body.appendChild(d); setTimeout(()=>d.remove(),4200);
  }
}

/* ---------- Stats ---------- */
function renderStats(){
  const s=Save.loadStats("hard");
  $("stGames").textContent=s.games; $("stWins").textContent=s.wins; $("stStreak").textContent=s.streak; $("stBest").textContent=s.best;
}

/* ---------- Album screens ---------- */
function renderAlbum(){
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
function showAlbumAnimal(a){
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
  show("animal");
}
$("albumBtn").onclick=()=>{ renderAlbum(); show("album"); };
$("animalBack").onclick=()=>{ renderAlbum(); show("album"); };

/* ---------- Sport descriptions (tap a sport icon) ---------- */
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
// The game's drawn sports at the top of the draft screen
let openGameSport=-1;
function renderGameSports(){
  openGameSport=-1; $("draftSportHint").hidden=true;
  const sports=G.view.sports;
  const html=sports.map((s,i)=>`<button type="button" data-slot="${i}"><b>${s.icon}</b>${shortName(s)}</button>`).join("");
  document.querySelectorAll(".game-sports").forEach(el=>{
    el.innerHTML=html;
    el.querySelectorAll("button").forEach(b=>b.onclick=()=>{
      const i=+b.dataset.slot; openGameSport = openGameSport===i ? -1 : i;
      el.querySelectorAll("button").forEach(x=>x.classList.toggle("on", +x.dataset.slot===openGameSport));
      const h=$("draftSportHint"); h.hidden = openGameSport<0;
      if(openGameSport>=0) h.innerHTML=`<b>${sports[i].icon} ${sports[i].name}:</b> ${sports[i].desc}`;
    });
  });
}

/* ---------- Navigation ---------- */
function goHome(){ token++; G=null; stopTimer(); show("home"); }
$("playBtn").onclick=()=>{ level="hard"; newGame(); };
$("practiceBtn").onclick=()=>{ level="easy"; newGame(); };
$("againBtn").onclick=newGame;   // same mode as the game just played
$("homeBtn").onclick=goHome;
$("statsBtn").onclick=()=>{ renderStats(); show("stats"); };
$("rulesBtn").onclick=()=>show("rules");
document.querySelectorAll("[data-home]").forEach(b=>b.onclick=goHome);
document.querySelectorAll("[data-quit]").forEach(b=>b.onclick=()=>{ if(confirm("Quit this game? It won't count in your stats.")) goHome(); });
$("resetBtn").onclick=()=>{ if(confirm("Reset your whole account (stats and the animal album)? This can't be undone.")){ Save.resetAccount(); renderStats(); } };

if("serviceWorker" in navigator && location.protocol==="https:"){ navigator.serviceWorker.register("sw.js").catch(()=>{}); }

// Hook for automated tests in the browser (read-only view of the current game)
window.__ad = { E, Save, get G(){ return G; }, get A(){ return A; }, newGame, goHome, startResults, renderAssign, setLevel(l){ level=l; } };

// Load all animal pictures in the background so reveals don't pop in
setTimeout(()=>E.ALL_ANIMALS.forEach(a=>{ const i=new Image(); i.src=picSrc(a); }), 1500);
