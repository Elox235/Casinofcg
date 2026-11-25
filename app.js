// This client works on GitHub Pages without a backend (local demo mode).
// When hosted with server.js, Socket.IO automatically enables multiplayer.
const $ = id => document.getElementById(id);
const redNums = new Set([1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36]);
const fmt = n => Number(n).toLocaleString("de-DE");
let socket = null, myId = "local", currentRoom = "LOBBY";
let balance = 1000, bets = [], selectedBet = null, spinning = false;
let localPlayerName = localStorage.getItem("noirName") || "Du";

function showGame(which) {
  document.querySelectorAll(".play-section").forEach(el => el.classList.add("hidden"));
  if (which === "roulette" || which === "slots") {
    $(which).classList.remove("hidden");
    requestAnimationFrame(() => $(which).scrollIntoView({behavior:"smooth", block:"start"}));
  } else {
    $("games").scrollIntoView({behavior:"smooth", block:"start"});
  }
}
window.showGame = showGame;

function updateBalance() {
  $("balanceTop").textContent = fmt(balance);
}
function renderLocal() {
  $("playerCount").textContent = "1";
  $("playersList").innerHTML = `<div class="player-row"><span>${escapeHtml(localPlayerName)}</span><b>${fmt(balance)} ✦</b></div>`;
  $("myBets").innerHTML = bets.length ? bets.map(b=>`<div class="bet-row"><span>${b.type==="number"?"Zahl "+b.value:b.type.toUpperCase()}</span><b>${fmt(b.amount)} ✦</b></div>`).join("") : "Noch keine Einsätze";
  $("spinBtn").disabled = spinning || !bets.length;
  updateBalance();
}
function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
}
function chooseBet(type,value=null) {
  if(spinning)return;
  selectedBet={type,value:value===null?null:Number(value)};
  $("betHint").textContent=type==="number"?`Ausgewählt: Zahl ${value}`:`Ausgewählt: ${type.toUpperCase()}`;
  document.querySelectorAll(".bet-cell").forEach(b=>b.style.outline="");
  const selector=type==="number"?`.bet-cell[data-type="number"][data-value="${value}"]`:`.bet-cell[data-type="${type}"]`;
  document.querySelector(selector)?.style.setProperty("outline","2px solid #f1d7a0");
}
function addLocalBet(type,value,amount) {
  if(spinning || !Number.isFinite(amount) || amount<1 || amount>balance)return;
  balance-=amount; bets.push({type,value,amount});
  $("notice").textContent=`Einsatz platziert: ${amount} Demo-Chips.`;
  renderLocal();
}
function placeBet(type,value) {
  const amount=Math.floor(Number($("betAmount").value));
  if(socket && socket.connected) socket.emit("placeBet",{type,value,amount});
  else addLocalBet(type,value,amount);
}
function showResult(r) {
  $("resultNumber").textContent=r.number;
  $("resultNumber").style.color=r.color==="red"?"#ff6472":r.color==="green"?"#62d7a6":"white";
  $("resultText").textContent=`${r.number} · ${r.color.toUpperCase()}`;
}
function spinLocal() {
  if(spinning || !bets.length)return;
  spinning=true;renderLocal();$("notice").textContent="Die Kugel rollt …";
  $("resultText").textContent="Die Kugel rollt …";
  setTimeout(()=>{
    const n=Math.floor(Math.random()*37), color=n===0?"green":redNums.has(n)?"red":"black";
    let won=0;
    bets.forEach(b=>{
      const hit=b.type==="red"?color==="red":b.type==="black"?color==="black":
        b.type==="even"?n!==0&&n%2===0:b.type==="odd"?n%2===1:n===b.value;
      if(hit)won+=b.amount*(b.type==="number"?36:2);
    });
    balance+=won;bets=[];spinning=false;showResult({number:n,color});
    $("notice").textContent=won?`Gewonnen: ${fmt(won)} Demo-Chips!`:`Diesmal kein Gewinn.`;
    renderLocal();
  },1800);
}
function buildBoard() {
  const grid=$("numberGrid");
  for(let n=1;n<=36;n++){
    const b=document.createElement("button");
    b.className="bet-cell "+(redNums.has(n)?"red":"black");
    b.textContent=n;b.dataset.type="number";b.dataset.value=n;grid.appendChild(b);
  }
  $("roulette").querySelector(".bet-board").addEventListener("click",e=>{
    const b=e.target.closest(".bet-cell");if(!b)return;
    const type=b.dataset.type,value=b.dataset.value;
    chooseBet(type,value);
    placeBet(type,type==="number"?Number(value):null);
  });
}
$("spinBtn").addEventListener("click",()=>{
  if(socket && socket.connected) socket.emit("spin"); else spinLocal();
});
$("joinBtn").addEventListener("click",()=>{
  if(socket && socket.connected){
    const room=$("roomInput").value.trim().toUpperCase()||"LOBBY";
    socket.emit("joinRoom",{room,name:localPlayerName});
  } else {
    currentRoom=$("roomInput").value.trim().toUpperCase()||"LOBBY";
    $("roomLabel").textContent=currentRoom;
    $("notice").textContent="GitHub-Pages-Demo: Tisch-Code wird lokal angezeigt. Für echtes Multiplayer bitte den Node-Server hosten.";
  }
});

