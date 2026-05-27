const http = require("http");
const WebSocket = require("ws");

const server = http.createServer((req, res) => {
  res.writeHead(200, { "Content-Type": "text/plain" });
  res.end("PokerChain is live");
});

const wss = new WebSocket.Server({ server });

let state = {
  players: [],
  active: 0,
  pot: 0,
  street: "Preflop",
  deck: [],
  hands: {}
};

function shuffle() {
  const s = ["♠","♥","♦","♣"];
  const r = ["A","K","Q","J","10","9","8","7","6","5","4","3","2"];
  let d = [];
  for (let a of s) for (let b of r) d.push(b + a);
  for (let i = d.length - 1; i > 0; i--) {
    let j = Math.floor(Math.random() * i);
    [d[i], d[j]] = [d[j], d[i]];
  }
  return d;
}

function broadcast() {
  const msg = JSON.stringify({ type: "state", state });
  wss.clients.forEach(c => c.readyState === 1 && c.send(msg));
}

function startHand() {
  if (state.players.length < 2) return;

  state.deck = shuffle();
  state.pot = 0;
  state.street = "Preflop";
  state.active = 0;

  state.players.forEach(p => {
    state.hands[p.id] = [state.deck.pop(), state.deck.pop()];
  });

  broadcast();
}

function next() {
  if (state.players.length === 0) return;

  state.active = (state.active + 1) % state.players.length;

  if (state.active === 0) {
    const order = ["Preflop","Flop","Turn","River","Showdown"];
    let i = order.indexOf(state.street);
    state.street = order[i + 1] || "Showdown";
  }
}

wss.on("connection", (ws) => {
  ws.id = Math.random().toString(36).slice(2, 7);

  state.players.push({ id: ws.id });

  ws.send(JSON.stringify({ type: "id", id: ws.id }));

  broadcast();

  ws.on("message", (msg) => {
    const tx = JSON.parse(msg);
    const idx = state.players.findIndex(p => p.id === ws.id);

    if (tx.type === "action" && idx === state.active) {
      if (tx.action === "fold") next();
      if (tx.action === "call") { state.pot += 10; next(); }
      if (tx.action === "bet") { state.pot += 20; next(); }
    }

    if (tx.type === "start") startHand();

    broadcast();
  });

  ws.on("close", () => {
    state.players = state.players.filter(p => p.id !== ws.id);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log("PokerChain running on", PORT));
