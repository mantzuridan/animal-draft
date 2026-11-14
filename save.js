// Player progress: stats per bot level and the animal album.
// Stored in this browser only (localStorage). Later this module is the one place to swap for a server account.

const STATS_KEY="animalDraft.stats", ALBUM_KEY="animalDraft.album", LEVEL_KEY="animalDraft.level";

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

/* ---------- Preferences and reset ---------- */
export function loadLevel(){ try{ return localStorage.getItem(LEVEL_KEY)==="hard" ? "hard" : "easy"; }catch(e){ return "easy"; } }
export function saveLevel(level){ try{ localStorage.setItem(LEVEL_KEY, level); }catch(e){} }
// Clears the whole account: stats for both levels and the album
export function resetAccount(){ write(STATS_KEY, {easy:emptyStats(), hard:emptyStats()}); try{ localStorage.removeItem(ALBUM_KEY); }catch(e){} }
