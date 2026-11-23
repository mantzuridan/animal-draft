// Cloud save: backs the player's progress (everything in save.js) up to Supabase, and moves it to a new phone with a code.
// Each phone signs in anonymously (no email or password); its progress is one row on the server (supabase/cloud-save.sql).
// The game always plays from the copy on the phone; this file only keeps the server copy up to date.
// Two copies: the newer revision (rev) wins. Progress made offline is sent when the phone is back online.
import * as Save from "./save.js";
import { client, useLocal } from "./net.js";

const META_KEY="animalDraft.cloud";   // {rev, dirty}: last revision the phone has, and whether it changed since
const meta = () => { try{ return JSON.parse(localStorage.getItem(META_KEY))||{rev:0, dirty:true}; }catch(e){ return {rev:0, dirty:true}; } };
const setMeta = m => { try{ localStorage.setItem(META_KEY, JSON.stringify(m)); }catch(e){} };

let status="off";             // "off" | "connecting" | "saved" | "saving" | "offline"
let listeners=[];
export const getStatus = () => status;
export const onStatus = f => { listeners.push(f); };
const setStatus = s => { status=s; listeners.forEach(f=>f(s)); };

let sb=null, uid=null, timer=null, busy=false, changes=0;   // changes: counts changes, to notice ones made while sending

async function signIn(){
  sb = await client();
  const { data:{ session } } = await sb.auth.getSession();
  if(session) { uid=session.user.id; return; }
  const { data, error } = await sb.auth.signInAnonymously();
  if(error) throw error;
  uid=data.user.id;
}

// Sends the phone's progress if it changed. The server keeps it only if it's newer.
async function push(){
  if(!uid || busy) return;
  const m=meta(), seen=changes; if(!m.dirty) { setStatus("saved"); return; }
  busy=true; setStatus("saving");
  try{
    const rev=m.rev+1;
    const { data, error } = await sb.rpc("save_progress", {p_data:Save.exportAll(), p_rev:rev});
    if(error) throw error;
    // Saved (data===rev), or the server already had a newer copy (pull() sorts that out next time)
    if(data===rev) setMeta({rev, dirty:changes!==seen});   // changed again while sending -> still dirty
    setStatus(meta().dirty ? "saving" : "saved");
    if(meta().dirty) schedule(1000);
  }catch(e){ setStatus("offline"); schedule(30000); }
  finally{ busy=false; }
}
const schedule = ms => { clearTimeout(timer); timer=setTimeout(push, ms); };

// Takes the server's copy if it's newer than the phone's. Returns true if the phone's progress was replaced.
async function pull(){
  const { data, error } = await sb.from("saves").select("data, rev").eq("user_id", uid).maybeSingle();
  if(error) throw error;
  if(data && data.rev > meta().rev){ Save.importAll(data.data); setMeta({rev:data.rev, dirty:false}); return true; }
  return false;
}

// Starts the backup. onReplaced(): the progress on this phone was replaced by a newer copy (redraw the screens).
export async function start(onReplaced){
  if(useLocal()) return;
  Save.onChange(()=>{ changes++; const m=meta(); if(!m.dirty) setMeta({...m, dirty:true}); if(uid) schedule(3000); });
  setStatus("connecting");
  try{
    await signIn();
    if(await pull()) onReplaced && onReplaced();
    await push();
  }catch(e){ setStatus("offline"); setTimeout(()=>start(onReplaced), 60000); return; }
  // Send right away when the app goes to the background, and retry when back online
  document.addEventListener("visibilitychange", ()=>{ if(document.visibilityState==="hidden") push(); });
  window.addEventListener("online", ()=>push());
}

// Old phone: a 6-letter code that's valid for 15 minutes
export async function makeTransferCode(){
  if(!uid) throw new Error("offline");
  await push();
  const { data, error } = await sb.rpc("make_transfer_code");
  if(error) throw error;
  return data;
}
// New phone: replaces this phone's progress with the progress behind the code
export async function useTransferCode(code){
  if(!uid) throw new Error("offline");
  const { data, error } = await sb.rpc("claim_transfer", {p_code:code.toUpperCase().replace(/[^A-Z0-9]/g,"")});
  if(error) throw error;
  Save.importAll(data.data); setMeta({rev:data.rev, dirty:false}); setStatus("saved");
}
