// Skins for stars: the shop (packs and single animals) and the wardrobe (which skin each animal wears).
import * as E from "./engine.js";
import * as Save from "./save.js";
import * as Sk from "./skins.js";
import { $, pic, toast, show, renderStars, openSheet, closeSheet, goHome } from "./ui.js";
import { showAlbumAnimal, renderAnimalSkins } from "./collection.js";

const ALL_IDS = () => E.ALL_ANIMALS.map(a=>a.id);
const SELL = () => Sk.SKIN_PACKS.filter(p=>p.price>0);

/* ---------- Shop ---------- */
let shopTab="packs", shopBack=null;   // shopBack: where the shop's ✕ returns to
function openShop(back){ shopBack=back||null; renderStars(); renderShop(); show("shop"); }
function renderShop(){
  document.querySelectorAll("#shopTabs button").forEach(b=>b.classList.toggle("on", b.dataset.tab===shopTab));
  const box=$("shopBody"), sk=Save.loadSkins(), total=E.ALL_ANIMALS.length;
  if(shopTab==="packs"){
    box.innerHTML=SELL().map(p=>{
      const n=Save.ownedCount(sk,p.id), price=Sk.packPriceFor(p,n,total);
      const prev=["Lion","Elephant","Panda","Dolphin"].map(nm=>pic(E.ALL_ANIMALS.find(a=>a.name===nm),p.id)).join("");
      return `<div class="pack card"><div class="pack-top"><b>${p.icon} ${p.name}</b><span class="muted">${n} / ${total} owned</span></div>
        <div class="pack-prev">${prev}</div>
        ${p.needSports ? `<div class="muted small-note">Each animal unlocks it by winning ${p.needSports} different sports.</div>` : ""}
        <div class="pack-btns${p.needSports?" one":""}"><button class="btn ghost small" data-browse="${p.id}">Browse · ${p.price} ⭐ each</button>
        ${p.needSports ? "" : price ? `<button class="btn small" data-buypack="${p.id}">Whole pack · ${price.toLocaleString("en-US")} ⭐</button>` : `<button class="btn small" disabled>✓ Complete</button>`}</div></div>`;
    }).join("");
    box.querySelectorAll("[data-browse]").forEach(b=>b.onclick=()=>renderShopPack(b.dataset.browse));
    box.querySelectorAll("[data-buypack]").forEach(b=>b.onclick=()=>askBuyPack(Sk.packById(b.dataset.buypack)));
  } else {
    box.innerHTML=`<div class="album-grid">`+E.ALL_ANIMALS.map(a=>{
      const n=SELL().filter(p=>Save.owns(sk,p.id,a.id)).length;
      return `<div class="acard" data-id="${a.id}"><div class="e">${pic(a,"base")}</div><div class="n">${a.name}</div><div class="medals">${n}/${SELL().length}</div></div>`;
    }).join("")+`</div>`;
    box.querySelectorAll("[data-id]").forEach(d=>d.onclick=()=>renderShopAnimal(E.ALL_ANIMALS[+d.dataset.id]));
  }
}
// A shop card's state for one skin: owned, locked (trophy skin not earned yet) or for sale
function skinCard(sk, alb, a, p){
  if(Save.owns(sk,p.id,a.id)) return {cls:" owned", tag:"✓"};
  if(!Sk.canBuy(p, alb[a.id])) return {cls:" skin-locked", tag:`🔒 ${Sk.sportsWon(alb[a.id])}/${p.needSports}`};
  return {cls:"", tag:p.price+"⭐"};
}
// One pack: every animal in that skin
function renderShopPack(packId){
  const p=Sk.packById(packId), sk=Save.loadSkins(), alb=Save.loadAlbum();
  $("shopBody").innerHTML=`<button class="linkbtn" id="shopUp">‹ All packs</button><div class="hint">${p.icon} ${p.name} · ${p.price} ⭐ each${p.needSports?` · unlocks after ${p.needSports} different sports won`:""}</div><div class="album-grid">`+
    E.ALL_ANIMALS.map(a=>{ const c=skinCard(sk,alb,a,p);
      return `<div class="acard${c.cls}" data-id="${a.id}"><div class="e">${pic(a,p.id)}</div><div class="n">${a.name}</div><div class="medals">${c.tag}</div></div>`; }).join("")+`</div>`;
  $("shopUp").onclick=renderShop;
  $("shopBody").querySelectorAll("[data-id]").forEach(d=>d.onclick=()=>askBuySkin(E.ALL_ANIMALS[+d.dataset.id], p, ()=>renderShopPack(packId)));
}
// One animal: every skin it can wear
function renderShopAnimal(a){
  const sk=Save.loadSkins(), alb=Save.loadAlbum();
  $("shopBody").innerHTML=`<button class="linkbtn" id="shopUp">‹ All animals</button><div class="hint">${a.name}</div><div class="album-grid">`+
    Sk.SKIN_PACKS.map(p=>{ const c=skinCard(sk,alb,a,p);
      return `<div class="acard${c.cls}" data-pack="${p.id}"><div class="e">${pic(a,p.id)}</div><div class="n">${p.name}</div><div class="medals">${c.tag}</div></div>`; }).join("")+`</div>`;
  $("shopUp").onclick=renderShop;
  $("shopBody").querySelectorAll("[data-pack]").forEach(d=>d.onclick=()=>askBuySkin(a, Sk.packById(d.dataset.pack), ()=>renderShopAnimal(a)));
}
// The shop opened on one animal's skins; ✕ goes back to `back` (default: that animal's album page)
export function openShopAnimal(a, back="animal:"+a.id){ shopTab="animals"; openShop(back); renderShopAnimal(a); }
// Preview a skin; buy it, or put it on if it's already owned
function askBuySkin(a, p, refresh){
  const sk=Save.loadSkins(), have=Save.owns(sk,p.id,a.id), stars=Save.loadWallet().stars, on=Save.equipped(sk,a.id)===p.id;
  const entry=Save.loadAlbum()[a.id], locked=!have && !Sk.canBuy(p, entry);
  openSheet(`<div class="sheet-pic">${pic(a,p.id)}</div><div class="aname">${a.name}</div><div class="muted">${p.icon} ${p.name} skin</div>`+
    (locked ? `<div class="lock-box">🔒 Win <b>${p.needSports} different sports</b> with ${a.name} to unlock this skin.<div class="abar"><i style="width:${100*Math.min(Sk.sportsWon(entry),p.needSports)/p.needSports}%"></i></div><div class="anum">${Sk.lockText(p,entry)} won</div></div>`
    : have ? `<button class="btn green" id="sheetGo" ${on?"disabled":""}>${on?"✓ In use":"Use this skin"}</button>`
          : `<button class="btn green" id="sheetGo" ${stars<p.price?"disabled":""}>Buy · ${p.price} ⭐</button>`+
            (stars<p.price ? `<div class="hint">You need ${p.price-stars} more ⭐</div>` : ""))+
    `<button class="btn ghost" id="sheetNo">Close</button>`);
  $("sheetNo").onclick=closeSheet;
  if(locked) return;
  $("sheetGo").onclick=()=>{
    if(have){ Save.equip(a.id,p.id); toast(`${a.name} is now in ${p.name}!`); closeSheet(); refresh(); return; }
    if(!Save.buySkins(p.id,[a.id],p.price)) return;
    renderStars(); refresh(); askBuySkin(a,p,refresh); toast(`🎉 ${p.name} ${a.name} is yours!`);
  };
}
function askBuyPack(p){
  const total=E.ALL_ANIMALS.length, sk=Save.loadSkins(), n=Save.ownedCount(sk,p.id), price=Sk.packPriceFor(p,n,total), stars=Save.loadWallet().stars;
  const prev=E.ALL_ANIMALS.slice(0,8).map(a=>pic(a,p.id)).join("");
  openSheet(`<div class="pack-prev big">${prev}</div><div class="aname">${p.icon} ${p.name} pack</div>`+
    `<div class="muted">All ${total-n} skins you don't have yet${n>10?" (priced one by one, since you already own "+n+")":""}</div>`+
    `<button class="btn green" id="sheetGo" ${stars<price?"disabled":""}>Buy pack · ${price.toLocaleString("en-US")} ⭐</button>`+
    (stars<price ? `<div class="hint">You need ${(price-stars).toLocaleString("en-US")} more ⭐</div>` : "")+
    `<button class="btn ghost" id="sheetNo">Close</button>`);
  $("sheetNo").onclick=closeSheet;
  $("sheetGo").onclick=()=>{
    const missing=E.ALL_ANIMALS.filter(a=>!Save.owns(sk,p.id,a.id)).map(a=>a.id);
    if(!Save.buySkins(p.id,missing,price)) return;
    renderStars(); renderShop();
    openSheet(`<div class="aname">🎉 ${p.name} pack is yours!</div><div class="muted">Put it on every animal now? You can still change single animals later.</div>`+
      `<button class="btn green" id="sheetGo">Apply to all animals</button><button class="btn ghost" id="sheetNo">Not now</button>`);
    $("sheetNo").onclick=closeSheet;
    $("sheetGo").onclick=()=>{ Save.equipAll(p.id, ALL_IDS()); closeSheet(); toast(`All animals are now ${p.name}!`); };
  };
}
document.querySelectorAll("#shopTabs button").forEach(b=>b.onclick=()=>{ shopTab=b.dataset.tab; renderShop(); });
$("shopBtn").onclick=()=>openShop();
$("shopClose").onclick=()=>{ const b=shopBack; shopBack=null;
  if(b && b.startsWith("animal:")) return showAlbumAnimal(E.ALL_ANIMALS[+b.split(":")[1]]);
  if(b==="wardrobe") return openWardrobe();
  goHome(); };

