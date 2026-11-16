// Animal Draft game engine: data, rules, bots and results.
// No screens, no storage, no timers. The same file can run in the browser today and on a server later.
// A game is a plain state object; the caller moves it forward with advance(), act(), botAction() and resolve().

/* ---------- Data ---------- */
// All sports. Each game draws RULES.sportsPerGame of them.
// Saved progress refers to sports by their index in this list, so only ever ADD sports at the end.
export const ALL_SPORTS = [
  {key:"sprint",   name:"100m Sprint",   icon:"🏃", desc:"Top running speed over a short dash."},
  {key:"swim",     name:"Swimming",      icon:"🏊", desc:"Speed in the water. Running along the riverbed counts too!"},
  {key:"lift",     name:"Weightlifting", icon:"🏋️", desc:"Raw strength: how much weight it can move."},
  {key:"jump",     name:"High Jump",     icon:"⬆️", desc:"How high it can leap straight up. Wings give a small boost, and leaps out of the water count."},
  {key:"jav",      name:"Javelin",       icon:"🎯", desc:"Striking power: a kick, punch, tail swipe or trunk blow."},
  {key:"marathon", name:"Marathon",      icon:"🛣️", desc:"Endurance: how long it can keep running at a good pace."},
  {key:"climb",    name:"Climbing",      icon:"🧗", desc:"Climbing trees, rocks and cliffs."},
  {key:"archery",  name:"Archery",       icon:"🏹", desc:"Aim and eyesight: hitting a target with precision."},
];
// [name, emoji, sprint, swim, lift, highJump, javelin, marathon, climbing, archery]
// Saved progress refers to animals by their index (id), so only ever ADD animals at the end.
export const ALL_ANIMALS = [
  ["Cheetah","🐆",10,3,4,6,4,2,2,8],["Lion","🦁",10,4,7,8,7,3,4,6],["Tiger","🐅",8,5,8,10,8,3,3,7],["Puma","🐆",9,3,5,10,5,4,8,7],
  ["Jaguar","🐆",9,5,6,7,6,3,8,7],["Wolf","🐺",8,5,3,6,3,10,2,6],["Fox","🦊",7,4,1,6,1,7,4,8],["Grizzly Bear","🐻",8,5,9,3,9,5,4,4],
  ["Polar Bear","🐻‍❄️",6,6,9,3,9,6,3,4],["Panda","🐼",5,3,5,2,5,2,7,3],["Elephant","🐘",6,3,10,1,10,6,1,4],["Rhino","🦏",7,2,10,1,9,4,1,1],
  ["Hippo","🦛",5,6,10,1,7,2,1,2],["Giraffe","🦒",8,2,6,2,10,6,1,7],["Zebra","🦓",9,3,5,5,8,8,1,5],["Horse","🐎",9,4,7,7,8,10,1,5],
  ["Camel","🐫",9,2,7,3,6,9,1,4],["Moose","🫎",8,6,8,6,8,6,1,3],["Bison","🦬",8,4,9,6,9,7,2,3],["Kangaroo","🦘",9,4,5,9,8,8,2,4],
  ["Gorilla","🦍",6,1,8,4,8,2,5,7],["Chimpanzee","🐒",6,1,6,5,7,3,10,10],["Ostrich","🐦",9,3,4,6,8,8,1,7],["Eagle","🦅",2,2,2,5,4,2,2,10],
  ["Penguin","🐧",2,9,2,6,3,2,3,4],["Crocodile","🐊",4,8,7,5,7,1,3,5],["Tortoise","🐢",1,1,3,1,1,1,1,2],["Rabbit","🐇",8,3,1,5,2,3,2,4],
  ["Frog","🐸",2,4,1,4,1,1,4,6],["Otter","🦦",5,6,2,3,2,3,2,4],["Sea Lion","🦭",5,9,5,6,4,1,3,5],["Dolphin","🐬",1,10,4,10,8,1,1,5],
  ["Shark","🦈",1,10,6,9,7,1,1,5],["Impala","🦌",10,3,2,9,3,7,2,4],["Mountain Goat","🐐",5,2,4,8,6,5,9,5],["Wild Boar","🐗",7,4,6,5,6,5,1,2],
  ["Sloth","🦥",1,2,3,1,2,1,7,2],["Squirrel","🐿️",5,2,1,6,1,2,10,5],["Honey Badger","🦡",5,3,3,3,4,5,6,4],["Komodo Dragon","🦎",4,4,5,1,5,3,3,3],
].map(([name,emoji,...full],id)=>({id,name,emoji,full}));

export const RULES = {
  budget:20, teamSize:5, sportsPerGame:5,
  bidSecs:20, assignSecs:90,                 // timers (the screens enforce these)
  autoAssignMin:5,                            // player's auto-assignment when time runs out
};

