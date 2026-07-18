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

### Controls

| Player | Move | Paint Slash |
| --- | --- | --- |
| Player 1 — SHIRO | `W` `A` `S` `D` | `Space` |
| Player 2 — AKA | Arrow keys | `Enter` |

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
  Controls.js             two-player local keyboard input
  UI.js                    HUD/menu/win-screen DOM bindings
  ToonUtils.js              cel-shading + procedural splat/face textures
  Audio.js                   synthesized sound effects (no audio files)
```
