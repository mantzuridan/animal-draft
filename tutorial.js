// Tutorial: a few cards that explain the game, then a guided sample game on the real game screens.
// The sample game uses fixed sports and a fixed order of animals; a coach bubble explains each step,
// and for the first moves only the button the coach points at can be tapped.
// game.js calls the hooks of the TUT object below (reveal, turn, bot, award, fill, assign, results).
import * as E from "./engine.js";
import * as Save from "./save.js";
import * as Game from "./game.js";
import { $, pic, sportPic, show, goHome, onGoHome, sleep } from "./ui.js";

const byName = n => E.ALL_ANIMALS.find(a=>a.name===n);

/* ---------- Intro cards ---------- */
const sportByKey = k => E.ALL_SPORTS.find(s=>s.key===k);
const pics = names => names.map(n=>`<span class="tut-a">${pic(byName(n))}</span>`).join("");
const CARDS = [
  { title:"Welcome to Animal Draft!",
    art:()=>`<div class="tut-row">${pics(["Cheetah","Dolphin","Rhino","Squirrel","Eagle"])}</div>`,
    text:"Build a team of <b>5 animals</b> and beat the bot in a mini Olympics. It takes 2 minutes to learn." },
  { title:"5 sports every game",
    art:()=>`<div class="tut-row">${["sprint","swim","lift","climb","archery"].map(k=>sportPic(sportByKey(k))).join("")}</div>`,
    text:"There are 8 sports. Each game draws <b>5 of them</b> at random, and you see them at the top of the screen before the first animal comes up." },
  { title:"The draft: bid for animals",
    art:()=>`<div class="tut-row"><span class="tut-coin">20 🪙</span><span class="tut-a">${pic(byName("Horse"))}</span><span class="tut-coin bot">20 🪙</span></div>`,
    text:"You and the bot each get <b>20 coins</b>. Animals come up one at a time and you take turns bidding. Bid <b>+1</b>, or <b>Choose…</b> a bigger amount. Whoever <b>passes</b> loses the animal, and the highest bidder pays. Each player needs 5 animals." },
  { title:"Secret scores",
    art:()=>`<div class="tut-row"><span class="tut-a">${pic(byName("Cheetah"))}</span><span class="tut-arrow">→</span>${sportPic(sportByKey("sprint"))}<span class="tut-arrow">👍</span></div>`,
    text:"Every animal has a <b>secret score from 1 to 10</b> in each sport, based on real life. A cheetah is a great sprinter, a dolphin a great swimmer. Some animals will surprise you!" },
  { title:"Pick your athletes",
    art:()=>`<div class="tut-row"><span class="tut-a">${pic(byName("Squirrel"))}</span><span class="tut-arrow">→</span>${sportPic(sportByKey("climb"))}</div>`,
    text:"When both teams have 5 animals, put <b>one animal in each sport</b>. The bot picks its athletes in secret at the same time." },
  { title:"The games",
    art:()=>`<div class="tut-row"><span class="tut-score">3 – 2</span><span class="tut-arrow">🏆</span></div>`,
    text:"In each sport your animal faces the bot's. The <b>higher secret score wins</b>, and a tie is a coin flip. Win <b>3 of the 5 sports</b> to win the game, and earn ⭐ stars for skins." },
  { title:"Try a sample game",
    art:()=>`<div class="tut-row"><span class="tut-a">${pic(byName("Chimpanzee"))}</span></div>`,
    text:"Play a practice game with tips along the way. No timer, and it doesn't count in your stats.",
    last:true },
];
let card=0;
export function openTutorial(){ card=0; renderCard(); show("tutorial"); }
function renderCard(){
  const c=CARDS[card];
  $("tutArt").innerHTML=c.art(); $("tutTitle").textContent=c.title; $("tutText").innerHTML=c.text;
  $("tutDots").innerHTML=CARDS.map((_,i)=>`<i class="${i===card?"on":""}"></i>`).join("");
  $("tutBack").style.visibility = card ? "visible" : "hidden";
  $("tutNext").hidden=!!c.last; $("tutPlay").hidden=!c.last; $("tutSkip").hidden=!c.last;
}
$("tutNext").onclick=()=>{ card=Math.min(card+1,CARDS.length-1); renderCard(); };
$("tutBack").onclick=()=>{ card=Math.max(card-1,0); renderCard(); };
$("tutPlay").onclick=()=>startSample();
$("tutSkip").onclick=()=>{ Save.setTutorialDone(); goHome(); };
$("tutRules").onclick=()=>show("rules");