/* ---------- Wardrobe: choose which skin each animal wears ---------- */
function openWardrobe(){ renderWardrobe(); show("wardrobe"); }
function renderWardrobe(){
  const sk=Save.loadSkins(), total=E.ALL_ANIMALS.length;
  const packs=Sk.SKIN_PACKS.filter(p=>p.id==="base" || Save.ownedCount(sk,p.id)>0);
  $("wardAll").innerHTML=packs.map(p=>`<button type="button" class="btn ghost small" data-all="${p.id}">${p.icon} ${p.name}${p.id==="base"?"":` (${Save.ownedCount(sk,p.id)}/${total})`}</button>`).join("");
  $("wardAll").querySelectorAll("[data-all]").forEach(b=>b.onclick=()=>{ Save.equipAll(b.dataset.all, ALL_IDS()); renderWardrobe(); toast(`${Sk.packById(b.dataset.all).name} applied to every animal that has it`); });
  $("wardGrid").innerHTML=E.ALL_ANIMALS.map(a=>`<div class="acard" data-id="${a.id}"><div class="e">${pic(a)}</div><div class="n">${a.name}</div></div>`).join("");
  $("wardGrid").querySelectorAll("[data-id]").forEach(d=>d.onclick=()=>{
    const a=E.ALL_ANIMALS[+d.dataset.id];
    openSheet(`<div class="sheet-pic">${pic(a)}</div><div class="aname">${a.name}</div><div id="sheetSkins"></div><button class="btn ghost" id="sheetNo">Done</button>`);
    const more=()=>{ closeSheet(); openShopAnimal(a, "wardrobe"); };
    const redraw=()=>{ $("sheetCard").querySelector(".sheet-pic").innerHTML=pic(a); renderAnimalSkins(a, $("sheetSkins"), redraw, more); renderWardrobeGridOnly(); };
    renderAnimalSkins(a, $("sheetSkins"), redraw, more);
    $("sheetNo").onclick=closeSheet;
  });
}
function renderWardrobeGridOnly(){ document.querySelectorAll("#wardGrid [data-id]").forEach(d=>{ d.querySelector(".e").innerHTML=pic(E.ALL_ANIMALS[+d.dataset.id]); }); }
$("wardBtn").onclick=openWardrobe;
$("wardShop").onclick=()=>openShop("wardrobe");
