// Skins and stars: the packs, their prices and how many stars a game or a medal is worth.
// No storage, no DOM (can move to a server later). Saved wallet/skins live in save.js.
import { ACHIEVEMENTS, tiersDone } from "./achievements.js";

// Only ever ADD packs at the end; saved skins refer to pack ids.
export const SKIN_PACKS = [
  { id:"base",  name:"Athletes", icon:"🏃", price:0,   packPrice:0,    dir:"img/animals" },
  { id:"baby",  name:"Babies",   icon:"🍼", price:250, packPrice:3000, dir:"img/skins/baby" },
  { id:"pixel", name:"Pixel",    icon:"👾", price:250, packPrice:3000, dir:"img/skins/pixel", pixel:true },
  { id:"clay",  name:"Clay",     icon:"🧱", price:250, packPrice:3000, dir:"img/skins/clay" },
  { id:"origami", name:"Origami", icon:"🦢", price:250, packPrice:3000, dir:"img/skins/origami" },
  { id:"business", name:"Business", icon:"💼", price:250, packPrice:3000, dir:"img/skins/business" },
  { id:"pirate", name:"Pirates", icon:"🏴‍☠️", price:250, packPrice:3000, dir:"img/skins/pirate" },
  // Trophy skin: an animal can only buy it after winning `needSports` different sports (no whole-pack purchase)
  { id:"gold",  name:"Gold",     icon:"🏆", price:250, packPrice:0,    dir:"img/skins/gold", needSports:5 },
];
export const packById = id => SKIN_PACKS.find(p=>p.id===id) || SKIN_PACKS[0];

// How many different sports an animal has won (from its album entry)
export const sportsWon = entry => entry ? Object.values(entry.sports||{}).filter(s=>s.won>0).length : 0;
// Can this animal buy a skin from this pack yet? Most packs: always. Gold: after enough different sports won.
export const canBuy = (pack, entry) => !pack.needSports || sportsWon(entry) >= pack.needSports;
// Progress text for a locked skin, e.g. "3 / 5 sports"
export const lockText = (pack, entry) => `${Math.min(sportsWon(entry),pack.needSports)} / ${pack.needSports} sports`;

// Picture file of an animal in a pack: <dir>/<name without spaces>.webp (a few names are shortened)
const FILE = {"grizzlybear":"grizzly","komododragon":"komodo"};
export const fileKey = a => { const k=a.name.toLowerCase().replace(/ /g,""); return FILE[k]||k; };
export const skinSrc = (a, packId) => `${packById(packId).dir}/${fileKey(a)}.webp`;

// Price of the whole pack for someone who already owns `owned` of its `total` skins.
// Up to 10 owned: the fixed pack price. Above that: what the missing skins cost one by one, but never more than the pack price.
export function packPriceFor(pack, owned, total){
  const missing = total - owned;
  if(missing<=0) return 0;
  return owned<=10 ? pack.packPrice : Math.min(pack.packPrice, missing*pack.price);
}

// Stars for one counted game: 1 per sport won, +5 for winning the game, +5 more for a 5-0
export function gameStars(res){
  const sports=res.rows.filter(r=>r.winner==="you").length;
  return sports + (res.won?5:0) + (res.won && sports===5 ? 5 : 0);
}

// Stars for medals: bronze 5, silver 10, gold 25, diamond 75. Total for every medal earned so far.
export const MEDAL_STARS = [5,10,25,75];
export function medalStarsTotal(facts){
  let s=0; for(const a of ACHIEVEMENTS){ const n=tiersDone(a,facts); for(let t=0;t<n;t++) s+=MEDAL_STARS[t]; }
  return s;
}
