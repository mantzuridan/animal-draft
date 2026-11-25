// A game on screen: draft (auction), assigning animals to sports, and the results.
// Rules and bots live in engine.js; this file only shows them and passes the player's taps on.
import * as E from "./engine.js";
import * as Save from "./save.js";
import * as Ach from "./achievements.js";
import * as Sk from "./skins.js";
import { $, pic, ipic, sleep, toast, show, shortName, sportPic, startTimer, stopTimer, hideTimer, renderStars, onGoHome } from "./ui.js";
const TORTOISE_ID = E.ALL_ANIMALS.find(a=>a.name==="Tortoise").id;

// The bot is the "hard" level; "easy" is only used by the tutorial's sample game, which doesn't count anywhere
let level="hard";
let G=null;      // the engine's game state
let token=0;     // invalidates pending steps after quitting
const alive = t => G && t===token;

export const setLevel = l => { level=l; };
export const getGame = () => G;
export const getAssign = () => A;
onGoHome(()=>{ token++; G=null; ON=null; TUT=null; stopTimer(); });

// Tutorial sample game: the hooks object from tutorial.js (fixed sports and animals, coach tips, no timers); null otherwise
let TUT=null;
const botMove = () => (TUT && TUT.bot(G)) || E.botAction(G);
// Starts the timer, except in the tutorial (no time pressure there)
const timer = (bar, wrap, secs, f) => TUT ? hideTimer(wrap) : startTimer(bar, wrap, secs, f);

// Friend game: {seed, flip, friendSkins, friendName, friendId, send(msg)} from online.js; null vs the bot
let ON=null;
let friendQ=[], waitingFriend=false, friendPlan=null, myPlan=null;
const FN = () => ON ? ON.friendName||"Friend" : "";
// In the tutorial the opponent is shown as a player ("Opponent"), since real games are meant to be against people
const oppName = () => ON ? FN() : TUT ? "Opponent" : "Bot";
const OPP = () => ON ? "👤 "+FN() : TUT ? "👤 Opponent" : "🤖 Bot";
const oppThe = () => ON ? FN() : TUT ? "your opponent" : "the bot";
// Head-to-head score with this friend, from my side: "You 3 – 2 Dana"
const h2h = () => { const f=Save.vsFriend(ON.friendId); return `You ${f.wins} – ${f.losses} ${FN()}`; };

// online: start a game vs a friend instead of the bot
export function newGame(online=null, tut=null){
  token++;
  ON=online; TUT=tut; friendQ=[]; waitingFriend=false; friendPlan=null; myPlan=null;
  G = ON ? E.createGame({level:"hard", rng:E.mulberry32(ON.seed), online:true, flip:ON.flip})
    : TUT ? E.createGame({level:"easy", sportIdx:TUT.sports}) : E.createGame({level});
  if(TUT){ G.pool=TUT.pool(G.view); G.nextOpener="you"; }
  $("oppLabel").textContent=OPP(); $("resOppLabel").textContent=OPP();
  $("assignHint").textContent=`Tap an animal, then tap a sport. ${ON?FN():TUT?"Your opponent":"The bot"} is choosing in secret too.`;
  $("againBtn").textContent="Play again"; $("againBtn").disabled=false;
  renderGameSports();
  $("draftLevel").textContent = ON ? "👥 "+h2h() : TUT ? TUT.label : "";
  $("draftLevel").hidden = !ON && !TUT && level==="hard";
  show("draft");
  renderDraft();
  step();
}

/* ---------- Draft ---------- */
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
    ? (c.bid>0 ? `${c.leader==="you"?"You":OPP()} bid <b>${c.bid} 🪙</b>` : `<span class="muted">${c.turn==="you"?"You open":OPP()+" opens"} the bidding</span>`)
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
      $("status").textContent = ev.side==="you" ? `${oppName()}'s team is full — you get random animals!` : `Your team is full — ${oppThe()} gets random animals.`;
      showAnimal(ev.animal); renderDraft();
      await sleep(900); if(!alive(t)) return;
      if(TUT){ await TUT.fill(G, ev); if(!alive(t)) return; }
      return step();
    }
    if(ev.type==="reveal"){
      showAnimal(ev.animal); renderDraft();
      if(TUT && ev.mode!=="free"){ await sleep(400); if(!alive(t)) return; await TUT.reveal(G, ev); if(!alive(t)) return; }
      if(ev.mode==="auction"){ await sleep(500); if(!alive(t)) return; return takeTurn(); }
      if(ev.mode==="rich"){
        if(G.cur.rich==="you"){
          $("status").textContent=`${oppName()} is out of coins. Buy it for 1, or it goes to ${oppThe()}.`;
          setControls("rich");
          timer("timerBar","timer",E.RULES.bidSecs,()=>doAct("you", E.timeoutAction(G,"you")));
        } else {
          $("status").textContent=`You're out of coins — ${oppThe()} decides…`;
          if(ON) return waitFriend();
          await sleep(1300); if(!alive(t)) return;
          doAct("bot", botMove());
        }
        return;
      }
      // "free": nobody has coins; the award event follows
      $("status").textContent="No coins left on either side…";
      await sleep(1000); if(!alive(t)) return;
      continue;
    }
    if(ev.type==="award"){ await showAward(ev); if(!alive(t)) return; if(TUT){ await TUT.award(G, ev); if(!alive(t)) return; } return step(); }
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
    if(TUT) TUT.turn(G);
    timer("timerBar","timer",E.RULES.bidSecs,()=>{
      const a=E.timeoutAction(G,"you");
      toast(a.type==="bid" ? "⏰ Time's up — auto bid "+a.amount : "⏰ Time's up — not enough coins, pass");
      doAct("you", a);
    });
  } else {
    setControls("none"); hideTimer("timer");
    $("status").textContent = `${OPP()} is thinking…`;
    if(ON) return waitFriend();
    const t=token;
    setTimeout(()=>{ if(alive(t) && G.cur && G.cur.turn==="bot") doAct("bot", botMove()); }, 900+Math.random()*700);
  }
}

