# Sword Quest: Monster Worlds

A first-person 3D monster-smashing adventure designed by two game designers
(ages 6 and 8). You start with a **paper sword**, bonk goofy monsters for XP,
and upgrade your way up the sacred material ladder:

> paper → wood → copper → stone → iron → steel → titanium → diamond → **BEDROCK**

Anime cel-shaded look, two worlds (grassy **Plains** and a **Volcano World**
through the portal), armor that upgrades along the same ladder, and online
battles with a friend over peer-to-peer WebRTC.

Built with [Three.js](https://threejs.org/) (toon shading, bloom) and
[Vite](https://vitejs.dev/). No external art assets — every monster, sword,
and world is generated procedurally at runtime.

**▶️ Play it now:**
[bkaps82.github.io/claudecodeplayground/sword-quest](https://bkaps82.github.io/claudecodeplayground/sword-quest/)
— works on desktop and phones. It's part of the repo's
[game arcade](https://bkaps82.github.io/claudecodeplayground/), which co-hosts
every game in this repo on one GitHub Pages site; how that works is documented
in [docs/DEPLOYMENT.md on main](../../blob/main/docs/DEPLOYMENT.md).

## How to play

**On a computer:**

- **Move:** `WASD` or arrow keys · **Jump:** `Space`
- **Look:** mouse (click the screen once to grab the pointer)
- **Swing sword:** left click (hold to keep swinging)
- **Upgrade sword / armor:** `1` / `2` when you can afford it

**On a phone or tablet:**

- **Move:** touch and drag on the left half — a joystick appears
- **Look:** drag on the right half
- **Attack / jump:** the big buttons bottom-right
- **Upgrade:** tap the sword/armor cards top-right

### The rules of the ladder

Killing monsters earns XP. Upgrading to each material costs XP — the same
price for the sword and for the armor:

| Upgrade | XP |
| --- | --- |
| Paper → Wood | 25 |
| Wood → Copper | 50 |
| Copper → Stone | 150 |
| Stone → Iron | 200 |
| Iron → Steel | 300 |
| Steel → Titanium | 500 |
| Titanium → Diamond | 800 |
| Diamond → **BEDROCK** | 100 |

(Yes, bedrock costs less than diamond. The designers were very clear about
this and it is canon.)

Better swords hit harder; better armor shrugs off more damage. Health regens
after a few seconds out of combat, and getting KO'd just respawns you — you
never lose XP or gear.

### The monsters

All monsters invented by the design team, rendered as faithfully as possible:

- **Plains World:** Googly Blob, Zombie Chicken, Spike Ball Meanie, Booger Goblin
- **Volcano World** (through the orange portal — tougher, but worth way more
  XP): Flaming Meatball (with tiny useless arms), Fire Skeleton Ninja,
  Volcano Golem, Lava Dragon

## Running it locally

```bash
npm install
npm run dev
```

Open the printed local URL. `npm run build` produces a fully static `dist/`
(relative asset paths, hostable anywhere); `npm run preview` serves it.

## Playing online with a friend

1. One player picks **Host Online**, enters a name, and gets a 4-digit room
   code.
2. The other picks **Join Online** and enters the code.
3. You share one world (same seed on both machines): hunt monsters together —
   each player keeps their own XP and gear — or bonk *each other*; a PvP
   knockout is worth 50 XP.

Connections are peer-to-peer (WebRTC via [PeerJS](https://peerjs.com/)) with
the public PeerJS cloud for matchmaking, so both devices just need internet —
there is no game server. The host's browser is authoritative: it runs all
monster AI and streams monster snapshots (~8 Hz) and its own state (20 Hz) to
the joiner; the joiner sends its state and its sword hits, and the host
resolves damage and awards kills. For development in a sandbox, point the
game at your own [peer server](https://github.com/peers/peerjs-server) with
query params: `?peerhost=127.0.0.1&peerport=9100&peerpath=/`.

## Project structure

```
index.html              Menus, HUD, touch controls markup
src/main.js              renderer/scene setup, game modes, net protocol, game loop
src/style.css             UI styling
src/game/
  Progression.js          the material ladder: tiers, XP costs, damage/armor stats
  World.js                 both worlds: terrain, trees, lava, portals, atmosphere
  Monsters.js               monster bodies, AI, HP bars, effects, host↔client sync
  Player.js                 first-person controller + sword viewmodel + combat
  AnimeCharacter.js         the other player's cel-shaded anime avatar
  Sword.js                  procedural swords & armor for every material tier
  ToonUtils.js              cel-shading, outlines, googly eyes, text sprites
  Input.js                  keyboard/mouse (pointer lock) + touch joysticks
  UI.js                     menu flow and HUD bindings
  Net.js                    PeerJS wrapper: room codes, host/join, messaging
  Audio.js                  synthesized sound effects (no audio files)
```

## Deployment

Pushes to this branch run `.github/workflows/deploy-pages.yml`, which
rebuilds the whole arcade (every game in the repo) and deploys it to GitHub
Pages, with this game at `/sword-quest/`.