// Bot levels. "easy" is the original bot; "hard" is the strongest version found in simulation.
export const LEVELS = {
  easy: {bid:"easy", assign:"easy", factor:1.4, brokeBuyAvg:5, assignMin:7},
  hard: {bid:"hard", assign:"hard", V0:.3, alpha:.25, jitter:1, reserve:1, ahead:0, endK:0, endMult:1},
};

/* ---------- Helpers ---------- */
export const other = side => side==="you" ? "bot" : "you";
export function mulberry32(a){ return function(){ a|=0; a=a+0x6D2B79F5|0; let t=Math.imul(a^a>>>15,1|a); t=t+Math.imul(t^t>>>7,61|t)^t; return ((t^t>>>14)>>>0)/4294967296; }; }
function shuffleWith(arr, rng){ for(let i=arr.length-1;i>0;i--){ const j=Math.floor(rng()*(i+1)); [arr[i],arr[j]]=[arr[j],arr[i]]; } return arr; }
const beat = (s,t) => s>t ? 1 : s===t ? .5 : 0;
const isFull = (st,side) => st[side].team.length >= RULES.teamSize;

/* ---------- A game's view: its sports, and animals scored only on those sports ---------- */
export function drawSports(rng=Math.random){ return shuffleWith([...ALL_SPORTS.keys()], rng).slice(0, RULES.sportsPerGame); }
export function makeView(sportIdx){
  const idx = sportIdx.slice().sort((a,b)=>a-b);
  const sports = idx.map(i=>ALL_SPORTS[i]);
  const animals = ALL_ANIMALS.map(a=>{ const s=idx.map(i=>a.full[i]); return {id:a.id, name:a.name, emoji:a.emoji, s, avg:s.reduce((x,y)=>x+y,0)/s.length}; });
  // F[i][s] = chance that score s beats a random animal in this game's sport i (tie = 1/2)
  const F = sports.map((_,i)=>{ const row=[0];
    for(let s=1;s<=10;s++){ let w=0; for(const b of animals) w+=beat(s,b.s[i]); row.push(w/animals.length); }
    return row; });
  return {sportIdx:idx, sports, animals, F};
}

/* ---------- Hard bot brain ---------- */
const PERMS = {};
function perms(k, n=RULES.sportsPerGame){ // every way to put k animals into k of the n sports
  const key=k+"/"+n; if(PERMS[key]) return PERMS[key];
  const out=[], cur=[], used=[];
  (function rec(){ if(cur.length===k){ out.push(cur.slice()); return; }
    for(let i=0;i<n;i++) if(!used[i]){ used[i]=1; cur.push(i); rec(); cur.pop(); used[i]=0; } })();
  return PERMS[key]=out;
}
// `see` lets a simulated player know the scores only roughly; real bots see the true scores
const trueScores = a => a.s;
// Team strength = best placement of its animals; each still-empty sport counts as an average 0.5
function bestPlacement(view, team, see=trueScores){
  const n=view.sports.length, k=team.length; let bv=-1, bp=[];
  for(const p of perms(k,n)){ let v=(n-k)*.5; for(let j=0;j<k;j++) v+=view.F[p[j]][see(team[j])[p[j]]]; if(v>bv){ bv=v; bp=p; } }
  return {v:bv, p:bp};
}
const strength = (view, team, see) => bestPlacement(view, team, see).v;
// Value = how much the animal improves my team + part (alpha) of how much it would improve the opponent's
function hardValue(view, me, opp, a, prof){
  const see=prof.see||trueScores;
  const g=strength(view,[...me.team,a],see)-strength(view,me.team,see);
  const og= opp.team.length<RULES.teamSize ? strength(view,[...opp.team,a],see)-strength(view,opp.team,see) : 0;
  return Math.max(g,0) + prof.alpha*Math.max(og,0);
}
// Highest price: budget per missing animal scaled by value, +-jitter per animal, keeping coins for later animals
function hardLimit(st, side, a, prof){
  const me=st[side], opp=st[other(side)];
  const need=RULES.teamSize-me.team.length;
  const perSlot=me.coins/Math.max(1,need-prof.ahead) * (need<=prof.endK ? prof.endMult : 1);
  const key=side+":"+a.id;
  if(!st.jit.has(key)) st.jit.set(key, prof.jitter ? Math.floor(st.rng()*(2*prof.jitter+1))-prof.jitter : 0);
  const m=Math.round(perSlot*hardValue(st.view,me,opp,a,prof)/prof.V0) + st.jit.get(key);
  const cap= need===1 ? me.coins : Math.floor(me.coins-prof.reserve*(need-1));
  return Math.max(0, Math.min(m,cap));
}
function pWin(ps){ let d=[1]; for(const p of ps){ const n=Array(d.length+1).fill(0); d.forEach((x,k)=>{ n[k]+=x*(1-p); n[k+1]+=x*p; }); d=n; } return d.slice(3).reduce((x,y)=>x+y,0); }
// Try every placement; pick the best chance to win 3+ sports vs the opponent's strongest and a random placement
function hardAssign(view, team, oppTeam, prof){
  const see=prof.see||trueScores, n=view.sports.length;
  const op=bestPlacement(view,oppTeam,see).p, oppBest=[]; oppTeam.forEach((a,j)=>oppBest[op[j]]=a);
  let best=null, bv=-1;
  for(const p of perms(n,n)){
    const plan=[]; team.forEach((a,j)=>plan[p[j]]=a);
    const pa=[], pb=[];
    for(let i=0;i<n;i++){ const s=see(plan[i])[i]; pa.push(beat(s,see(oppBest[i])[i]));
      let w=0; for(const b of oppTeam) w+=beat(s,see(b)[i]); pb.push(w/oppTeam.length); }
    const v=.5*pWin(pa)+.5*pWin(pb); if(v>bv){ bv=v; best=plan; }
  }
  return best;
}
// Simple placement: for each sport in order, the first remaining animal (purchase order) scoring >= min,
// or the last remaining animal if none qualifies. Keeps any animals already placed in `preset`.
export function autoAssign(view, team, min, preset){
  const plan = preset ? preset.slice() : Array(view.sports.length).fill(null);
  const left = team.filter(a=>!plan.includes(a));
  view.sports.forEach((sp,i)=>{
    if(plan[i]) return;
    const pick = left.find(a=>a.s[i]>=min) || left[left.length-1];
    plan[i]=pick; left.splice(left.indexOf(pick),1);
  });
  return plan;
}