// Sends a decision to the engine and shows the outcome
async function doAct(side, action){
  const t=token;
  const events=E.act(G, side, action);
  if(!events){ if(ON && side==="bot") toast("⚠️ Out of sync with your friend's phone"); return; } // not allowed (e.g. a double tap)
  if(ON && side==="you") ON.send({t:"act", action});
  stopTimer();
  const ev=events[0];
  if(ev.type==="bid") return takeTurn();
  if(ev.type==="award"){ await showAward(ev); if(!alive(t)) return; if(TUT){ await TUT.award(G, ev); if(!alive(t)) return; } step(); }
}

/* ---------- Friend game: the friend's moves arrive from online.js ---------- */
// Moves are queued and applied only when this phone is waiting for the friend
// (the two phones animate at slightly different speeds).
export function friendMessage(m){
  if(!ON) return;
  if(m.t==="act"){ friendQ.push(m.action); pumpFriend(); }
  else if(m.t==="plan"){ friendPlan=m.ids; tryResults(); }
}
function waitFriend(){ waitingFriend=true; pumpFriend(); }
function pumpFriend(){ if(!waitingFriend || !G || !friendQ.length) return; waitingFriend=false; doAct("bot", friendQ.shift()); }
export const inFriendGame = () => !!ON;

async function showAward(ev){
  setControls("none"); hideTimer("timer");
  renderDraft();
  const who = ev.side==="you" ? "You got" : OPP()+" got";
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
  if(TUT) TUT.assign();
  timer("atimerBar","atimer",E.RULES.assignSecs,()=>{
    if(!alive(t)) return;
    A.plan=E.autoAssignPlayer(G, A.plan);
    renderAssign(); toast("⏰ Time's up — auto-assigned!");
    setTimeout(()=>{ if(alive(t)) finishAssign(); }, 1200);
  });
}
// Assignment done: vs the bot go straight to the results; vs a friend send the plan and wait for theirs
function finishAssign(){
  if(!ON) return startResults();
  if(myPlan) return;
  hideTimer("atimer");
  myPlan=A.plan.slice(); ON.send({t:"plan", ids:myPlan.map(a=>a.id)});
  $("confirmBtn").disabled=true; $("confirmBtn").textContent=`Waiting for ${FN()}…`;
  tryResults();
}
function tryResults(){
  if(!G || !myPlan || !friendPlan || G.phase!=="assign") return;
  G.botPlan=friendPlan.map(id=>G.bot.team.find(a=>a.id===id));
  if(G.botPlan.some(a=>!a)){ toast("⚠️ Out of sync with your friend's phone"); return; }
  A.plan=myPlan; startResults();
}
export function renderAssign(){
  const slots=$("sportSlots"); slots.innerHTML="";
  G.view.sports.forEach((sp,i)=>{
    const a=A.plan[i]; const d=document.createElement("div");
    d.className="sslot"+(A.selected && !a ? " target":"");
    d.innerHTML=`<div class="sicon">${sportPic(sp)}</div><div class="sname">${sp.name}</div>`+
      (a ? `<div class="who"><span class="e">${pic(a)}</span><span>${a.name}</span></div>` : `<div class="empty">empty</div>`);
    d.onclick=()=>{
      if(myPlan) return;   // plan already sent to the friend
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
  $("confirmBtn").disabled = !!myPlan || A.plan.some(x=>!x);
  $("confirmBtn").textContent = myPlan ? `Waiting for ${FN()}…` : "Start the games!";
  if(TUT) TUT.assignChange(A);
}
$("confirmBtn").onclick=()=>{ if(!A.plan.some(x=>!x)){ hideTimer("atimer"); finishAssign(); } };

/* ---------- Results ---------- */
export async function startResults(){
  hideTimer("atimer");
  const res=E.resolve(G, A.plan); if(!res) return;
  const t=token, lvl=G.level;
  show("results");
  const list=$("resList"); list.innerHTML=""; $("banner").textContent=""; $("resBtns").style.visibility="hidden";
  let ys=0, bs=0; setScore(0,0);
  // In the final match the bot's animals wear random skins from every pack
  // (not trophy skins like Gold, which have to be earned)
  const BOT_PACKS=Sk.SKIN_PACKS.filter(p=>!p.needSports);
  // A friend's animals wear the skins that friend chose
  const botSkin = a => ON ? ((ON.friendSkins||{})[a.id]||"base") : BOT_PACKS[Math.floor(Math.random()*BOT_PACKS.length)].id;
  for(const r of res.rows){
    const row=document.createElement("div"); row.className="res";
    const cell=(a,side)=>`<div class="a ${side} ${r.winner===side?"win":"lose"}"><span class="e">${side==="bot"?pic(a,botSkin(a)):pic(a)}</span><span class="n">${a.name}</span></div>`;
    row.innerHTML = cell(r.you,"you") + `<div class="mid"><b>${sportPic(r.sport)}</b>${r.sport.name}${r.close?'<br><span class="close">Close match!</span>':""}</div>` + cell(r.bot,"bot");
    list.appendChild(row);
    await sleep(80); if(!alive(t)) return;
    row.classList.add("show");
    await sleep(r.close?1300:950); if(!alive(t)) return;
    r.winner==="you" ? ys++ : bs++;
    setScore(ys,bs);
  }
  // Friend games count for stars, the album and the Social / Rival achievements only (not the bot stats or other achievements)
  const factsBefore = lvl==="hard" ? Save.loadFacts() : null;
  const s = lvl==="hard" && !ON ? Save.recordGame(lvl, res.won) : null;
  $("banner").innerHTML = res.won ? "🏆 You win!" : ON||TUT ? `${OPP()} wins` : "🤖 The bot wins";
  if(ON){ Save.recordOnline(ON.friendId, FN(), res.won);
    $("banner").innerHTML += `<div class="h2h">👥 ${h2h()}</div>`; }
  if(!s && !ON) $("banner").innerHTML += `<div class="muted" style="font-size:15px;font-weight:500">🎓 Sample game, not counted</div>`;
  if(res.won){ confetti(); if(s && s.streak>1) $("banner").innerHTML += `<div class="muted" style="font-size:16px;font-weight:500">🔥 ${s.streak} wins in a row</div>`; }
  if(lvl==="hard"){
    const news=Save.recordAlbum(res.rows, res.won), lines=[];
    if(news.unlocked.length) lines.push(`📖 New in your album: <b>${news.unlocked.map(a=>ipic(a)+" "+a.name).join(", ")}</b>`);
    news.firstSport.forEach(({animal,sport})=>lines.push(`🏅 ${ipic(animal)} ${animal.name} won its first ${sport.name}!`));
    // Trophy skins that just opened up (e.g. Gold after 5 different sports)
    Sk.SKIN_PACKS.filter(p=>p.needSports).forEach(p=>news.sportsWon.filter(x=>x.count===p.needSports).forEach(({animal})=>
      lines.push(`${p.icon} <b>${ipic(animal)} ${animal.name} unlocked the ${p.name} skin!</b> Get it in the shop`)));
    ON ? Save.recordFriendSports(res.rows) : Save.recordCounters(Ach.gameCounters(res, G.you.team, G.you.coins, TORTOISE_ID, G.you.maxPaid));
    const factsAfter=Save.loadFacts();
    Ach.newlyDone(factsBefore, factsAfter).forEach(({ach,tier})=>
      lines.push(`${Ach.TIER_ICONS[tier]} <b>${ach.name}</b>: ${ach.tiers[tier].text} <span class="starsTag">+${Sk.MEDAL_STARS[tier]} ⭐</span>`));
    const earned=Sk.gameStars(res); Save.addStars(earned);
    const medal=Save.syncMedalStars(Sk.medalStarsTotal(factsAfter));
    $("banner").innerHTML += `<div class="stars-earned">⭐ +${earned+medal} stars</div>`;
    renderStars();
    if(lines.length) $("banner").innerHTML += `<div class="album-news">${lines.join("<br>")}</div>`;
  }
  G=null; // game finished
  if(TUT){ const tut=TUT; TUT=null; return tut.results(res); }
  $("resBtns").style.visibility="visible";
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

/* ---------- The game's drawn sports at the top of the draft screen (tap for a description) ---------- */
let openGameSport=-1;
function renderGameSports(){
  openGameSport=-1; $("draftSportHint").hidden=true;
  const sports=G.view.sports;
  const html=sports.map((s,i)=>`<button type="button" data-slot="${i}"><b>${sportPic(s)}</b>${shortName(s)}</button>`).join("");
  document.querySelectorAll(".game-sports").forEach(el=>{
    el.innerHTML=html;
    el.querySelectorAll("button").forEach(b=>b.onclick=()=>{
      const i=+b.dataset.slot; openGameSport = openGameSport===i ? -1 : i;
      el.querySelectorAll("button").forEach(x=>x.classList.toggle("on", +x.dataset.slot===openGameSport));
      const h=$("draftSportHint"); h.hidden = openGameSport<0;
      if(openGameSport>=0) h.innerHTML=`<b>${sportPic(sports[i],true)} ${sports[i].name}:</b> ${sports[i].desc}`;
    });
  });
}
