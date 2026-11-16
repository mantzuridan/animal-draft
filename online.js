// Friend games: create or join a room by code, start the game on both phones, rematches, a friend leaving.
// The game itself runs in game.js on both phones from the same seed; this file only sets it up.
import * as E from "./engine.js";
import * as Save from "./save.js";
import * as Net from "./net.js";
import * as Game from "./game.js";
import { $, toast, openSheet, closeSheet, goHome, onGoHome, onCloseSheet } from "./ui.js";

let room=null, role=null, code="", playing=false, again={me:false, friend:false}, helloT=null, joinT=null;
let friend=null;   // {skins, name, pid} of the player on the other phone
// Reliable delivery: every message gets a number; each phone tells the other every 2 seconds how many it has
// ("ack"), and anything missing (a dropped connection, a phone that was in the background) is sent again.
let outbox=[], inN=0, inbuf={}, ackT=null, graceT=null;
const GRACE_MS=20000;   // how long a friend may be disconnected before the game ends
function send(m){ const x={...m, n:outbox.length}; outbox.push(x); if(room && !window.__dropOut) room.send(x); }
function onRaw(m){
  if(!m || typeof m!=="object") return;
  if(m.t==="ack"){ if(room && !window.__dropOut) for(let i=m.n;i<outbox.length;i++) room.send(outbox[i]); return; }
  if(m.t==="hello") return onMessage(m);
  if(typeof m.n!=="number" || m.n<inN) return;   // a copy of something already handled
  inbuf[m.n]=m;
  while(inbuf[inN]){ const x=inbuf[inN]; delete inbuf[inN]; inN++; onMessage(x); }
}

// What the other phone needs to know about me: my name, my id (head-to-head score) and my animals' skins
function me(){
  const sk=Save.loadSkins(), skins={}, p=Save.loadProfile();
  for(const a of E.ALL_ANIMALS){ const s=Save.equipped(sk,a.id); if(s!=="base") skins[a.id]=s; }
  return {skins, name:p.name, pid:p.id};
}
const friendFrom = m => ({skins:m.skins||{}, name:Save.cleanName(m.name)||"Friend", pid:String(m.pid||"unknown").slice(0,40)});

function leave(){
  clearInterval(helloT); clearTimeout(joinT); clearInterval(ackT); clearTimeout(graceT); helloT=joinT=ackT=graceT=null;
  if(room){ send({t:"bye"}); room.close(); room=null; }
  outbox=[]; inN=0; inbuf={};
  playing=false; again={me:false, friend:false};
}
onGoHome(leave);
// Closing the lobby or waiting sheet (Cancel, tapping outside, phone back button) leaves the room
onCloseSheet(()=>{ if(room && !playing) leave(); });

function start(seed){
  clearInterval(helloT); clearTimeout(joinT); helloT=joinT=null;
  playing=true; again={me:false, friend:false}; closeSheet();
  Game.newGame({seed, flip:role==="guest", friendSkins:friend.skins, friendName:friend.name, friendId:friend.pid, send});
}
// Host: a new seed for every game, sent to the guest together with the host's details
function hostStart(){
  const seed=Math.floor(Math.random()*2**31);
  send({t:"start", seed, ...me()}); start(seed);
}

function onMessage(m){
  if(!m || typeof m!=="object") return;
  if(m.t==="bye"){ friendGone(); return; }
  if(m.t==="hello" && role==="host"){ if(!playing){ friend=friendFrom(m); hostStart(); } return; }
  if(m.t==="start" && role==="guest"){ friend=friendFrom(m); start(m.seed); return; }
  if(m.t==="again"){ again.friend=true; $("againBtn").textContent = again.me ? "Starting…" : `${friend.name} wants a rematch!`; tryRematch(); return; }
  Game.friendMessage(m);
}
// The friend's connection dropped (phone locked, app in the background, bad signal): give them time to come back
function onFriendLeft(){
  if(!room || !playing || graceT) return;
  toast(`⚠️ ${friend ? friend.name : "Your friend"} lost connection — waiting for them…`, 4000);
  graceT=setTimeout(friendGone, GRACE_MS);
}
function onFriendJoined(){
  if(graceT){ clearTimeout(graceT); graceT=null; toast(`✅ ${friend ? friend.name : "Your friend"} is back!`); }
}
// The friend quit, or didn't come back in time: end the game (a running game stops, nothing is counted)
function friendGone(){
  if(!room) return;
  const inGame = playing && Game.getGame(), who = friend ? friend.name : "Your friend";
  leave();
  if(inGame){ goHome();
    openSheet(`<div class="aname">👤 ${who} left</div><div class="muted">The game ended. Nothing was counted.</div><button class="btn green" id="sheetGo">OK</button>`);
    $("sheetGo").onclick=closeSheet; }
  else { $("againBtn").disabled=true; $("againBtn").textContent=`${who} left`; }
}
async function openRoomAs(r){
  room=await Net.openRoom(code, r, {onMessage:onRaw, onFriendLeft, onFriendJoined});
  ackT=setInterval(()=>room && !window.__dropOut && room.send({t:"ack", n:inN}), 2000);
}

