// Friend games: a room between two phones, identified by a 4-letter code.
// Both phones run the same seeded game (engine.js) and only send each other their moves.
// Transport: Supabase Realtime (broadcast + presence; nothing is stored). Until a project is set up,
// or with ?local in the address, two tabs of the same browser talk through a BroadcastChannel (for testing).

const SUPABASE_URL = "https://hxnhkcbhpczmqlogerar.supabase.co";   // project "animal-draft"
const SUPABASE_KEY = "sb_publishable_xuZzjl0Ad48NoH_aoVeHSg_MqUgJMJT";   // publishable key: safe to ship in the page
const SUPABASE_JS = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.57.4/+esm";

const LETTERS = "ABCDEFGHJKLMNPQRSTUVWXYZ";   // no I / O (look like 1 / 0)
export const newCode = () => Array.from({length:4}, ()=>LETTERS[Math.floor(Math.random()*LETTERS.length)]).join("");
export const cleanCode = s => (s||"").toUpperCase().replace(/[^A-Z]/g,"").slice(0,4);
const useLocal = () => !SUPABASE_URL || new URLSearchParams(location.search).has("local");

let sb=null;
async function client(){
  if(!sb){ const { createClient } = await import(SUPABASE_JS); sb=createClient(SUPABASE_URL, SUPABASE_KEY); }
  return sb;
}

// Opens room `code` as "host" or "guest".
// handlers: onMessage(msg), onFriendLeft(). Returns {send(msg), close(), friendHere()}.
export async function openRoom(code, role, {onMessage, onFriendLeft, onFriendJoined}){
  const me = role, friend = role==="host" ? "guest" : "host";
  let closed=false, here=false;
  const joined = () => { if(!here){ here=true; onFriendJoined && onFriendJoined(); } };
  const left = () => { if(here && !closed){ here=false; onFriendLeft && onFriendLeft(); } };

  if(useLocal()){
    const ch = new BroadcastChannel("animal-draft-room-"+code);
    const ping = () => ch.postMessage({sys:"here", from:me});
    ch.onmessage = e => { const m=e.data; if(closed || m.from===me) return;
      if(m.sys==="here"){ if(!here){ joined(); ping(); } return; }
      if(m.sys==="bye"){ left(); return; }
      onMessage(m.msg); };
    ping();
    const bye = () => ch.postMessage({sys:"bye", from:me});
    window.addEventListener("pagehide", bye);
    return { send: msg => !closed && ch.postMessage({from:me, msg}),
             close: () => { if(closed) return; bye(); closed=true; window.removeEventListener("pagehide", bye); ch.close(); },
             friendHere: () => here };
  }

  const s = await client();
  const ch = s.channel("animal-draft-"+code, {config:{broadcast:{self:false}, presence:{key:me}}});
  ch.on("broadcast", {event:"m"}, ({payload}) => { if(!closed) onMessage(payload); });
  ch.on("presence", {event:"sync"}, () => { const st=ch.presenceState(); st[friend] ? joined() : left(); });
  await new Promise((res, rej) => ch.subscribe(status => {
    if(status==="SUBSCRIBED"){ ch.track({role:me}); res(); }
    else if(status==="CHANNEL_ERROR" || status==="TIMED_OUT") rej(new Error(status));
  }));
  return { send: msg => !closed && ch.send({type:"broadcast", event:"m", payload:msg}),
           close: () => { if(closed) return; closed=true; ch.untrack(); s.removeChannel(ch); },
           debugAway: ms => { ch.untrack(); setTimeout(()=>!closed && ch.track({role:me}), ms); },   // tests: look disconnected for a while
           friendHere: () => here };
}
