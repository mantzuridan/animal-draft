// Achievements: definitions and how far the player has got. No storage, no DOM (can move to a server later).
// Every achievement has 4 tiers, earned IN ORDER: a tier only counts once the tier before it is done.
// Progress is kept as plain facts, so a later tier that was already reached completes by itself
// as soon as the tiers before it are done (e.g. the Tortoise's tier 4 before its tier 3).

export const TIER_ICONS = ["🥉","🥈","🥇","💎"];

const times = n => n===1 ? "once" : `${n} times`;
// A tier that needs some number to reach a target
const count = (value, targets, text) => targets.map(t => ({ check: f => value(f) >= t, progress: f => [Math.min(value(f), t), t], text: text(t) }));

export const ACHIEVEMENTS = [
  { id:"wins", icon:"🏆", name:"Champion",
    tiers: count(f=>f.wins, [10,50,100,250], n=>`Win ${n} games`) },
  { id:"streak", icon:"🔥", name:"On Fire",
    tiers: count(f=>f.bestStreak, [3,5,8,12], n=>`Win ${n} games in a row`) },
  { id:"sweep", icon:"🧹", name:"Clean Sweep",
    tiers: count(f=>f.sweeps, [1,5,15,30], n=>`Win 5–0 ${times(n)}`) },
  { id:"tortoise", icon:"🐢", name:"Slow and Steady",
    tiers: [
      { check: f=>f.tortoiseDrafted>0, text:"Get the Tortoise in your team" },
      { check: f=>f.tortoiseWins>=1, text:"Win a game with the Tortoise in your team" },
      { check: f=>f.tortoiseWins>=5, progress: f=>[Math.min(f.tortoiseWins,5),5], text:"Win 5 games with the Tortoise in your team" },
      { check: f=>f.tortoiseSportWins>0, text:"The Tortoise wins its sport in a game you win" },
    ] },
  { id:"saver", icon:"💰", name:"Penny Pincher",
    tiers: [8,12,15,17].map(t => ({ check: f=>f.maxLeftWin>=t, text:`Win a game with ${t} or more coins left` })) },
  { id:"allin", icon:"🎯", name:"All In",
    tiers: count(f=>f.zeroLeftWins, [1,5,15,30], n=>`Win with 0 coins left ${times(n)}`) },
  { id:"album", icon:"🗂️", name:"Collector",
    tiers: count(f=>f.albumUnlocked, [10,20,30,40], n=>`Unlock ${n} animals in the album`) },
  { id:"allround", icon:"🌟", name:"All-Rounder",
    tiers: count(f=>f.bestAllRound, [2,4,6,8], n=>`One animal wins in ${n} different sports`) },
  { id:"close", icon:"🪙", name:"Lucky Coin",
    tiers: count(f=>f.closeWins, [1,10,25,50], n=>n===1 ? "Win a close match (a tie decided by a coin flip)" : `Win ${n} close matches`) },
  { id:"bigspend", icon:"💸", name:"Big Spender",
    tiers: count(f=>f.bigSpends, [1,5,15,40], n=>`Win a game where you paid 10+ coins for one animal${n===1?"":`, ${n} times`}`) },
  { id:"veteran", icon:"🎮", name:"Veteran",
    tiers: count(f=>f.games, [25,100,250,500], n=>`Play ${n} games`) },
  { id:"fashion", icon:"🎨", name:"Fashionista",
    tiers: count(f=>f.skinsOwned, [5,15,40,80], n=>`Own ${n} skins`) },
  { id:"everysport", icon:"🏟️", name:"Every Sport",
    tiers: count(f=>f.everySport, [1,5,15,30], n=>n===1 ? "Win in each of the 8 sports" : `Win each of the 8 sports ${n} times`) },
  // Friend games only
  { id:"social", icon:"👥", name:"Social",
    tiers: count(f=>f.onlineGames, [1,10,30,75], n=>n===1 ? "Play a game against a friend" : `Play ${n} games against friends`) },
  { id:"rival", icon:"🤝", name:"Rival",
    tiers: count(f=>f.onlineWins, [1,10,25,60], n=>n===1 ? "Beat a friend" : `Beat friends ${n} times`) },
];

// How many tiers of an achievement are done (0-4), walking them in order
export function tiersDone(ach, facts){
  let n=0; while(n<ach.tiers.length && ach.tiers[n].check(facts)) n++;
  return n;
}
export const totalTiers = () => ACHIEVEMENTS.reduce((s,a)=>s+a.tiers.length, 0);

// Tiers that became done between two sets of facts: [{ach, tier}] (tier = 0..3)
export function newlyDone(before, after){
  const out=[];
  for(const a of ACHIEVEMENTS){ const b=tiersDone(a,before), n=tiersDone(a,after); for(let t=b; t<n; t++) out.push({ach:a, tier:t}); }
  return out;
}

// The counters one finished (counted) game adds. res = resolve() result, team = your 5 animals, coinsLeft = your coins, maxPaid = most you paid for one animal
export function gameCounters(res, team, coinsLeft, tortoiseId, maxPaid=0){
  const won=res.won, hasTortoise=team.some(a=>a.id===tortoiseId);
  return {
    sweeps: won && res.ys===5 ? 1 : 0,
    tortoiseDrafted: hasTortoise ? 1 : 0,
    tortoiseWins: won && hasTortoise ? 1 : 0,
    tortoiseSportWins: won && res.rows.some(r=>r.you.id===tortoiseId && r.winner==="you") ? 1 : 0,
    zeroLeftWins: won && coinsLeft===0 ? 1 : 0,
    closeWins: res.rows.filter(r=>r.close && r.winner==="you").length,
    maxLeftWin: won ? coinsLeft : 0,   // kept as a maximum, not a sum
    bigSpends: won && maxPaid>=10 ? 1 : 0,
  };
}