/* ---------- Game state ---------- */
// level: the bot's level ("easy" | "hard"). rng: random source (seeded in tests and simulations).
// online: a game vs a friend (no bot plan; the friend's plan arrives over the network).
// flip: the same seeded game seen from the other phone - every coin flip lands on the other side.
export function createGame({level="easy", rng=Math.random, sportIdx, online=false, flip=false}={}){
  const view = makeView(sportIdx || drawSports(rng));
  return {
    level, rng, view, online, flip,
    pool: shuffleWith(view.animals.slice(), rng),
    you: {coins:RULES.budget, team:[]},
    bot: {coins:RULES.budget, team:[]},
    nextOpener: (rng()<.5)!==flip ? "you" : "bot",
    shown: 0,
    cur: null,          // the animal being decided: {animal, mode:"auction"|"rich", bid, leader, turn, rich}
    phase: "draft",     // "draft" -> "assign" -> "done"
    jit: new Map(),
    botPlan: null,
  };
}
// A fair coin between the two sides (mirrored on the friend's phone so both phones agree)
const coin = st => (st.rng()<.5)!==st.flip ? "you" : "bot";
const profileFor = (st, side, prof) => prof || LEVELS[side==="bot" ? st.level : "hard"];

// Moves the draft forward by one step when nobody has a decision to make. Returns what happened.
// Events: {type:"reveal", animal, opener, mode} | {type:"fill", side, animal} | {type:"award", side, animal, price} | {type:"draftDone"}
export function advance(st){
  if(st.phase!=="draft" || st.cur) return [];
  if(isFull(st,"you") && isFull(st,"bot")){
    st.phase="assign"; st.botPlan = st.online ? null : botAssign(st,"bot");
    return [{type:"draftDone"}];
  }
  // One team is full -> the other gets random animals, one per step
  if(isFull(st,"you") || isFull(st,"bot")){
    const side = isFull(st,"you") ? "bot" : "you";
    const a=st.pool.pop(); st.shown++; st[side].team.push(a);
    return [{type:"fill", side, animal:a}];
  }
  const a=st.pool.pop(); st.shown++;
  const opener=st.nextOpener; st.nextOpener=other(opener);
  const yc=st.you.coins>0, bc=st.bot.coins>0;
  if(yc && bc){
    st.cur={animal:a, mode:"auction", bid:0, leader:null, turn:opener};
    return [{type:"reveal", animal:a, opener, mode:"auction"}];
  }
  if(yc || bc){ // only one side has coins: it buys for 1 or lets the animal go to the other side for free
    const rich = yc ? "you" : "bot";
    st.cur={animal:a, mode:"rich", rich, turn:rich};
    return [{type:"reveal", animal:a, opener, mode:"rich"}];
  }
  // Nobody has coins: the team with fewer animals gets it for free
  const yl=st.you.team.length, bl=st.bot.team.length;
  const side = yl<bl ? "you" : bl<yl ? "bot" : coin(st);
  st.cur={animal:a, mode:"free"};
  return [{type:"reveal", animal:a, opener, mode:"free"}, ...award(st, side, 0)];
}
function award(st, side, price){
  const a=st.cur.animal; st[side].coins-=price; st[side].team.push(a); st.cur=null;
  return [{type:"award", side, animal:a, price}];
}

