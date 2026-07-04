# Jamaican Dominoes

A browser-based, single-player take on classic Jamaican-style partnership dominoes. No build step — just open `index.html`.

You play the **bottom seat** with an AI partner (North) against two AI opponents (West and East).

## Rules

This follows classic Jamaican block-dominoes conventions:

- **Double-six set**, all 28 tiles dealt evenly (7 per player) — no boneyard, no drawing. If you can't play, you pass.
- **Partnerships**: You + Partner (North) vs. West + East.
- **Opening**: In the first hand of a match, whoever holds the double-six must open with it. In later hands, the winner of the previous hand leads (with any tile).
- **Scoring**:
  - If a player empties their hand ("dominoes"), their team scores the total pip count remaining in the *opponents'* hands.
  - If the board is blocked (no one can play), team pip totals are compared — the lower-pip team scores the difference. A tie awards no points.
  - First team to **200 points** wins the match.

## How to play

1. Open `index.html` in a browser.
2. Tiles you can legally play are highlighted with a gold outline in your hand at the bottom.
3. Click a playable tile:
   - If it only fits one open end, it's placed automatically.
   - If it fits both ends, two drop zones appear on the board — click one to choose where to play it.
4. Click **Pass** when it lights up (i.e., you have no legal move).
5. Click **New Game** anytime to reset the match.

## Files

- `index.html` — page layout and structure
- `style.css` — table, tile, and pip styling
- `game.js` — game state, rules engine, AI opponents, and rendering