/* ---------- Coach bubble ---------- */
let allow=null, onTap=null, hi=[];
// text: what the coach says. opts: {target, allow:[elements], button:"Got it", buttons:[{label, cls}], onTap}
// With a button: resolves with the button's index when tapped. Without: shows the tip and resolves at once.
function coach(text, opts={}){
  const box=$("coach"); box.hidden=false; document.body.classList.add("coach-on");
  $("coachText").innerHTML=text;
  setHighlight(opts.target ? [].concat(opts.target) : []);
  allow = opts.allow || (opts.button||opts.buttons ? [] : null);
  onTap = opts.onTap || null;
  const btns = opts.buttons || (opts.button ? [{label:opts.button}] : []);
  $("coachBtns").innerHTML=btns.map((b,i)=>`<button class="btn small ${b.cls||""}" data-i="${i}">${b.label}</button>`).join("");
  // Keep the bubble away from what it points at
  const t=opts.target && [].concat(opts.target)[0];
  const low = t ? t.getBoundingClientRect().top > window.innerHeight*.5 : false;   // no target: at the bottom (the page gets extra room below)
  box.classList.toggle("top", low);
  return new Promise(res=>{
    if(!btns.length) return res();
    $("coachBtns").querySelectorAll("button").forEach(b=>b.onclick=()=>{ hideCoach(); res(+b.dataset.i); });
  });
}
function hideCoach(){ $("coach").hidden=true; document.body.classList.remove("coach-on"); allow=null; onTap=null; setHighlight([]); }
function setHighlight(els){ hi.forEach(e=>e.classList.remove("tut-hi")); hi=els.filter(Boolean); hi.forEach(e=>e.classList.add("tut-hi")); }
// While the coach limits taps, block every tap outside the allowed elements and the bubble itself
document.addEventListener("click", e=>{
  if(!allow) return;
  if(e.target.closest("#coach, [data-quit], [data-home]")) return;   // the coach and the way out always work
  const ok=allow.some(el=>el && el.contains(e.target));
  if(!ok){ e.stopPropagation(); e.preventDefault(); $("coach").classList.remove("nudge"); void $("coach").offsetWidth; $("coach").classList.add("nudge"); return; }
  if(onTap){ const f=onTap; setTimeout(()=>f(e.target),0); }
}, true);
onGoHome(()=>{ hideCoach(); TUT_ON=false; });

/* ---------- The sample game ---------- */
const SPORTS=[0,1,2,6,7];   // 100m Sprint, Swimming, Weightlifting, Climbing, Archery
const FIRST=["Cheetah","Tortoise","Dolphin","Elephant","Squirrel","Eagle","Gorilla","Shark","Rabbit","Horse","Chimpanzee","Rhino","Penguin","Panda","Frog"];
let TUT_ON=false, seen={};
const el = sel => document.querySelector(sel);
const animalName = G => G.cur && G.cur.animal.name;
const chipOf = name => [...document.querySelectorAll("#tray .chip")].find(c=>c.querySelector(".n").textContent===name);
const slotOf = i => document.querySelectorAll("#sportSlots .sslot")[i];

function startSample(){
  TUT_ON=true; seen={}; assignStep=0;
  Game.setLevel("easy");
  Game.newGame(null, TUT);
}

