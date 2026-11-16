// Friend games: create or join a room by code, start the game on both phones, rematches, a friend leaving.
// The game itself runs in game.js on both phones from the same seed; this file only sets it up.
import * as E from "./engine.js";
import * as Save from "./save.js";
import * as Net from "./net.js";
import * as Game from "./game.js";
import { $, toast, openSheet, closeSheet, goHome, onGoHome, onCloseSheet } from "./ui.js";

let room=null, role=null, code="", playing=false, again={me:false, friend:false}, helloT=null, joinT=null;

// The skin each of my animals wears, so the friend's phone shows them the same way
function mySkins(){ const sk=Save.loadSkins(), out={}; for(const a of E.ALL_ANIMALS){ const p=Save.equipped(sk,a.id); if(p!=="base") out[a.id]=p; } return out; }

function leave(){
  clearInterval(helloT); clearTimeout(joinT); helloT=joinT=null;
  if(room){ room.close(); room=null; }
  playing=false; again={me:false, friend:false};
}
onGoHome(leave);
// Closing the lobby or waiting sheet (Cancel, tapping outside, phone back button) leaves the room
onCloseSheet(()=>{ if(room && !playing) leave(); });

function start(seed, friendSkins){
  clearInterval(helloT); clearTimeout(joinT); helloT=joinT=null;
  playing=true; again={me:false, friend:false}; closeSheet();
  Game.newGame({seed, flip:role==="guest", friendSkins, send:m=>room && room.send(m)});
}
// Host: a new seed for this game, sent to the guest together with the host's skins
function hostStart(friendSkins){
  const seed=Math.floor(Math.random()*2**31);
  room.send({t:"start", seed, skins:mySkins()}); start(seed, friendSkins);
}

let friendSkinsCache={};
function onMessage(m){
  if(m.t==="hello" && role==="host"){ friendSkinsCache=m.skins||{}; if(!playing) hostStart(friendSkinsCache); return; }
  if(m.t==="start" && role==="guest"){ friendSkinsCache=m.skins||{}; start(m.seed, friendSkinsCache); return; }
  if(m.t==="again"){ again.friend=true; $("againBtn").textContent = again.me ? "Starting…" : "👤 Friend wants a rematch!"; tryRematch(); return; }
  Game.friendMessage(m);
}
function onFriendLeft(){
  if(!room) return;
  const inGame = playing && Game.getGame();
  leave();
  if(inGame){ openSheet(`<div class="aname">👤 Your friend left</div><div class="muted">The game ended. Nothing was counted.</div><button class="btn green" id="sheetGo">Home</button>`);
    $("sheetGo").onclick=goHome; }
  else { $("againBtn").disabled=true; $("againBtn").textContent="Your friend left"; }
}

/* ---------- Lobby ---------- */
function openLobby(){
  openSheet(`<div class="aname">👥 Play a friend</div><div class="muted">Both of you need this game open on your phones.</div>
    <button class="btn green" id="createBtn">Create a game</button>
    <div class="muted small-note">— or join your friend's game —</div>
    <div class="join-row"><input id="codeIn" maxlength="4" placeholder="CODE" autocomplete="off" autocapitalize="characters" spellcheck="false"><button class="btn" id="joinBtn" disabled>Join</button></div>
    <button class="btn ghost" id="sheetNo">Close</button>`);
  $("sheetNo").onclick=closeSheet;
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
async function create(){
  leave(); role="host"; code=Net.newCode();
  waitingSheet(`<div class="aname">👥 Your game code</div><div class="room-code">${code}</div><div class="muted">Send this code to your friend. The game starts as soon as they join.</div><div class="hint">⏳ Waiting for your friend…</div>`);
  try{ room=await Net.openRoom(code, "host", {onMessage, onFriendLeft}); }
  catch(e){ leave(); openSheet(`<div class="aname">Couldn't connect</div><div class="muted">Check your internet and try again.</div><button class="btn ghost" id="sheetNo">Close</button>`); $("sheetNo").onclick=closeSheet; }
}
async function join(c){
  leave(); role="guest"; code=c;
  waitingSheet(`<div class="aname">👥 Joining ${code}…</div><div class="hint">⏳ Connecting to your friend's game</div>`);
  try{ room=await Net.openRoom(code, "guest", {onMessage, onFriendLeft}); }
  catch(e){ leave(); openSheet(`<div class="aname">Couldn't connect</div><div class="muted">Check your internet and try again.</div><button class="btn ghost" id="sheetNo">Close</button>`); $("sheetNo").onclick=closeSheet; return; }
  // Say hello until the host answers (a message sent before the host listens is lost)
  const hello=()=>room && room.send({t:"hello", skins:mySkins()});
  hello(); helloT=setInterval(hello, 1000);
  joinT=setTimeout(()=>{ if(playing) return; leave();
    openSheet(`<div class="aname">No game with code ${code}</div><div class="muted">Check the code with your friend, and that their game is still waiting.</div><button class="btn ghost" id="sheetNo">Close</button>`);
    $("sheetNo").onclick=openLobby; }, 10000);
}

/* ---------- Rematch: both press "Play again"; the host then starts a new game ---------- */
function tryRematch(){ if(again.me && again.friend && role==="host" && room) hostStart(friendSkinsCache); }
export function playAgain(){
  if(!room){ goHome(); return; }
  again.me=true; room.send({t:"again"});
  $("againBtn").disabled=true; $("againBtn").textContent = again.friend ? "Starting…" : "Waiting for your friend…";
  tryRematch();
}

$("friendBtn").onclick=openLobby;
