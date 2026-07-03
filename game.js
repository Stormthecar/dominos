/* Jamaican Dominoes
 * 4 players, partnership (0+2 vs 1+3), double-six block set, no drawing.
 * Player 0 = You (bottom, human). 1 = West, 2 = Partner (North, AI), 3 = East.
 * Team 0 ("We") = players 0 & 2. Team 1 ("They") = players 1 & 3.
 */
(function () {
  "use strict";

  const TARGET_SCORE = 200;
  const SEAT_ORDER = [0, 1, 2, 3]; // turn order
  const PIP_PATTERNS = {
    0: [],
    1: [4],
    2: [0, 8],
    3: [0, 4, 8],
    4: [0, 2, 6, 8],
    5: [0, 2, 4, 6, 8],
    6: [0, 2, 3, 5, 6, 8],
  };

  /** @type {any} */
  let G = null;

  // ---------------------------------------------------------------------
  // Deck / dealing
  // ---------------------------------------------------------------------
  function buildDeck() {
    const deck = [];
    for (let a = 0; a <= 6; a++) {
      for (let b = a; b <= 6; b++) {
        deck.push({ id: `${a}-${b}`, a, b });
      }
    }
    return deck;
  }

  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function deal() {
    const deck = shuffle(buildDeck());
    const hands = [[], [], [], []];
    for (let i = 0; i < deck.length; i++) {
      hands[i % 4].push(deck[i]);
    }
    return hands;
  }

  function teamOf(playerIdx) {
    return playerIdx % 2 === 0 ? 0 : 1;
  }

  function teamName(t) {
    return t === 0 ? "You & Partner" : "West & East";
  }

  function handPips(hand) {
    return hand.reduce((s, t) => s + t.a + t.b, 0);
  }

  // ---------------------------------------------------------------------
  // Match / round lifecycle
  // ---------------------------------------------------------------------
  function newMatch() {
    G = {
      scores: [0, 0],
      roundNumber: 0,
      logMessages: [],
      selected: null, // {tileId, sides}
      gameOver: false,
    };
    log("New match! First round starter must open with the double-six.");
    startRound(null, true);
  }

  function startRound(forcedStarter, isFirstRound) {
    G.hands = deal();
    G.chain = []; // ordered list of {a,b,isDouble} oriented left->right
    G.leftEnd = null;
    G.rightEnd = null;
    G.passesInRow = 0;
    G.selected = null;
    G.mustPlayDoubleSix = false;
    G.roundNumber++;

    if (isFirstRound) {
      const holder = G.hands.findIndex((h) => h.some((t) => t.a === 6 && t.b === 6));
      G.currentPlayer = holder;
      G.mustPlayDoubleSix = true;
      log(`Round ${G.roundNumber}: ${holder === 0 ? "You hold" : seatName(holder) + " holds"} double-six and must lead.`);
    } else {
      G.currentPlayer = forcedStarter;
      log(`Round ${G.roundNumber}: ${seatName(forcedStarter)} leads.`);
    }

    render();
    proceed();
  }

  function seatName(idx) {
    return ["You", "West", "Partner", "East"][idx];
  }

  function log(msg) {
    G.logMessages.push(msg);
    const el = document.getElementById("log");
    if (el) el.textContent = msg;
  }

  // ---------------------------------------------------------------------
  // Move computation
  // ---------------------------------------------------------------------
  function computeValidMoves(playerIdx) {
    const hand = G.hands[playerIdx];
    const moves = [];

    if (G.chain.length === 0) {
      if (G.mustPlayDoubleSix) {
        const t = hand.find((t) => t.a === 6 && t.b === 6);
        if (t) moves.push({ tileId: t.id, sides: ["center"] });
        return moves;
      }
      hand.forEach((t) => moves.push({ tileId: t.id, sides: ["center"] }));
      return moves;
    }

    hand.forEach((t) => {
      const sides = [];
      if (t.a === G.leftEnd || t.b === G.leftEnd) sides.push("left");
      if (t.a === G.rightEnd || t.b === G.rightEnd) sides.push("right");
      if (sides.length) moves.push({ tileId: t.id, sides });
    });
    return moves;
  }

  function findTile(playerIdx, tileId) {
    return G.hands[playerIdx].find((t) => t.id === tileId);
  }

  // ---------------------------------------------------------------------
  // Playing a tile
  // ---------------------------------------------------------------------
  function doPlay(playerIdx, tileId, side) {
    const hand = G.hands[playerIdx];
    const idx = hand.findIndex((t) => t.id === tileId);
    if (idx === -1) return;
    const tile = hand[idx];
    const isDouble = tile.a === tile.b;

    let rec;
    if (side === "center") {
      rec = { a: tile.a, b: tile.b, leftVal: tile.a, rightVal: tile.b, isDouble };
      G.chain.push(rec);
      G.leftEnd = rec.leftVal;
      G.rightEnd = rec.rightVal;
    } else if (side === "right") {
      const matchVal = G.rightEnd;
      const other = tile.a === matchVal ? tile.b : tile.a;
      rec = { a: tile.a, b: tile.b, leftVal: matchVal, rightVal: isDouble ? matchVal : other, isDouble };
      G.chain.push(rec);
      G.rightEnd = rec.rightVal;
    } else {
      // left
      const matchVal = G.leftEnd;
      const other = tile.a === matchVal ? tile.b : tile.a;
      rec = { a: tile.a, b: tile.b, leftVal: isDouble ? matchVal : other, rightVal: matchVal, isDouble };
      G.chain.unshift(rec);
      G.leftEnd = rec.leftVal;
    }

    hand.splice(idx, 1);
    G.passesInRow = 0;
    G.mustPlayDoubleSix = false;
    G.selected = null;
    log(`${seatName(playerIdx)} played ${tile.a}-${tile.b}.`);

    if (hand.length === 0) {
      roundEndDomino(playerIdx);
      return;
    }
    nextTurn();
  }

  function doPass(playerIdx) {
    G.passesInRow++;
    G.selected = null;
    log(`${seatName(playerIdx)} passes.`);
    if (G.passesInRow >= 4) {
      roundEndBlocked();
      return;
    }
    nextTurn();
  }

  function nextTurn() {
    G.currentPlayer = (G.currentPlayer + 1) % 4;
    render();
    proceed();
  }

  function proceed() {
    if (G.gameOver) return;
    if (G.currentPlayer !== 0) {
      setTimeout(botTurn, 600 + Math.random() * 500);
    } else {
      render(); // ensure playable highlighting is current
    }
  }

  // ---------------------------------------------------------------------
  // Round endings
  // ---------------------------------------------------------------------
  function roundEndDomino(winnerIdx) {
    const winnerTeam = teamOf(winnerIdx);
    const opponentTeam = 1 - winnerTeam;
    const opponents = opponentTeam === 0 ? [0, 2] : [1, 3];
    const pts = opponents.reduce((s, p) => s + handPips(G.hands[p]), 0);
    G.scores[winnerTeam] += pts;
    const msg = `${seatName(winnerIdx)} dominoes! ${teamName(winnerTeam)} score ${pts} points.`;
    log(msg);
    finishRound(winnerTeam, winnerIdx, msg);
  }

  function roundEndBlocked() {
    const totals = [
      handPips(G.hands[0]) + handPips(G.hands[2]),
      handPips(G.hands[1]) + handPips(G.hands[3]),
    ];
    let winnerTeam = null;
    let msg;
    if (totals[0] < totals[1]) winnerTeam = 0;
    else if (totals[1] < totals[0]) winnerTeam = 1;

    let nextStarter;
    if (winnerTeam !== null) {
      const pts = totals[1 - winnerTeam];
      G.scores[winnerTeam] += pts;
      const teamPlayers = winnerTeam === 0 ? [0, 2] : [1, 3];
      nextStarter = teamPlayers.reduce((best, p) =>
        handPips(G.hands[p]) < handPips(G.hands[best]) ? p : best
      );
      msg = `Board blocked. ${teamName(winnerTeam)} win the count and score ${pts} points.`;
    } else {
      nextStarter = (G.currentPlayer + 1) % 4;
      msg = `Board blocked. Pip counts are tied — no points awarded.`;
    }
    log(msg);
    finishRound(winnerTeam, nextStarter, msg);
  }

  function finishRound(winnerTeam, starter, msg) {
    render();

    if (winnerTeam !== null && G.scores[winnerTeam] >= TARGET_SCORE) {
      showOverlay(
        `${teamName(winnerTeam)} win the match!`,
        `${msg}<br><br>Final score — We: ${G.scores[0]}, They: ${G.scores[1]}.`,
        "New Game",
        () => newMatch()
      );
      G.gameOver = true;
      render();
      return;
    }

    showOverlay(
      winnerTeam === null ? "Hand blocked" : `${teamName(winnerTeam)} win the hand`,
      msg,
      "Next Hand",
      () => startRound(starter, false)
    );
  }

  // ---------------------------------------------------------------------
  // AI
  // ---------------------------------------------------------------------
  function botTurn() {
    if (G.gameOver) return;
    const idx = G.currentPlayer;
    const moves = computeValidMoves(idx);
    if (moves.length === 0) {
      doPass(idx);
      return;
    }
    let best = -Infinity;
    let scored = moves.map((m) => {
      const t = findTile(idx, m.tileId);
      const isDouble = t.a === t.b;
      const score = t.a + t.b + (isDouble ? 4 : 0);
      best = Math.max(best, score);
      return { m, t, score };
    });
    const top = scored.filter((s) => s.score === best);
    const choice = top[Math.floor(Math.random() * top.length)];
    const side = choice.m.sides.includes("right") && choice.m.sides.includes("left")
      ? (Math.random() < 0.5 ? "left" : "right")
      : choice.m.sides[0];
    doPlay(idx, choice.m.tileId, side);
  }

  // ---------------------------------------------------------------------
  // Human interaction
  // ---------------------------------------------------------------------
  function onHandTileClick(tile, moves) {
    const move = moves.find((m) => m.tileId === tile.id);
    if (!move) return;
    if (move.sides.length === 1) {
      doPlay(0, tile.id, move.sides[0]);
      return;
    }
    // ambiguous (matches both ends) -> let user pick a side
    if (G.selected && G.selected.tileId === tile.id) {
      G.selected = null;
    } else {
      G.selected = { tileId: tile.id, sides: move.sides };
    }
    render();
  }

  function onDropZoneClick(side) {
    if (!G.selected) return;
    doPlay(0, G.selected.tileId, side);
  }

  function onPassClick() {
    if (G.currentPlayer !== 0) return;
    const moves = computeValidMoves(0);
    if (moves.length > 0) return;
    doPass(0);
  }

  // ---------------------------------------------------------------------
  // Rendering
  // ---------------------------------------------------------------------
  function pipHalf(value) {
    const half = document.createElement("div");
    half.className = "half";
    const pattern = PIP_PATTERNS[value] || [];
    for (let i = 0; i < 9; i++) {
      const p = document.createElement("div");
      p.className = pattern.includes(i) ? "pip" : "pip empty";
      half.appendChild(p);
    }
    return half;
  }

  function makeTileFace(a, b) {
    const frag = document.createDocumentFragment();
    frag.appendChild(pipHalf(a));
    frag.appendChild(pipHalf(b));
    return frag;
  }

  function renderHands() {
    const moves = G.currentPlayer === 0 && !G.gameOver ? computeValidMoves(0) : [];
    const playableIds = new Set(moves.map((m) => m.tileId));

    for (let p = 0; p < 4; p++) {
      const el = document.getElementById(`hand-${p}`);
      el.innerHTML = "";
      G.hands[p].forEach((tile) => {
        const isHuman = p === 0;
        const div = document.createElement("div");
        div.className = "tile hand-tile" + (isHuman ? "" : " back");
        if (isHuman) {
          div.appendChild(makeTileFace(tile.a, tile.b));
          const playable = G.currentPlayer === 0 && playableIds.has(tile.id) && !G.gameOver;
          div.classList.add(playable ? "playable" : "unplayable");
          if (G.selected && G.selected.tileId === tile.id) div.classList.add("selected");
          if (playable) {
            div.addEventListener("click", () => onHandTileClick(tile, moves));
          }
        }
        el.appendChild(div);
      });
    }
  }

  function renderBoard() {
    const boardEl = document.getElementById("board");
    boardEl.innerHTML = "";
    const wrap = boardEl.parentElement;
    const bw = wrap.clientWidth || 600;
    const bh = wrap.clientHeight || 300;

    const centerMsg = document.getElementById("centerMessage");
    if (G.chain.length === 0) {
      centerMsg.style.display = "block";
      centerMsg.textContent = G.mustPlayDoubleSix
        ? `${seatName(G.currentPlayer)} must open with double-six`
        : `${seatName(G.currentPlayer)} leads the hand`;
    } else {
      centerMsg.style.display = "none";
    }

    if (G.chain.length === 0) return;

    const GAP = 4;
    const NW = 54, NH = 27; // normal tile footprint (landscape)
    const DW = 27, DH = 54; // double tile footprint (rotated 90 degrees, same total footprint as a normal tile)
    const ROW_H = DH; // reserve the tallest possible tile height per row so tiles can be vertically centered
    const margin = 8;

    let x = margin, rowIndex = 0;
    const positions = [];

    G.chain.forEach((rec) => {
      const w = rec.isDouble ? DW : NW;
      const h = rec.isDouble ? DH : NH;
      if (x + w > bw - margin && positions.length > 0) {
        x = margin;
        rowIndex++;
      }
      const rowY = margin + rowIndex * (ROW_H + GAP);
      const y = rowY + (ROW_H - h) / 2;
      positions.push({ x, y, w, h, rec });
      x += w + GAP;
    });

    const totalHeight = margin + (rowIndex + 1) * (ROW_H + GAP);
    const offsetY = Math.max(0, (bh - totalHeight) / 2);

    const singleRow = rowIndex === 0;
    let offsetX = 0;
    if (singleRow) {
      const lastP = positions[positions.length - 1];
      const totalWidth = lastP.x + lastP.w;
      offsetX = Math.max(margin, (bw - totalWidth) / 2) - margin;
    }

    positions.forEach(({ x, y, w, h, rec }) => {
      const div = document.createElement("div");
      div.className = "tile board-tile" + (rec.isDouble ? " double vertical" : "");
      div.style.left = x + offsetX + "px";
      div.style.top = y + offsetY + "px";
      div.style.width = w + "px";
      div.style.height = h + "px";
      div.appendChild(makeTileFace(rec.leftVal, rec.rightVal));
      boardEl.appendChild(div);
    });

    // drop zones when human has an ambiguous selection
    if (G.selected && G.currentPlayer === 0) {
      G.selected.sides.forEach((side) => {
        const zone = document.createElement("div");
        zone.className = "drop-zone";
        if (side === "left") {
          const first = positions[0];
          zone.style.left = Math.max(4, first.x + offsetX - 44) + "px";
          zone.style.top = first.y + offsetY - 6 + "px";
        } else {
          const last = positions[positions.length - 1];
          zone.style.left = last.x + offsetX + last.w + 4 + "px";
          zone.style.top = last.y + offsetY - 6 + "px";
        }
        zone.title = `Play on the ${side}`;
        zone.addEventListener("click", () => onDropZoneClick(side));
        boardEl.appendChild(zone);
      });
    }
  }

  function renderScoreboard() {
    document.getElementById("scoreUs").textContent = G.scores[0];
    document.getElementById("scoreThem").textContent = G.scores[1];
    document.querySelectorAll(".seat-label").forEach((el, i) => {
      el.classList.toggle("active", !G.gameOver && i === G.currentPlayer);
    });
  }

  function renderPassButton() {
    const btn = document.getElementById("passBtn");
    if (G.gameOver) {
      btn.disabled = true;
      return;
    }
    if (G.currentPlayer !== 0) {
      btn.disabled = true;
      return;
    }
    const moves = computeValidMoves(0);
    btn.disabled = moves.length > 0;
  }

  function render() {
    renderHands();
    renderBoard();
    renderScoreboard();
    renderPassButton();
  }

  // ---------------------------------------------------------------------
  // Overlay (round-end / game-over modal)
  // ---------------------------------------------------------------------
  function showOverlay(title, body, btnLabel, onContinue) {
    let overlay = document.getElementById("overlay");
    if (overlay) overlay.remove();
    overlay = document.createElement("div");
    overlay.id = "overlay";
    overlay.innerHTML = `
      <div class="card">
        <h2>${title}</h2>
        <p>${body}</p>
        <button id="overlayBtn">${btnLabel}</button>
      </div>`;
    document.body.appendChild(overlay);
    document.getElementById("overlayBtn").addEventListener("click", () => {
      overlay.remove();
      onContinue();
    });
  }

  // ---------------------------------------------------------------------
  // Init
  // ---------------------------------------------------------------------
  document.addEventListener("DOMContentLoaded", () => {
    document.getElementById("newGameBtn").addEventListener("click", () => {
      const overlay = document.getElementById("overlay");
      if (overlay) overlay.remove();
      newMatch();
    });
    document.getElementById("passBtn").addEventListener("click", onPassClick);
    window.addEventListener("resize", () => G && renderBoard());
    newMatch();
  });
})();