const TUT = {
  label:"🎓 Sample game",
  sports:SPORTS,
  // Animals come out of the end of the pool: the fixed ones first, then the rest in random order
  pool(view){
    const first=FIRST.map(n=>view.animals.find(a=>a.name===n));
    const rest=view.animals.filter(a=>!first.includes(a)).sort(()=>Math.random()-.5);
    return [...rest, ...first.reverse()];
  },
  // A new animal is on screen (before anyone acts)
  async reveal(G, ev){
    const n=ev.animal.name;
    if(n==="Cheetah" && !seen.intro){ seen.intro=1;
      await coach("These are this game's <b>5 sports</b>. Tap one any time to read what it needs.", {target:el("#draft .game-sports"), button:"Got it"});
      await coach("You and the bot each have <b>20 coins</b> 🪙 to build a team of 5 animals.", {target:[$("sideYou"),$("sideBot")], button:"Got it"});
      await coach("Here comes the first animal: a <b>Cheetah</b>! It's the fastest animal on Earth, so it should be great at the 100m Sprint.", {target:$("aEmoji"), button:"Got it"});
    }
    if(ev.mode==="rich" && !seen.rich){ seen.rich=1;
      const you=G.cur.rich==="you";
      await coach(you ? "The bot is <b>out of coins</b>! Now you decide: buy each animal for 1 coin, or let it go to the bot for free."
                      : "You're <b>out of coins</b>, so the bot decides: it can buy each animal for 1 coin, or give it to you for free.", {button:"Got it"});
    }
  },
  // Your turn to bid: the first three animals are guided
  turn(G){
    const n=animalName(G), bid=G.cur.bid;
    if(n==="Cheetah" && bid===0) return coach("You open the bidding. Tap <b>+1</b> to bid 1 coin.", {target:$("plusBtn"), allow:[$("plusBtn")]});
    if(n==="Cheetah") return coach(`The bot raised to <b>${bid}</b>. The Cheetah is worth it: tap <b>+1</b> again.`, {target:$("plusBtn"), allow:[$("plusBtn")]});
    if(n==="Tortoise") return coach("A <b>Tortoise</b> is slow at almost everything. Don't waste coins on it: tap <b>Pass</b> and the bot gets it.", {target:$("passBtn"), allow:[$("passBtn")]});
    if(n==="Dolphin") return coach("A <b>Dolphin</b> is the best swimmer. To bid more than +1 at once, tap <b>Choose…</b>", {target:$("chooseBtn"), allow:[$("chooseBtn")],
      onTap:()=>coach("Use <b>+</b> to set your bid (try 4), then tap <b>Bid</b>.", {target:$("pickBid"), allow:[$("plusStep"),$("minusStep"),$("pickBid")]})});
    hideCoach();
  },
  // The bot's moves for the guided animals (null: the normal beginner bot decides)
  bot(G){
    const n=animalName(G), c=G.cur;
    if(c.mode!=="auction") return null;
    if(n==="Cheetah") return c.bid===1 ? {type:"bid", amount:2} : {type:"pass"};
    if(n==="Tortoise") return c.bid===0 ? {type:"bid", amount:1} : {type:"pass"};
    if(n==="Dolphin") return {type:"pass"};
    return null;
  },
  async award(G, ev){
    const n=ev.animal.name;
    if(n==="Cheetah") await coach(`You got the Cheetah for <b>${ev.price} coins</b>. You have ${G.you.coins} left, and spent coins don't come back, so spend wisely!`, {target:$("coinsYou"), button:"Got it"});
    if(n==="Tortoise") await coach("The bot paid 1 coin for the Tortoise. Passing is a smart move when an animal won't help your team.", {button:"Got it"});
    if(n==="Dolphin"){
      await coach(`Nice! The Dolphin is yours for ${ev.price}. A big bid can scare the other side away.`, {button:"Got it"});
      await coach("Now finish the draft on your own until you have <b>5 animals</b>. Think about which sports each animal is good at, and keep some coins for later. (Real games give you 20 seconds per turn.)", {button:"Let's go!"});
    }
  },
  async fill(G, ev){
    if(seen.fill) return; seen.fill=1;
    await coach(ev.side==="you" ? "The bot's team is full, so the rest of <b>your</b> team is filled with random animals for free."
                                : "Your team is full! The bot's team is now filled with random animals for free.", {button:"Got it"});
  },
  // Picking athletes: place the Cheetah with help, then the rest freely
  async assign(){
    await coach("Your team is ready! Now <b>pick your athletes</b>: one animal for each sport. The bot is choosing in secret too.", {button:"Got it"});
    assignStep=1; TUT.assignChange(Game.getAssign());
  },
  assignChange(A){
    if(!TUT_ON || !assignStep || !A) return;
    if(assignStep===1){
      if(A.selected && A.selected.name==="Cheetah"){ assignStep=2; }
      else { coach("Tap the <b>Cheetah</b>…", {target:chipOf("Cheetah"), allow:[chipOf("Cheetah")]}); return; }
    }
    if(assignStep===2){
      if(A.plan[0] && A.plan[0].name==="Cheetah"){ assignStep=3; }
      else { coach("…then tap <b>100m Sprint</b>.", {target:slotOf(0), allow:[slotOf(0)]}); return; }
    }
    if(assignStep===3){
      if(A.plan.some(x=>!x)) coach("Now place your other animals. Tap an animal, then a sport. Tap a placed animal to take it back.");
      else coach("All set! Tap <b>Start the games!</b>", {target:$("confirmBtn")});
    }
  },
  async results(res){
    hideCoach();
    await sleep(600);
    await coach("In each sport your animal faces the bot's. The <b>higher secret score wins</b>, and a tie is a coin flip (<i>Close match!</i>). Win <b>3 of 5</b> to win the game.", {button:"Got it"});
    Save.setTutorialDone();
    const head = res.won ? "🏆 You won your first game!" : "So close! The bot won this one.";
    const i = await coach(`${head} You're ready for real games: they count for your stats, album and ⭐ stars.`,
      {buttons:[{label:"▶ Play for real", cls:"green"},{label:"Home", cls:"ghost"}]});
    TUT_ON=false;
    if(i===0){ Game.setLevel("hard"); Game.newGame(); } else goHome();
  },
};
let assignStep=0;

/* ---------- First launch ---------- */
// New players (no games yet, tutorial not seen) are offered the tutorial once
export function offerOnFirstLaunch(openSheet, closeSheet){
  const st=Save.loadAllStats();
  if(Save.tutorialDone() || st.hard.games+st.easy.games>0) return;
  openSheet(`<div class="aname">👋 New here?</div><div class="muted">Learn Animal Draft in 2 minutes, with a sample game.</div>`+
    `<button class="btn green" id="tutYes">🎓 Start the tutorial</button><button class="btn ghost" id="tutNo">I know how to play</button>`);
  $("tutYes").onclick=()=>{ closeSheet(); openTutorial(); };
  $("tutNo").onclick=()=>{ Save.setTutorialDone(); closeSheet(); };
}
