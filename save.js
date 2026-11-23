// Player progress: stats per bot level, the animal album and achievement counters.
// Stored in this browser only (localStorage). Later this module is the one place to swap for a server account.

const STATS_KEY="animalDraft.stats", ALBUM_KEY="animalDraft.album", ACH_KEY="animalDraft.ach",
      WALLET_KEY="animalDraft.wallet", SKINS_KEY="animalDraft.skins";

function read(key){ try{ return JSON.parse(localStorage.getItem(key)); }catch(e){ return null; } }
// Every change to saved progress is reported to onChange (cloud.js uses it to back the progress up)
let changed=()=>{};
export const onChange = f => { changed=f; };
function write(key, v){ try{ localStorage.setItem(key, JSON.stringify(v)); }catch(e){} changed(); }

/* ---------- Stats: {easy:{games,wins,streak,best}, hard:{...}} ---------- */
export const emptyStats = () => ({games:0, wins:0, streak:0, best:0});
export function loadAllStats(){
  let v=read(STATS_KEY);
  if(v && typeof v.games==="number") v={easy:v};   // old single-level format counts as Easy
  v = v && typeof v==="object" ? v : {};
  return {easy:v.easy||emptyStats(), hard:v.hard||emptyStats()};
}
export const loadStats = level => loadAllStats()[level];
// Adds one finished game; returns the level's updated stats
export function recordGame(level, won){
  const all=loadAllStats(), s=all[level];
  s.games++; if(won){ s.wins++; s.streak++; s.best=Math.max(s.best,s.streak); } else s.streak=0;
  write(STATS_KEY, all); return s;
}

/* ---------- Album: {[animalId]: {played, won, sports:{[globalSportIndex]:{played, won}}}} ---------- */
export function loadAlbum(){ const v=read(ALBUM_KEY); return v && typeof v==="object" ? v : {}; }
export const isUnlocked = (alb, id) => !!(alb[id] && alb[id].won>0);
// Records a finished game from resolve()'s rows; returns what's new: unlocked animals and first wins in a sport
export function recordAlbum(rows, gameWon){
  // sportsWon: animals that reached a new number of different sports won ({animal, count})
  const alb=loadAlbum(), news={unlocked:[], firstSport:[], sportsWon:[]};
  for(const r of rows){
    const a=r.you, e=alb[a.id] || (alb[a.id]={played:0, won:0, sports:{}});
    const sp=e.sports[r.sportIdx] || (e.sports[r.sportIdx]={played:0, won:0});
    e.played++; sp.played++;
    if(r.winner==="you"){
      if(sp.won===0){ news.firstSport.push({animal:a, sport:r.sport});
        news.sportsWon.push({animal:a, count:Object.values(e.sports).filter(s=>s.won>0).length+1}); }
      sp.won++;
    }
    if(gameWon){ if(e.won===0) news.unlocked.push(a); e.won++; }
  }
  write(ALBUM_KEY, alb);
  // An animal that just unlocked doesn't also need its sport line
  news.firstSport=news.firstSport.filter(x=>!news.unlocked.includes(x.animal));
  return news;
}

/* ---------- Achievement counters: {sweeps, tortoiseDrafted, ..., maxLeftWin} ---------- */
function loadCounters(){ const v=read(ACH_KEY); return v && typeof v==="object" ? v : {}; }
// Adds one game's counters (maxLeftWin keeps the best value; the rest add up)
export function recordCounters(add){
  const c=loadCounters();
  for(const [k,v] of Object.entries(add)) c[k] = k==="maxLeftWin" ? Math.max(c[k]||0, v) : (c[k]||0)+v;
  write(ACH_KEY, c);
}
// Friend games don't count for achievements (only Social and Rival), but they do fill the album:
// their sport wins are kept apart (friendSport0..7) so Every Sport can leave them out.
export function recordFriendSports(rows){
  const add={}; for(const r of rows) if(r.winner==="you") add["friendSport"+r.sportIdx]=(add["friendSport"+r.sportIdx]||0)+1;
  recordCounters(add);
}
// Everything the achievements look at: games against the bot (Hard). Friend games only count for Social and Rival.
// Wins, games, streak and album come from the stats, online record and album already saved.
export function loadFacts(){
  const c=loadCounters(), s=loadStats("hard"), o=loadOnline(), alb=loadAlbum(), sk=loadSkins();
  const animals=Object.values(alb);
  const num=k=>c[k]||0;
  // Wins in each of the 8 sports over every animal, without friend games
  const sportWins=[0,1,2,3,4,5,6,7].map(i=>animals.reduce((t,e)=>t+((e.sports||{})[i]?.won||0),0)-num("friendSport"+i));
  return {
    wins:s.wins, games:s.games, bestStreak:s.best,
    onlineGames:o.games, onlineWins:o.wins,
    skinsOwned:Object.values(sk.owned).reduce((t,l)=>t+l.length,0),
    everySport:Math.min(...sportWins), bigSpends:num("bigSpends"),
    albumUnlocked: animals.filter(e=>e.won>0).length,
    bestAllRound: Math.max(0, ...animals.map(e=>Object.values(e.sports||{}).filter(sp=>sp.won>0).length)),
    sweeps:num("sweeps"), tortoiseDrafted:num("tortoiseDrafted"), tortoiseWins:num("tortoiseWins"),
    tortoiseSportWins:num("tortoiseSportWins"), zeroLeftWins:num("zeroLeftWins"), closeWins:num("closeWins"), maxLeftWin:num("maxLeftWin"),
  };
}

