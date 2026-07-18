# Paint Duel: Octagon of Death

A browser-based 3D anime duel. Two sword-wielding fighters face off in an
octagonal arena, splattering each other with paint fired from their blades.
Whoever gets every body part fully coated first loses.

Built with [Three.js](https://threejs.org/) (cel-shaded/toon rendering,
bloom post-processing) and [Vite](https://vitejs.dev/). No external art
assets — every character, prop, and texture is generated procedurally at
runtime.

## Play it

```bash
npm install
npm run dev
```

Open the printed local URL in a browser. Click **Enter the Octagon** to start.

### Game modes

- **Local Duel** — two players on one keyboard (or one touchscreen).
- **Host Online / Join Online** — play across two devices. The host gets a
  4-digit room code; the joiner enters it and the match starts on both
  screens. Connections are peer-to-peer (WebRTC via PeerJS) with the
  public PeerJS cloud for matchmaking, so both devices just need internet.

### Controls

| Player | Move | Paint Slash |
| --- | --- | --- |
| Player 1 — SHIRO | `W` `A` `S` `D` | `Space` |
| Player 2 — AKA | Arrow keys | `Enter` |

On touchscreens each player gets a virtual joystick (touch and drag
anywhere in their zone) and an attack button. In online mode you control
your own fighter with a single joystick + button.

Land hits with your sword to splatter paint on your opponent. Every hit
lands on one of their six body parts (head, torso, both arms, both legs).
The first fighter with **all six** fully painted is finished.

## Production build

```bash
npm run build   # outputs static files to dist/
npm run preview # serve the production build locally
```

`dist/` is fully static and can be hosted anywhere (no server-side logic).

## Project structure

```
index.html            HUD/menu markup
src/main.js            scene setup, game loop, camera, postprocessing
src/style.css           UI styling
src/engine/
  Character.js          procedural anime fighter rig, paint coverage, animation
  PaintSystem.js         paint projectiles, trails, hit particles
  Arena.js               octagon platform, lighting, atmosphere
  Controls.js             keyboard + touch input merge
  TouchControls.js       virtual joysticks and attack buttons
  Net.js                 PeerJS wrapper: room codes, host/join, messaging
  UI.js                  HUD/menu/win-screen DOM bindings
  ToonUtils.js           cel-shading + procedural splat/face textures
  Audio.js               synthesized sound effects (no audio files)
```

## Online architecture

The host is authoritative: it runs the full simulation and streams
position snapshots (20 Hz) plus discrete events (attacks, projectile
spawns, paint hits, game over) to the client. The client sends only its
input, predicts its own sword swing for responsiveness, and replays the
host's events — paint coverage stays deterministic on both sides because
hit amounts are fixed and applied from the same event data.

For development in a sandbox (or self-hosting), point the game at your
own [peer server](https://github.com/peers/peerjs-server) with query
params: `?peerhost=127.0.0.1&peerport=9100&peerpath=/`.

## Deployment

Pushes to the main development branch run `.github/workflows/deploy-pages.yml`,
which builds the site and deploys `dist/` to GitHub Pages. Online mode
requires hosting that allows outbound connections to the PeerJS cloud
(GitHub Pages does; sandboxed embeds may not).
