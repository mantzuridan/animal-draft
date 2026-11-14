// Player progress: stats per bot level, the animal album and achievement counters.
// Stored in this browser only (localStorage). Later this module is the one place to swap for a server account.

const STATS_KEY="animalDraft.stats", ALBUM_KEY="animalDraft.album", ACH_KEY="animalDraft.ach";

function read(key){ try{ return JSON.parse(localStorage.getItem(key)); }catch(e){ return null; } }
function write(key, v){ try{ localStorage.setItem(key, JSON.stringify(v)); }catch(e){} }

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
  const alb=loadAlbum(), news={unlocked:[], firstSport:[]};
  for(const r of rows){
    const a=r.you, e=alb[a.id] || (alb[a.id]={played:0, won:0, sports:{}});
    const sp=e.sports[r.sportIdx] || (e.sports[r.sportIdx]={played:0, won:0});
    e.played++; sp.played++;
    if(r.winner==="you"){ if(sp.won===0) news.firstSport.push({animal:a, sport:r.sport}); sp.won++; }
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
// Everything the achievements look at. Wins, streak and album come from the stats and album already saved.
export function loadFacts(){
  const c=loadCounters(), s=loadStats("hard"), alb=loadAlbum();
  const animals=Object.values(alb);
  const num=k=>c[k]||0;
  return {
    wins:s.wins, bestStreak:s.best,
    albumUnlocked: animals.filter(e=>e.won>0).length,
    bestAllRound: Math.max(0, ...animals.map(e=>Object.values(e.sports||{}).filter(sp=>sp.won>0).length)),
    sweeps:num("sweeps"), tortoiseDrafted:num("tortoiseDrafted"), tortoiseWins:num("tortoiseWins"),
    tortoiseSportWins:num("tortoiseSportWins"), zeroLeftWins:num("zeroLeftWins"), closeWins:num("closeWins"), maxLeftWin:num("maxLeftWin"),
  };
}

/* ---------- Reset ---------- */
// Clears the whole account: stats, album and achievements
export function resetAccount(){ write(STATS_KEY, {easy:emptyStats(), hard:emptyStats()}); try{ localStorage.removeItem(ALBUM_KEY); localStorage.removeItem(ACH_KEY); }catch(e){} }