/* ---------- Wallet: {stars, medalsPaid} ---------- */
export function loadWallet(){ const v=read(WALLET_KEY); return {stars:(v&&v.stars)||0, medalsPaid:(v&&v.medalsPaid)||0}; }
export function addStars(n){ const w=loadWallet(); w.stars+=n; write(WALLET_KEY,w); return w.stars; }
// Pays the stars for medals not paid yet (also medals earned before stars existed); returns how many were added
export function syncMedalStars(total){
  const w=loadWallet(), add=Math.max(0,total-w.medalsPaid);
  if(add){ w.stars+=add; w.medalsPaid=total; write(WALLET_KEY,w); }
  return add;
}

/* ---------- Skins: {owned:{[packId]:[animalId...]}, equip:{[animalId]:packId}} ---------- */
export function loadSkins(){ const v=read(SKINS_KEY)||{}; return {owned:v.owned||{}, equip:v.equip||{}}; }
export const owns = (sk, packId, id) => packId==="base" || (sk.owned[packId]||[]).includes(id);
export const ownedCount = (sk, packId) => (sk.owned[packId]||[]).length;
// The pack an animal is shown in (falls back to the base look)
export function equipped(sk, id){ const p=sk.equip[id]; return p && owns(sk,p,id) ? p : "base"; }
// Buys skins (ids) of a pack for `price` stars. Returns false if there aren't enough stars.
export function buySkins(packId, ids, price){
  const w=loadWallet(); if(w.stars<price) return false;
  const sk=loadSkins(), list=sk.owned[packId]||(sk.owned[packId]=[]);
  for(const id of ids) if(!list.includes(id)) list.push(id);
  w.stars-=price; write(WALLET_KEY,w); write(SKINS_KEY,sk); return true;
}
export function equip(id, packId){ const sk=loadSkins(); if(!owns(sk,packId,id)) return; sk.equip[id]=packId; write(SKINS_KEY,sk); }
// Puts a pack on every animal that owns a skin from it
export function equipAll(packId, allIds){ const sk=loadSkins(); for(const id of allIds) if(owns(sk,packId,id)) sk.equip[id]=packId; write(SKINS_KEY,sk); }

/* ---------- Profile: {id, name} - the name friends see; id tells friends apart for head-to-head scores ---------- */
const PROFILE_KEY="animalDraft.profile";
export const NAME_MAX=12;
export const cleanName = s => (s||"").replace(/[<>&"'`]/g,"").replace(/\s+/g," ").trim().slice(0,NAME_MAX);
export function loadProfile(){
  const v=read(PROFILE_KEY)||{};
  if(!v.id){ v.id=Math.random().toString(36).slice(2,10)+Date.now().toString(36); write(PROFILE_KEY,v); }
  return {id:v.id, name:cleanName(v.name)};
}
export function setName(name){ const p=loadProfile(); p.name=cleanName(name); write(PROFILE_KEY,p); return p; }

/* ---------- Online games vs friends: {games, wins, streak, best, friends:{[id]:{name, wins, losses}}} ---------- */
const ONLINE_KEY="animalDraft.online";
export function loadOnline(){
  const v=read(ONLINE_KEY)||{};
  return {games:v.games||0, wins:v.wins||0, streak:v.streak||0, best:v.best||0, friends:v.friends||{}};
}
// Head-to-head record with one friend (wins/losses from my side)
export const vsFriend = id => loadOnline().friends[id] || {name:"", wins:0, losses:0};
// Adds a finished friend game; returns the updated head-to-head record
export function recordOnline(friendId, friendName, won){
  const o=loadOnline();
  o.games++; if(won){ o.wins++; o.streak++; o.best=Math.max(o.best,o.streak); } else o.streak=0;
  const f=o.friends[friendId] || (o.friends[friendId]={name:"", wins:0, losses:0});
  f.name=cleanName(friendName)||f.name; won ? f.wins++ : f.losses++; f.last=Date.now();
  write(ONLINE_KEY,o); return f;
}

/* ---------- Reset ---------- */
// Clears the whole account: stats, album, achievements, stars, skins and friend records (keeps the username)
export function resetAccount(){ try{ for(const k of [ALBUM_KEY,ACH_KEY,WALLET_KEY,SKINS_KEY,ONLINE_KEY]) localStorage.removeItem(k); }catch(e){} write(STATS_KEY, {easy:emptyStats(), hard:emptyStats()}); }

/* ---------- Whole save, for the cloud backup ---------- */
const SAVE_KEYS=[STATS_KEY,ALBUM_KEY,ACH_KEY,WALLET_KEY,SKINS_KEY,PROFILE_KEY,ONLINE_KEY];
// Everything the player has, as one object {key: value}
export function exportAll(){ const o={}; for(const k of SAVE_KEYS){ const v=read(k); if(v!=null) o[k]=v; } return o; }
// Replaces everything with a saved object (keys missing from it are cleared). Does not report a change.
export function importAll(o){ try{ for(const k of SAVE_KEYS){ if(o && o[k]!=null) localStorage.setItem(k, JSON.stringify(o[k])); else localStorage.removeItem(k); } }catch(e){} }
