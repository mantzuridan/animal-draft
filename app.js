// Animal Draft screens: everything the player sees and taps.
// Game rules and bots live in engine.js; saved progress lives in save.js.
import * as E from "./engine.js";
import * as Save from "./save.js";
import * as Ach from "./achievements.js";
import * as Sk from "./skins.js";
const TORTOISE_ID = E.ALL_ANIMALS.find(a=>a.name==="Tortoise").id;

/* ---------- Helpers ---------- */
const $ = id => document.getElementById(id);
// Animal pictures in the player's chosen skin (or in a given pack)
const skinOf = a => Save.equipped(Save.loadSkins(), a.id);
const picSrc = (a, packId=skinOf(a)) => Sk.skinSrc(a, packId);
const pxClass = packId => Sk.packById(packId).pixel ? " px" : "";
const pic = (a, packId=skinOf(a)) => `<img class="pic${pxClass(packId)}" src="${picSrc(a,packId)}" alt="${a.name}" draggable="false">`;
const ipic = a => `<img class="ipic${pxClass(skinOf(a))}" src="${picSrc(a)}" alt="">`;
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
  // In the final match the bot's animals wear random skins from every pack
  const botSkin = () => Sk.SKIN_PACKS[Math.floor(Math.random()*Sk.SKIN_PACKS.length)].id;
  for(const r of res.rows){
    const row=document.createElement("div"); row.className="res";
    const cell=(a,side)=>`<div class="a ${side} ${r.winner===side?"win":"lose"}"><span class="e">${side==="bot"?pic(a,botSkin()):pic(a)}</span><span class="n">${a.name}</span></div>`;
    row.innerHTML = cell(r.you,"you") + `<div class="mid"><b>${r.sport.icon}</b>${r.sport.name}${r.close?'<br><span class="close">Close match!</span>':""}</div>` + cell(r.bot,"bot");
    list.appendChild(row);
    await sleep(80); if(!alive(t)) return;
    row.classList.add("show");
    await sleep(r.close?1300:950); if(!alive(t)) return;
    r.winner==="you" ? ys++ : bs++;
    setScore(ys,bs);
  }
  const factsBefore = lvl==="hard" ? Save.loadFacts() : null;
  const s = lvl==="hard" ? Save.recordGame(lvl, res.won) : null;
  $("banner").innerHTML = res.won ? "🏆 You win!" : "🤖 The bot wins";
  if(!s) $("banner").innerHTML += `<div class="muted" style="font-size:15px;font-weight:500">🐣 Practice game, not counted</div>`;
  if(res.won){ confetti(); if(s && s.streak>1) $("banner").innerHTML += `<div class="muted" style="font-size:16px;font-weight:500">🔥 ${s.streak} wins in a row</div>`; }
  if(lvl==="hard"){
    const news=Save.recordAlbum(res.rows, res.won), lines=[];
    if(news.unlocked.length) lines.push(`📖 New in your album: <b>${news.unlocked.map(a=>ipic(a)+" "+a.name).join(", ")}</b>`);
    news.firstSport.forEach(({animal,sport})=>lines.push(`🏅 ${ipic(animal)} ${animal.name} won its first ${sport.name}!`));
    Save.recordCounters(Ach.gameCounters(res, G.you.team, G.you.coins, TORTOISE_ID));
    const factsAfter=Save.loadFacts();
    Ach.newlyDone(factsBefore, factsAfter).forEach(({ach,tier})=>
      lines.push(`${Ach.TIER_ICONS[tier]} <b>${ach.name}</b>: ${ach.tiers[tier].text} <span class="starsTag">+${Sk.MEDAL_STARS[tier]} ⭐</span>`));
    const earned=Sk.gameStars(res); Save.addStars(earned);
    const medal=Save.syncMedalStars(Sk.medalStarsTotal(factsAfter));
    $("banner").innerHTML += `<div class="stars-earned">⭐ +${earned+medal} stars</div>`;
    renderStars();
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
  renderAnimalSkins(a, $("adSkins"), ()=>showAlbumAnimal(a));
  show("animal");
}
// Row of the skins the player owns for one animal; tapping one puts it on
function renderAnimalSkins(a, box, onChange, onMore=()=>openShopAnimal(a)){
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

/* ---------- Stars ---------- */
function renderStars(){ const s=Save.loadWallet().stars; document.querySelectorAll(".starsVal").forEach(e=>e.textContent=s.toLocaleString("en-US")); }

/* ---------- Bottom sheet (preview, buy, choose) ---------- */
function openSheet(html){ $("sheetCard").innerHTML=html; $("sheet").classList.add("on"); }
function closeSheet(){ $("sheet").classList.remove("on"); }
$("sheet").onclick=e=>{ if(e.target.id==="sheet") closeSheet(); };

/* ---------- Shop ---------- */
let shopTab="packs", shopBack=null;   // shopBack: where the shop's ✕ returns to
const ALL_IDS = () => E.ALL_ANIMALS.map(a=>a.id);
const SELL = () => Sk.SKIN_PACKS.filter(p=>p.price>0);
function openShop(back){ shopBack=back||null; renderStars(); renderShop(); show("shop"); }
function renderShop(){
  document.querySelectorAll("#shopTabs button").forEach(b=>b.classList.toggle("on", b.dataset.tab===shopTab));
  const box=$("shopBody"), sk=Save.loadSkins(), total=E.ALL_ANIMALS.length;
  if(shopTab==="packs"){
    box.innerHTML=SELL().map(p=>{
      const n=Save.ownedCount(sk,p.id), price=Sk.packPriceFor(p,n,total);
      const prev=["Lion","Elephant","Panda","Dolphin"].map(nm=>pic(E.ALL_ANIMALS.find(a=>a.name===nm),p.id)).join("");
      return `<div class="pack card"><div class="pack-top"><b>${p.icon} ${p.name}</b><span class="muted">${n} / ${total} owned</span></div>
        <div class="pack-prev">${prev}</div>
        <div class="pack-btns"><button class="btn ghost small" data-browse="${p.id}">Browse · ${p.price} ⭐ each</button>
        ${price ? `<button class="btn small" data-buypack="${p.id}">Whole pack · ${price.toLocaleString("en-US")} ⭐</button>` : `<button class="btn small" disabled>✓ Complete</button>`}</div></div>`;
    }).join("");
    box.querySelectorAll("[data-browse]").forEach(b=>b.onclick=()=>renderShopPack(b.dataset.browse));
    box.querySelectorAll("[data-buypack]").forEach(b=>b.onclick=()=>askBuyPack(Sk.packById(b.dataset.buypack)));
  } else {
    box.innerHTML=`<div class="album-grid">`+E.ALL_ANIMALS.map(a=>{
      const n=SELL().filter(p=>Save.owns(sk,p.id,a.id)).length;
      return `<div class="acard" data-id="${a.id}"><div class="e">${pic(a,"base")}</div><div class="n">${a.name}</div><div class="medals">${n}/${SELL().length}</div></div>`;
    }).join("")+`</div>`;
    box.querySelectorAll("[data-id]").forEach(d=>d.onclick=()=>renderShopAnimal(E.ALL_ANIMALS[+d.dataset.id]));
  }
}
// One pack: every animal in that skin
function renderShopPack(packId){
  const p=Sk.packById(packId), sk=Save.loadSkins();
  $("shopBody").innerHTML=`<button class="linkbtn" id="shopUp">‹ All packs</button><div class="hint">${p.icon} ${p.name} · ${p.price} ⭐ each</div><div class="album-grid">`+
    E.ALL_ANIMALS.map(a=>`<div class="acard${Save.owns(sk,p.id,a.id)?" owned":""}" data-id="${a.id}"><div class="e">${pic(a,p.id)}</div><div class="n">${a.name}</div><div class="medals">${Save.owns(sk,p.id,a.id)?"✓":p.price+"⭐"}</div></div>`).join("")+`</div>`;
  $("shopUp").onclick=renderShop;
  $("shopBody").querySelectorAll("[data-id]").forEach(d=>d.onclick=()=>askBuySkin(E.ALL_ANIMALS[+d.dataset.id], p, ()=>renderShopPack(packId)));
}
// One animal: every skin it can wear
function renderShopAnimal(a){
  const sk=Save.loadSkins();
  $("shopBody").innerHTML=`<button class="linkbtn" id="shopUp">‹ All animals</button><div class="hint">${a.name}</div><div class="album-grid">`+
    Sk.SKIN_PACKS.map(p=>`<div class="acard${Save.owns(sk,p.id,a.id)?" owned":""}" data-pack="${p.id}"><div class="e">${pic(a,p.id)}</div><div class="n">${p.name}</div><div class="medals">${Save.owns(sk,p.id,a.id)?"✓":p.price+"⭐"}</div></div>`).join("")+`</div>`;
  $("shopUp").onclick=renderShop;
  $("shopBody").querySelectorAll("[data-pack]").forEach(d=>d.onclick=()=>askBuySkin(a, Sk.packById(d.dataset.pack), ()=>renderShopAnimal(a)));
}
function openShopAnimal(a){ shopTab="animals"; openShop("animal:"+a.id); renderShopAnimal(a); }
// Preview a skin; buy it, or put it on if it's already owned
function askBuySkin(a, p, refresh){
  const sk=Save.loadSkins(), have=Save.owns(sk,p.id,a.id), stars=Save.loadWallet().stars, on=Save.equipped(sk,a.id)===p.id;
  openSheet(`<div class="sheet-pic">${pic(a,p.id)}</div><div class="aname">${a.name}</div><div class="muted">${p.icon} ${p.name} skin</div>`+
    (have ? `<button class="btn green" id="sheetGo" ${on?"disabled":""}>${on?"✓ In use":"Use this skin"}</button>`
          : `<button class="btn green" id="sheetGo" ${stars<p.price?"disabled":""}>Buy · ${p.price} ⭐</button>`+
            (stars<p.price ? `<div class="hint">You need ${p.price-stars} more ⭐</div>` : ""))+
    `<button class="btn ghost" id="sheetNo">Close</button>`);
  $("sheetNo").onclick=closeSheet;
  $("sheetGo").onclick=()=>{
    if(have){ Save.equip(a.id,p.id); toast(`${a.name} is now in ${p.name}!`); closeSheet(); refresh(); return; }
    if(!Save.buySkins(p.id,[a.id],p.price)) return;
    renderStars(); refresh(); askBuySkin(a,p,refresh); toast(`🎉 ${p.name} ${a.name} is yours!`);
  };
}
function askBuyPack(p){
  const total=E.ALL_ANIMALS.length, sk=Save.loadSkins(), n=Save.ownedCount(sk,p.id), price=Sk.packPriceFor(p,n,total), stars=Save.loadWallet().stars;
  const prev=E.ALL_ANIMALS.slice(0,8).map(a=>pic(a,p.id)).join("");
  openSheet(`<div class="pack-prev big">${prev}</div><div class="aname">${p.icon} ${p.name} pack</div>`+
    `<div class="muted">All ${total-n} skins you don't have yet${n>10?" (priced one by one, since you already own "+n+")":""}</div>`+
    `<button class="btn green" id="sheetGo" ${stars<price?"disabled":""}>Buy pack · ${price.toLocaleString("en-US")} ⭐</button>`+
    (stars<price ? `<div class="hint">You need ${(price-stars).toLocaleString("en-US")} more ⭐</div>` : "")+
    `<button class="btn ghost" id="sheetNo">Close</button>`);
  $("sheetNo").onclick=closeSheet;
  $("sheetGo").onclick=()=>{
    const missing=E.ALL_ANIMALS.filter(a=>!Save.owns(sk,p.id,a.id)).map(a=>a.id);
    if(!Save.buySkins(p.id,missing,price)) return;
    renderStars(); renderShop();
    openSheet(`<div class="aname">🎉 ${p.name} pack is yours!</div><div class="muted">Put it on every animal now? You can still change single animals later.</div>`+
      `<button class="btn green" id="sheetGo">Apply to all animals</button><button class="btn ghost" id="sheetNo">Not now</button>`);
    $("sheetNo").onclick=closeSheet;
    $("sheetGo").onclick=()=>{ Save.equipAll(p.id, ALL_IDS()); closeSheet(); toast(`All animals are now ${p.name}!`); };
  };
}
document.querySelectorAll("#shopTabs button").forEach(b=>b.onclick=()=>{ shopTab=b.dataset.tab; renderShop(); });
$("shopBtn").onclick=()=>openShop();
$("shopClose").onclick=()=>{ const b=shopBack; shopBack=null;
  if(b && b.startsWith("animal:")) return showAlbumAnimal(E.ALL_ANIMALS[+b.split(":")[1]]);
  if(b==="wardrobe") return openWardrobe();
  goHome(); };

/* ---------- Wardrobe: choose which skin each animal wears ---------- */
function openWardrobe(){ renderWardrobe(); show("wardrobe"); }
function renderWardrobe(){
  const sk=Save.loadSkins(), total=E.ALL_ANIMALS.length;
  const packs=Sk.SKIN_PACKS.filter(p=>p.id==="base" || Save.ownedCount(sk,p.id)>0);
  $("wardAll").innerHTML=packs.map(p=>`<button type="button" class="btn ghost small" data-all="${p.id}">${p.icon} ${p.name}${p.id==="base"?"":` (${Save.ownedCount(sk,p.id)}/${total})`}</button>`).join("");
  $("wardAll").querySelectorAll("[data-all]").forEach(b=>b.onclick=()=>{ Save.equipAll(b.dataset.all, ALL_IDS()); renderWardrobe(); toast(`${Sk.packById(b.dataset.all).name} applied to every animal that has it`); });
  $("wardGrid").innerHTML=E.ALL_ANIMALS.map(a=>`<div class="acard" data-id="${a.id}"><div class="e">${pic(a)}</div><div class="n">${a.name}</div></div>`).join("");
  $("wardGrid").querySelectorAll("[data-id]").forEach(d=>d.onclick=()=>{
    const a=E.ALL_ANIMALS[+d.dataset.id];
    openSheet(`<div class="sheet-pic">${pic(a)}</div><div class="aname">${a.name}</div><div id="sheetSkins"></div><button class="btn ghost" id="sheetNo">Done</button>`);
    const more=()=>{ closeSheet(); shopTab="animals"; openShop("wardrobe"); renderShopAnimal(a); };
    const redraw=()=>{ $("sheetCard").querySelector(".sheet-pic").innerHTML=pic(a); renderAnimalSkins(a, $("sheetSkins"), redraw, more); renderWardrobeGridOnly(); };
    renderAnimalSkins(a, $("sheetSkins"), redraw, more);
    $("sheetNo").onclick=closeSheet;
  });
}
function renderWardrobeGridOnly(){ document.querySelectorAll("#wardGrid [data-id]").forEach(d=>{ d.querySelector(".e").innerHTML=pic(E.ALL_ANIMALS[+d.dataset.id]); }); }
$("wardBtn").onclick=openWardrobe;
$("wardShop").onclick=()=>openShop("wardrobe");
$("albumBtn").onclick=()=>{ renderAlbum(); show("album"); };

/* ---------- Achievements screen ---------- */
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
const TIER_LABEL=["Bronze","Silver","Gold","Diamond"];
$("achBtn").onclick=()=>{ renderAchievements(); show("achievements"); };
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
function goHome(){ token++; G=null; stopTimer(); closeSheet(); renderStars(); show("home"); }
$("playBtn").onclick=()=>{ level="hard"; newGame(); };
$("practiceBtn").onclick=()=>{ level="easy"; newGame(); };
$("againBtn").onclick=newGame;   // same mode as the game just played
$("homeBtn").onclick=goHome;
$("statsBtn").onclick=()=>{ renderStats(); show("stats"); };
$("rulesBtn").onclick=()=>show("rules");
document.querySelectorAll("[data-home]").forEach(b=>b.onclick=goHome);
document.querySelectorAll("[data-quit]").forEach(b=>b.onclick=()=>{ if(confirm("Quit this game? It won't count in your stats.")) goHome(); });
$("resetBtn").onclick=()=>{ if(confirm("Reset your whole account (stats, album, achievements, stars and skins)? This can't be undone.")){ Save.resetAccount(); renderStats(); } };

if("serviceWorker" in navigator && location.protocol==="https:"){ navigator.serviceWorker.register("sw.js").catch(()=>{}); }

// Hook for automated tests in the browser (read-only view of the current game)
window.__ad = { E, Save, Sk, get G(){ return G; }, get A(){ return A; }, newGame, goHome, startResults, renderAssign, setLevel(l){ level=l; } };

// Load all animal pictures in the background so reveals don't pop in
setTimeout(()=>E.ALL_ANIMALS.forEach(a=>{ const i=new Image(); i.src=picSrc(a); }), 1500);

// Stars for medals earned before stars existed (and any not paid yet)
Save.syncMedalStars(Sk.medalStarsTotal(Save.loadFacts()));
renderStars();