/* ---------- Username ---------- */
// Asks for a name (first friend game, or "change"); then continues with `next`
function askName(next){
  const cur=Save.loadProfile().name;
  openSheet(`<div class="aname">👤 Your player name</div><div class="muted">Your friends see it when you play them.</div>
    <input class="name-in" id="nameIn" maxlength="${Save.NAME_MAX}" placeholder="Your name" autocomplete="nickname" spellcheck="false" value="${cur}">
    <button class="btn green" id="nameOk" ${cur?"":"disabled"}>Save</button><button class="btn ghost" id="sheetNo">Close</button>`);
  const inp=$("nameIn");
  inp.oninput=()=>{ $("nameOk").disabled=!Save.cleanName(inp.value); };
  const ok=()=>{ if(!Save.cleanName(inp.value)) return; Save.setName(inp.value); next(); };
  inp.onkeydown=e=>{ if(e.key==="Enter") ok(); };
  $("nameOk").onclick=ok; $("sheetNo").onclick=closeSheet;
  setTimeout(()=>inp.focus(), 50);
}

/* ---------- Lobby ---------- */
function openLobby(){
  const p=Save.loadProfile();
  if(!p.name) return askName(openLobby);
  openSheet(`<div class="aname">👥 Play a friend</div><div class="muted">Playing as <b>${p.name}</b> · <button class="linkbtn inline" id="nameEdit">change</button></div>
    <button class="btn green" id="createBtn">Create a game</button>
    <div class="muted small-note">— or join your friend's game —</div>
    <div class="join-row"><input id="codeIn" maxlength="4" placeholder="CODE" autocomplete="off" autocapitalize="characters" spellcheck="false"><button class="btn" id="joinBtn" disabled>Join</button></div>
    <div class="muted small-note">Both of you need this game open on your phones.</div>
    <button class="btn ghost" id="sheetNo">Close</button>`);
  $("sheetNo").onclick=closeSheet;
  $("nameEdit").onclick=()=>askName(openLobby);
  $("createBtn").onclick=create;
  const inp=$("codeIn");
  inp.oninput=()=>{ inp.value=Net.cleanCode(inp.value); $("joinBtn").disabled=inp.value.length!==4; };
  inp.onkeydown=e=>{ if(e.key==="Enter" && inp.value.length===4) join(inp.value); };
  $("joinBtn").onclick=()=>join(inp.value);
}
function waitingSheet(html){
  openSheet(html+`<button class="btn ghost" id="sheetNo">Cancel</button>`);
  $("sheetNo").onclick=()=>{ leave(); closeSheet(); };
}
function failSheet(){
  leave(); openSheet(`<div class="aname">Couldn't connect</div><div class="muted">Check your internet and try again.</div><button class="btn ghost" id="sheetNo">Close</button>`);
  $("sheetNo").onclick=closeSheet;
}
async function create(){
  leave(); role="host"; code=Net.newCode(); friend=null;
  waitingSheet(`<div class="aname">👥 Your game code</div><div class="room-code">${code}</div><div class="muted">Send this code to your friend. The game starts as soon as they join.</div><div class="hint">⏳ Waiting for your friend…</div>`);
  try{ await openRoomAs("host"); } catch(e){ failSheet(); }
}
async function join(c){
  leave(); role="guest"; code=c; friend=null;
  waitingSheet(`<div class="aname">👥 Joining ${code}…</div><div class="hint">⏳ Connecting to your friend's game</div>`);
  try{ await openRoomAs("guest"); } catch(e){ failSheet(); return; }
  // Say hello until the host answers (a message sent before the host listens is lost)
  const hello=()=>room && room.send({t:"hello", ...me()});
  hello(); helloT=setInterval(hello, 1000);
  joinT=setTimeout(()=>{ if(playing) return; leave();
    openSheet(`<div class="aname">No game with code ${code}</div><div class="muted">Check the code with your friend, and that their game is still waiting.</div><button class="btn ghost" id="sheetNo">Close</button>`);
    $("sheetNo").onclick=openLobby; }, 20000);
}

/* ---------- Rematch: both press "Play again"; the host then starts a new game ---------- */
function tryRematch(){ if(again.me && again.friend && role==="host" && room) hostStart(); }
export function playAgain(){
  if(!room){ goHome(); return; }
  again.me=true; send({t:"again"});
  $("againBtn").disabled=true; $("againBtn").textContent = again.friend ? "Starting…" : `Waiting for ${friend.name}…`;
  tryRematch();
}

$("friendBtn").onclick=openLobby;

// Hook for automated tests: the open room (to simulate a dropped connection)
window.__adRoom = () => room;