// What `side` may do right now (for the screens): null when it isn't their turn
export function options(st, side){
  const c=st.cur; if(!c || c.turn!==side) return null;
  if(c.mode==="auction") return {mode:"auction", minBid:c.bid+1, maxBid:st[side].coins, canBid:c.bid+1<=st[side].coins, canPass:c.bid>0};
  if(c.mode==="rich") return {mode:"rich"};
  return null;
}
// Applies a decision. action: {type:"bid", amount} | {type:"pass"} | {type:"buy"} | {type:"letGo"}.
// Returns the events, or null if the move isn't allowed.
export function act(st, side, action){
  const c=st.cur; if(st.phase!=="draft" || !c || c.turn!==side || !action) return null;
  if(c.mode==="auction"){
    if(action.type==="bid"){
      const amt=action.amount;
      if(!Number.isInteger(amt) || amt<=c.bid || amt<1 || amt>st[side].coins) return null;
      c.bid=amt; c.leader=side; c.turn=other(side);
      return [{type:"bid", side, amount:amt}];
    }
    if(action.type==="pass"){ if(c.bid===0) return null; return award(st, c.leader, c.bid); } // the opener can't pass
  } else if(c.mode==="rich"){
    if(action.type==="buy")   return award(st, side, 1);
    if(action.type==="letGo") return award(st, other(side), 0);
  }
  return null;
}
// The move made for a player who lets the timer run out: bid one more if possible, otherwise pass; buy when rich
export function timeoutAction(st, side){
  const c=st.cur; if(!c || c.turn!==side) return null;
  if(c.mode==="auction"){ const n=c.bid+1; return n<=st[side].coins ? {type:"bid", amount:n} : {type:"pass"}; }
  if(c.mode==="rich") return {type:"buy"};
  return null;
}
// A bot's decision for `side` (normally "bot"). `prof` overrides the level profile (simulations).
export function botAction(st, side="bot", prof){
  const c=st.cur; if(!c || c.turn!==side) return null;
  const p=profileFor(st, side, prof), a=c.animal, me=st[side];
  const limit = () => p.bid==="hard" ? hardLimit(st, side, a, p) : Math.min(Math.floor(a.avg*p.factor), me.coins);
  if(c.mode==="auction"){
    if(c.bid===0) return {type:"bid", amount:1};          // the opener must bid at least 1
    return c.bid+1<=limit() ? {type:"bid", amount:c.bid+1} : {type:"pass"};
  }
  if(c.mode==="rich"){
    const buy = p.bid==="hard" ? limit()>=1 : a.avg>=p.brokeBuyAvg;
    return {type: buy ? "buy" : "letGo"};
  }
  return null;
}
// A bot's placement of its team into the game's sports
export function botAssign(st, side="bot", prof){
  const p=profileFor(st, side, prof), me=st[side], opp=st[other(side)];
  return p.assign==="hard" ? hardAssign(st.view, me.team, opp.team, p) : autoAssign(st.view, me.team, p.assignMin);
}
// The player's placement when the assignment timer runs out (keeps what they already placed)
export function autoAssignPlayer(st, preset){ return autoAssign(st.view, st.you.team, RULES.autoAssignMin, preset); }

// Plays out the sports. youPlan: one of your animals per sport. Ties are a coin flip ("close").
export function resolve(st, youPlan){
  if(st.phase!=="assign") return null;
  const n=st.view.sports.length;
  if(!Array.isArray(youPlan) || youPlan.length!==n || new Set(youPlan).size!==n || !youPlan.every(a=>st.you.team.includes(a))) return null;
  const rows=[]; let ys=0, bs=0;
  for(let i=0;i<n;i++){
    const ya=youPlan[i], ba=st.botPlan[i], yv=ya.s[i], bv=ba.s[i];
    const winner = yv>bv ? "you" : bv>yv ? "bot" : coin(st);
    rows.push({sport:st.view.sports[i], sportIdx:st.view.sportIdx[i], you:ya, bot:ba, winner, close:yv===bv});
    winner==="you" ? ys++ : bs++;
  }
  st.phase="done";
  return {rows, ys, bs, won: ys>bs};
}
