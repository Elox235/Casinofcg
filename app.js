const socket = io();
let myId = null, currentRoom = "LOBBY", selectedBet = null, roomPlayers = [], roomBets = {};
const $ = id => document.getElementById(id);
const redNums = new Set([1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36]);
const fmt = n => Number(n).toLocaleString("de-DE");
function showGame(which) {
  document.querySelectorAll(".play-section").forEach(x => x.classList.add("hidden"));
  if (which === "roulette" || which === "slots") $(which).classList.remove("hidden");
  if (which === "games") document.getElementById("games").scrollIntoView({behavior:"smooth"});
  else $(which).scrollIntoView({behavior:"smooth"});
}
window.showGame = showGame;
function buildBoard() {
  const grid = $("numberGrid");
  for (let n=1;n<=36;n++) {
    const b=document.createElement("button");
    b.className="bet-cell "+(redNums.has(n)?"red":"black");
    b.textContent=n; b.dataset.type="number"; b.dataset.value=n;
    b.addEventListener("click",()=>chooseBet("number",n));
    grid.appendChild(b);
  }
  document.querySelectorAll("[data-type]:not(#numberGrid [data-type])").forEach(b=>b.addEventListener("click",()=>chooseBet(b.dataset.type,b.dataset.value)));
}
function chooseBet(type,value=null) {
  selectedBet={type,value};
  $("betHint").textContent=type==="number"?`Einsatz auf Zahl ${value}`:`Einsatz auf ${type.toUpperCase()}`;
  document.querySelectorAll(".bet-cell").forEach(b=>b.style.outline="");
  const selector=type==="number"?`.bet-cell[data-type="number"][data-value="${value}"]`:`.bet-cell[data-type="${type}"]`;
  document.querySelector(selector)?.style.setProperty("outline","2px solid #f1d7a0");
}
function joinRoom() {
  const name = localStorage.getItem("noirName") || prompt("Dein Spielername?") || "Player";
  localStorage.setItem("noirName",name.slice(0,16));
  const room=$("roomInput").value.trim().toUpperCase() || "LOBBY";
  socket.emit("joinRoom",{room,name:name.slice(0,16)});
}
function updateBalance(players) {
  const me=players.find(p=>p.id===myId);
  if(me) $("balanceTop").textContent=fmt(me.balance);
}
function renderRoom(state) {
  roomPlayers=state.players; roomBets=state.bets; updateBalance(state.players);
  $("playerCount").textContent=state.players.length;
  $("playersList").innerHTML=state.players.map(p=>`<div class="player-row"><span>${escapeHtml(p.name)}${p.id===myId?" (Du)":""}</span><b>${fmt(p.balance)} ✦</b></div>`).join("") || "Noch niemand am Tisch";
  const mine=state.bets[myId]||[];
  $("myBets").innerHTML=mine.length?mine.map(b=>`<div class="bet-row"><span>${b.type==="number"?"Zahl "+b.value:b.type.toUpperCase()}</span><b>${fmt(b.amount)} ✦</b></div>`).join(""):"Noch keine Einsätze";
  $("spinBtn").disabled=state.spinning || !Object.values(state.bets).some(x=>x.length);
  $("spinBtn").textContent=state.spinning?"DREHT …":"Runde starten ↗";
  if(state.lastResult) showResult(state.lastResult);
}
function showResult(r) {
  $("resultNumber").textContent=r.number;
  $("resultNumber").style.color=r.color==="red"?"#ff6472":r.color==="green"?"#62d7a6":"white";
  $("resultText").textContent=`${r.number} · ${r.color.toUpperCase()}`;
}
function escapeHtml(s){return String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));}
socket.on("connect",()=>{$("notice").textContent="Verbunden. Trete einem Tisch bei.";joinRoom();});
socket.on("joined",d=>{myId=d.id;currentRoom=d.room;$("roomLabel").textContent=d.room;$("notice").textContent=`Du bist Tisch ${d.room} beigetreten.`;});
socket.on("roomState",renderRoom);
socket.on("notice",msg=>$("notice").textContent=msg);
socket.on("spinResult",r=>{showResult(r);$("notice").textContent=`Ergebnis: ${r.number} (${r.color}). Die nächste Runde kann beginnen.`;});
$("joinBtn").addEventListener("click",joinRoom);
$("spinBtn").addEventListener("click",()=>socket.emit("spin"));
$("betAmount").addEventListener("change",e=>e.target.value=Math.max(1,Math.floor(Number(e.target.value)||1)));
document.addEventListener("click",e=>{
  if(e.target.closest("#roulette .bet-cell") && selectedBet) {
    const type=e.target.closest(".bet-cell").dataset.type;
    const value=e.target.closest(".bet-cell").dataset.value;
    if(type) selectedBet={type,value};
  }
});
document.querySelector("#roulette .bet-board").addEventListener("click",e=>{
  const b=e.target.closest(".bet-cell"); if(!b)return;
  selectedBet={type:b.dataset.type,value:b.dataset.value};
  const amount=Math.floor(Number($("betAmount").value));
  if(amount>0) socket.emit("placeBet",{...selectedBet,amount});
});
buildBoard();

// Slots: local demo wallet, separate from the multiplayer room balance.
let slotBalance=1000;
const symbols=["7","✦","♠","♦","🍀"];
$("slotSpin").addEventListener("click",()=>{
  const bet=Math.floor(Number($("slotBet").value));
  if(!Number.isFinite(bet)||bet<1||bet>slotBalance){$("slotMessage").textContent="Ungültiger Einsatz oder zu wenig Demo-Chips.";return;}
  slotBalance-=bet;$("slotSpin").disabled=true;$("slotMessage").textContent="Die Walzen drehen …";
  const reels=[$("reel1"),$("reel2"),$("reel3")];
  let ticks=0;
  const timer=setInterval(()=>{
    reels.forEach(r=>r.textContent=symbols[Math.floor(Math.random()*symbols.length)]);
    if(++ticks>=12){
      clearInterval(timer);
      const result=Array.from({length:3},()=>symbols[Math.floor(Math.random()*symbols.length)]);
      result.forEach((s,i)=>reels[i].textContent=s);
      let multiplier=0;
      if(result.every(s=>s===result[0])) multiplier=result[0]==="7"?10:result[0]==="✦"?8:3;
      else if(result[0]===result[1]||result[1]===result[2]||result[0]===result[2]) multiplier=1.5;
      const win=Math.floor(bet*multiplier);slotBalance+=win;
      $("slotMessage").textContent=win?`Gewonnen: ${fmt(win)} Demo-Chips · Slot-Guthaben: ${fmt(slotBalance)}`:`Leider kein Gewinn · Slot-Guthaben: ${fmt(slotBalance)}`;
      $("slotSpin").disabled=false;
    }
  },100);
});
