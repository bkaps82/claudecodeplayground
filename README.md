# 🕹️ Claude Code Playground Arcade

A collection of browser games, each developed on its own branch and co-hosted
together on a single GitHub Pages site.

## Play now

| Game | Play link | Source branch |
| --- | --- | --- |
| 🎪 **Arcade landing page** | [bkaps82.github.io/claudecodeplayground](https://bkaps82.github.io/claudecodeplayground/) | — |
| 🦑🌲 **Ink Battle: Forest Arena** | […/ink-battle/](https://bkaps82.github.io/claudecodeplayground/ink-battle/) | [`claude/ink-battle-game-prototype-kcdqk7`](../../tree/claude/ink-battle-game-prototype-kcdqk7) |
| ⚔️🎨 **Paint Duel Octagon** | […/paint-duel/](https://bkaps82.github.io/claudecodeplayground/paint-duel/) | [`claude/anime-sword-paint-game-8jz1jx`](../../tree/claude/anime-sword-paint-game-8jz1jx) |
| 🗡️🌋 **Sword Quest: Monster Worlds** | […/sword-quest/](https://bkaps82.github.io/claudecodeplayground/sword-quest/) | [`claude/third-game-implementation-yx5cuq`](../../tree/claude/third-game-implementation-yx5cuq) |

All games work on desktop **and** phones (touch controls), and all support
online multiplayer over peer-to-peer WebRTC — no accounts, no installs: open
the link and play.

- **Ink Battle: Forest Arena** — top-down Splatoon-style ink shooter in a
  blocky, Minecraft-ish Pokémon forest. Recruit wild critters as battle
  companions, grab Smash-style power-ups, splat your friends. Solo vs. bots or
  up to 4 players with a shareable room code.
- **Paint Duel Octagon** — anime paint-sword duels in a 3D octagon arena,
  built with Three.js.
- **Sword Quest: Monster Worlds** — first-person monster bonking, designed
  by two consultants ages 6 and 8. Level your paper sword up to BEDROCK
  across plains and volcano worlds; co-op or PvP online.

## How the hosting works (short version)

A GitHub repo gets exactly **one** GitHub Pages site — but we have multiple
games on multiple branches. So instead of each branch deploying itself (and
wiping out the others), a single combined workflow assembles every game into
one site under subpaths:

```
/             ← landing page ("pick your game")
/ink-battle/  ← static files, copied straight from its branch
/paint-duel/  ← Vite build output from its branch
/sword-quest/ ← Vite build output from its branch
```

Any push to `main` or to any game branch redeploys the whole site with the
**latest commit of every game**, so the games can keep evolving independently
on their own branches without stepping on each other.

Full details — including how to add a new game to the arcade — in
[docs/DEPLOYMENT.md](docs/DEPLOYMENT.md).