buildBoard();
renderLocal();
$("modeLabel").textContent="LOKALER DEMO-TISCH";
$("notice").textContent="GitHub-Pages-Modus aktiv. Roulette und Slots sind spielbar; Multiplayer braucht einen separaten Server.";

// Attach Socket.IO only if the script is available (it is not on GitHub Pages).
if(typeof window.io === "function") {
  socket=window.io();
  socket.on("connect",()=>{
    $("modeLabel").textContent="LIVE MULTIPLAYER";
    $("notice").textContent="Mit Multiplayer-Server verbunden.";
    socket.emit("joinRoom",{room:currentRoom,name:localPlayerName});
  });
  socket.on("joined",d=>{myId=d.id;currentRoom=d.room;$("roomLabel").textContent=d.room;});
  socket.on("roomState",state=>{
    const me=state.players.find(p=>p.id===myId);
    if(me)balance=me.balance;
    $("playerCount").textContent=state.players.length;
    $("playersList").innerHTML=state.players.map(p=>`<div class="player-row"><span>${escapeHtml(p.name)}${p.id===myId?" (Du)":""}</span><b>${fmt(p.balance)} ✦</b></div>`).join("");
    const mine=state.bets[myId]||[];
    $("myBets").innerHTML=mine.length?mine.map(b=>`<div class="bet-row"><span>${b.type==="number"?"Zahl "+b.value:b.type.toUpperCase()}</span><b>${fmt(b.amount)} ✦</b></div>`).join(""):"Noch keine Einsätze";
    $("spinBtn").disabled=state.spinning||!Object.values(state.bets).some(x=>x.length);
    $("spinBtn").textContent=state.spinning?"DREHT …":"Runde starten ↗";
    updateBalance();
    if(state.lastResult)showResult(state.lastResult);
  });
  socket.on("spinResult",r=>{showResult(r);$("notice").textContent=`Ergebnis: ${r.number} (${r.color}).`;});
  socket.on("notice",msg=>$("notice").textContent=msg);
}

let slotBalance=1000;
const symbols=["7","✦","♠","♦","🍀"];
$("slotSpin").addEventListener("click",()=>{
  const bet=Math.floor(Number($("slotBet").value));
  if(!Number.isFinite(bet)||bet<1||bet>slotBalance){$("slotMessage").textContent="Ungültiger Einsatz oder zu wenig Demo-Chips.";return;}
  slotBalance-=bet;$("slotSpin").disabled=true;$("slotMessage").textContent="Die Walzen drehen …";
  const reels=[$("reel1"),$("reel2"),$("reel3")];let ticks=0;
  const timer=setInterval(()=>{
    reels.forEach(r=>r.textContent=symbols[Math.floor(Math.random()*symbols.length)]);
    if(++ticks>=12){
      clearInterval(timer);
      const result=Array.from({length:3},()=>symbols[Math.floor(Math.random()*symbols.length)]);
      result.forEach((s,i)=>reels[i].textContent=s);
      let multiplier=0;
      if(result.every(s=>s===result[0]))multiplier=result[0]==="7"?10:result[0]==="✦"?8:3;
      else if(result[0]===result[1]||result[1]===result[2]||result[0]===result[2])multiplier=1.5;
      const win=Math.floor(bet*multiplier);slotBalance+=win;
      $("slotMessage").textContent=win?`Gewonnen: ${fmt(win)} Demo-Chips · Slot-Guthaben: ${fmt(slotBalance)}`:`Leider kein Gewinn · Slot-Guthaben: ${fmt(slotBalance)}`;
      $("slotSpin").disabled=false;
    }
  },100);
});
