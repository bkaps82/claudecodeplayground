# Ink Battle: Forest Arena

A browser game that mashes up **Splatoon** (ink-shooting battles), **Pokémon**
(catch wandering forest critters as battle companions), **Super Smash Bros.**
(grab-able power-ups), and a **Minecraft**-style blocky look, set in a
Pokémon-esque forest world.

No installs, no accounts — open it in a browser and play. Works solo against
bots, or online with friends over peer-to-peer WebRTC (one player hosts and
shares a short room code).

## How to play

- **Move:** `WASD` or arrow keys
- **Aim:** mouse
- **Shoot ink:** hold left mouse button
- **Recruit a critter:** walk up to a wild one in the tall grass and press `E`
- Splat opponents to score KOs. Most KOs when the timer hits `0:00` wins.
- Standing on your own ink puddles gives you a small speed and reload boost —
  just like the games it's inspired by.
- Power-ups spawn around the map: speed boots, a rapid-fire star, an ink
  shield, and an ink bomb.

## Running it

This is a static site — no build step. From the project root, serve the
folder with any static file server, for example:

```bash
python3 -m http.server 8080
# or: npx http-server -p 8080
```

Then open `http://localhost:8080` in your browser. Opening `index.html`
directly via `file://` usually also works, but a local server is more
reliable (especially for the multiplayer connection).

## Playing online with friends

Multiplayer uses [PeerJS](https://peerjs.com/) for direct peer-to-peer WebRTC
connections — there's no game server to run or deploy, just PeerJS's free
public signaling service to help two browsers find each other. Everyone still
needs a normal internet connection.

1. One player clicks **Host a Game**, enters a name, and clicks **Create
   Room**. They'll get a 5-character room code.
2. They share that code with friends (up to 3 more players, 4 total).
3. Friends click **Join a Game**, enter their name and the code, and connect.
4. The host clicks **Start Battle!** once everyone's in the lobby.

The host's browser tab runs the actual game simulation and streams updates to
everyone else, so the host should be the player with the most stable
connection.

## Project layout

```
index.html               Page shell: menu, HUD, canvas
css/style.css             All styling
js/utils.js               Math/random/color helpers
js/world.js               Procedural blocky forest map + collision
js/entities.js            Player/critter/power-up/ink factories & constants
js/sim.js                 Authoritative game simulation (movement, combat, AI, win condition)
js/network.js             PeerJS wrapper (host/join, message passing)
js/render.js               Canvas rendering + HUD updates
js/sound.js                Tiny procedural WebAudio sound effects
js/game.js                 Orchestration: game loop, input, menu wiring, solo/host/client modes
js/vendor/peerjs.min.js    Vendored PeerJS build (no external CDN dependency)
```

The world is procedurally generated from a random seed each match; the host
shares that seed with clients so everyone renders an identical map without
having to transmit the whole thing.
