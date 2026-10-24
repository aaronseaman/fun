# Navos Ninja

A polished, top-down **five-minute survival roguelite** for the browser. You play a tanned ninja in khaki scrubs with a katana, holding out against swarms of silly four-legged monsters. Your weapons attack on their own; your job is to move, dodge, collect XP and build a set of upgrades that evolve into something ridiculous.

**Play:** https://aaronseaman.github.io/fun/ · **Source:** https://github.com/aaronseaman/fun

Everything you see (the hero, the monsters, the arena, weapons, effects, icons and HUD) is drawn procedurally with Canvas 2D. There are no image, sprite or audio files, no dependencies and no build step.

## Core gameplay

- One continuous **5:00** run in a circular arena. The camera follows the hero and monsters pour in from beyond the screen edge.
- **Weapons fire automatically.** You never aim. Movement and positioning are the whole skill.
- Every kill drops an **XP gem**. Get close and gems are magnetised to you.
- Each **level-up pauses the game** and offers **three upgrade cards**: new weapons, weapon levels, evolutions or passive skills.
- Difficulty ramps smoothly. Spawn rate, enemy health, speed, damage and the share of tougher variants all rise along `difficulty = 1 + f² × 3` (where `f` is the fraction of the run elapsed), and swarm rings close in at 0:55, 1:50, 3:15, 3:55 and 4:45.
- **2:30: miniboss** *Chompzilla* (charge and ground-slam). **4:30: final boss** *The Grand Gobbler* (charge, 21-glob spit volley and slam), each with a clear telegraph and a dizzy recovery window.
- **Victory:** survive until the timer hits 0:00, or defeat the final boss early, which ends the run immediately. The results screen says whether the final boss was defeated. **Defeat:** your health reaches 0.

## Controls

| Action | Keyboard / mouse | Touch |
| --- | --- | --- |
| Move | `WASD` or arrow keys (diagonals are normalised) | Drag anywhere (virtual joystick) |
| Dash (short i-frames, 2.2 s cooldown) | `Space` | **DASH** button |
| Pause / resume | `Esc` (or `P`) | Pause button, top right |
| Pick upgrade | Click a card, or `1` `2` `3` | Tap a card |
| Toggle sound (starts muted) | `M` or the Sound button | Sound button |

The game pauses automatically when the window loses focus or the tab is hidden, and held keys are released.

## Weapons

| Weapon | Behaviour | Evolution at Lv 5 |
| --- | --- | --- |
| **Sword Strike** (starting weapon) | The hero swings his katana at the nearest enemy: a fast, short-range blade arc with knockback and an impact flash. | **Rapid Response**: about 1.6× attack speed, a 200° arc (up from 147°), more reach, damage and knockback, and a gold trail. |
| **Syringe Projectile** | Fires syringes in a straight line at the nearest enemy. Each one is consumed on hit. | **Syringe Barrage**: 6+ syringes per volley, each aimed at a *different* nearby target, piercing up to 3 enemies. |
| **Pulse Ring** | An expanding ring that damages and pushes back nearby enemies. Each pulse hits each enemy once. | **Defib Shockwave**: a much larger double pulse that stuns. |
| **Rotating Medallion** | Spinning gold medallions orbit you and hit on contact, with a per-enemy cooldown. | **Caduceus Halo**: 5+ larger, faster medallions in a wider orbit. |

Once a weapon reaches level 5, its evolution is **always** among the next level-up's choices. Evolutions change real stats; they are not a rename.

## Upgrades (14 passives)

| Upgrade | Effect per stack |
| --- | --- |
| Stronger Strikes | +15% damage |
| Rapid Reflexes | −8% weapon cooldowns (multiplicative) |
| Extended Reach | +10% strike range, pulse radius, syringe range and orbit size |
| Vitality | +20 max HP and heals 20 |
| Regeneration | +0.6 HP/s |
| XP Magnet | +40% gem pickup radius |
| Running Shoes | +8% move speed |
| Critical Response | +7% crit chance (crits deal 2×) |
| Heavy Impact | +35% knockback |
| Additional Syringes | +1 syringe per volley (requires Syringe) |
| Expanded Pulse | +15% pulse radius (requires Pulse Ring) |
| Extra Orbit | +1 medallion (requires Medallion) |
| Protective Scrubs | −7% damage taken |
| Lucky Find | +12% XP from gems |

Cards are drawn without duplicates from a weighted pool that holds only valid, effective options (stack caps and weapon requirements are respected). If the pool is ever exhausted, an *Adrenaline Shot* card (heal plus a small damage bonus) fills the slot.

Pickups: a rare **medkit** (+30 HP) and **magnet** (pulls in every gem). The miniboss always drops both.

## Run locally

Any static file server works. From the project folder:

```sh
python3 -m http.server 8000
# then open http://localhost:8000/
```

(`npx serve .` or similar also works. Opening `index.html` via `file://` generally works too, but a server is recommended.)

Optional URL flags: `?debug` shows a small performance/entity overlay; `?test` exposes simulation hooks on `window.NavosNinja.test`, which the automated tests use.

## Deploy / GitHub Pages

The game is static files at the repository root, with no build step.

- **Source:** `main` branch of [`aaronseaman/fun`](https://github.com/aaronseaman/fun).
- **Live site:** https://aaronseaman.github.io/fun/, served by GitHub Pages (legacy "deploy from a branch") from the `gh-pages` branch, which mirrors `main`. Publish an update by pushing the same commit to both:

```sh
git push origin main && git push origin main:gh-pages
```

To serve directly from `main` instead (no mirror branch needed), set **Settings → Pages → Branch** to `main` / `(root)`. The automated build session couldn't change that setting itself, because its API access to Pages is blocked.

## Technical architecture

```
index.html   canvas plus DOM overlays (title, level-up, pause, results)
style.css    menu and overlay styling (system fonts only)
game.js      the whole game, in 18 commented sections:
  1 CONFIG         every tunable number (timings, caps, stats, spawn curve)
  2 Canvas         DPR-aware sizing, capped pixel count, zoom by screen size
  3 Input          keyboard, touch joystick, focus-loss reset
  4 Game state     TITLE / PLAYING / LEVEL_UP / PAUSED / VICTORY / DEFEAT
  5 Camera         smoothed follow, trauma-based screen shake, hit-stop
  6 Player         movement, dash, damagePlayer() (the only way the hero takes damage)
  7 Enemies        runner/brute/dasher/miniboss/boss AI, spatial grid, damageEnemy()
  8 Spawner        difficulty curve, edge spawns, swarm rings, one-shot boss flags
  9 Weapons        registry of four weapons plus stat tables and evolutions
  10 Projectiles   pooled projectiles, hit tracking so a projectile never re-hits an enemy
  11 XP & pickups  gems (capped, merged when over the cap), magnet, medkit
  12 Upgrades      passive registry, weighted 3-card draw, evolution
  13 Particles     pooled particles with a free-list, floating-text ring buffer
  14 HUD & UI      canvas HUD, DOM menus, procedural icons
  15 Audio         Web Audio synthesis, throttled, muted by default
  16 Main loop     fixed 60 Hz timestep, delta clamp, separate render pass
  17 Rendering     cached ground chunks, hero/monster art, layered world passes
  18 Init          startRun() rebuilds the entire run from scratch
```

Key implementation points:

- **Fixed-timestep simulation** (1/60 s) with delta clamping and a step cap per frame. Rendering is a separate pass that only reads state.
- **Paused states never step the simulation.** The run clock, enemies, projectiles and effects all live inside `step()`, which only runs in `PLAYING`.
- **One authoritative damage path** per side: `damageEnemy()` (crits, knockback, stun, numbers, death) and `damagePlayer()` (armour, i-frames, recoil, death exactly once).
- **Spatial hash grid** (64-unit cells, rebuilt each step) for enemy separation, projectile hits, medallion contact and player contact.
- **Pooling and caps** (all in `CONFIG.caps`): enemies 300, projectiles 160, gems 380, particles 700, floating texts 60. When frame cost rises, decorative particles are dropped first.
- **Ground** is generated deterministically from world coordinates into 512-unit chunks, cached in an LRU, so it never flickers and costs one `drawImage` per chunk.
- **Art that costs nothing per frame:** the terrain grain (a tileable value-noise texture blended in two rotated layers), stone lanterns, plaza mosaic, mushrooms, mossy rocks and blossom trees are all baked into the cached ground chunks. Per-frame atmosphere is cheap: four flickering lantern glows, about 30–60 additive fireflies, two-layer soft shadows, and a CSS vignette with a warm/cool colour grade.
- **Regular monsters** are drawn as vector art once into 8 leg-cycle frames (plus hit-flash frames) and then blitted. Squash-and-stretch, shake and lean are applied as transforms, and the pupils are drawn live so the eyes still track the hero. Bosses stay fully vector.
- Render order: background → terrain → decoration → telegraph decals → shadows (one batched path) → gems/pickups → enemies (y-sorted) → hero → weapons/projectiles → particles → telegraph outlines and numbers → screen overlays → HUD.

## Design decisions

- **The hero just wears scrubs; he isn't a nurse.** Following direction after the first build, the stethoscope, pen and medical cross were removed, and he fights with a katana: he carries a scabbard, holds the sword in a ready stance and visibly swings it with every strike. The starting weapon is called **Sword Strike**, and the medallion and plaza use a shuriken emblem instead of a medical cross. The syringe, pulse ring and medallion weapons are kept from the original brief.
- **Name clash resolved:** the brief used "Rapid Response" for both the starting weapon's evolution and the cooldown passive. The evolution keeps the name; the passive is called **Rapid Reflexes**.
- **Two extra evolutions** (Defib Shockwave and Caduceus Halo) were cheap to add through the registry, so all four weapons can evolve.
- **The hero can never be sealed in.** Overlapping enemies are pushed away from the hero (bosses push the hero instead) and only slow them slightly, so contact damage still matters but the hero can't get stuck.
- **Gems never vanish.** Above the gem cap, the farthest gem is merged into the newest one, so XP isn't lost and the count stays bounded. Enemies that fall far behind are recycled to the screen edge ahead of the hero.
- **Bosses don't scale** with run time and are immune to stun, so they're predictable to learn. Below 50% HP they attack more often.
- **Title, level-up, pause and results screens are DOM overlays** for crisp text, accessibility and easy hit-testing. Everything in play is canvas.
- The arena is a large circle (radius 1500) with a stone plaza at its centre and a forest beyond the boundary stones that gets denser with distance.

## Tests performed

All automated tests ran in headless Chromium (Playwright) against a local `python3 -m http.server`. Most checks drive the simulation step by step through the `?test` hooks. The long runs use a simple scripted bot for input, not a human.

- `node --check game.js`: passes.
- **Functional suite: 30/30 checks passed.** Title screen loads; Start begins a fresh run; WASD and arrow movement work; a diagonal covers the same distance as a single axis (215.00 vs 215.00 units in 1 s); weapons damage and kill enemies with no input; a kill drops one gem, which is collected and awarded exactly once; an XP threshold opens the level-up screen; the clock and enemy positions don't change while the level-up screen is open (900 ms checked); clicking a card applies it and resumes; passives change real stats; syringe volleys match the cooldown (4 volleys in 5 s at a 1.25 s cooldown); Rapid Response and Syringe Barrage evolutions are offered at Lv 5 and change stats; difficulty and enemy HP rise over time and spawn volume rises across the run; the miniboss spawns exactly once at 2:30 and the final boss exactly once at 4:30; the hero can die (HP clamps at 0, death handled once); i-frames block repeat hits; the Defeat screen and Retry work; the timer gives a Victory marked "not defeated"; killing the final boss gives an early Victory marked "Defeated"; Esc pause and resume freeze and continue the clock; focus loss pauses the game and releases held keys; Return to Title works; resizing to 800×600, 390×844, 1920×1080 and 1280×760 keeps the canvas in sync; Restart resets every piece of run state (time, kills, level, XP, weapons, passives, bosses, gems, projectiles, particles); the touch joystick moves the hero; entity caps hold in the late game; there are no uncaught exceptions.
- **Simulated balance runs** (whole 5:00 runs stepped quickly, bot input, final code): with a sensible pick order the bot won 3 of 3 runs by surviving to the timer. It got the final boss down to 660 and 1,793 HP in two of them but never killed it, because it kites the boss outside melee range. With random picks the bot died at 3:20 and 4:40. An earlier tuning pass (boss at 9,000 HP, lower late-game spawn rate) killed the boss in 2 of 3 runs.
- **Real-time playthrough:** one full run driven by the real `requestAnimationFrame` loop at 1366×768 with the autopilot bot (not a human). Result: Victory at 5:00 on the timer, 1,833 kills, level 29, miniboss defeated, final boss survived, three evolutions, no errors. Frame rate was about 59–60 FPS (p95 16.8 ms) until the final minute, where it dipped to about 56 FPS (p95 33 ms). This run used an earlier build, before monster sprite caching, the CSS vignette and the lower final-boss HP.
- **Performance after optimisation:** full render plus forced raster in headless Chromium's software renderer dropped from about 14.3 ms to about 7.5 ms per frame at around 59 enemies. The later art pass (katana hero, grain, lanterns, fireflies, richer monsters) adds about 0.5 ms (about 8.0 ms).
- **After the art pass:** the 30-check functional suite passes again (30/30), and a 40-second real-time sample of 4:05–4:45 holds 59.4–59.9 FPS (p95 16.7–16.8 ms) with up to 82 live enemies.

Screens were also checked by eye from screenshots: title, gameplay at several stages, the level-up screen (desktop and 390×844 mobile), boss telegraphs (charge lane and spit), pause and results.

## Known limitations

- The live URL couldn't be fetched from the build environment, whose network policy blocks `github.io`. The deployment was confirmed through GitHub's API instead: the "pages build and deployment" run succeeded, and the `github-pages` deployment reports `success` at that URL.
- Not tested with a real human player or on physical mobile hardware. Touch controls were tested only with synthetic pointer events.
- Performance numbers come from headless Chromium. Very old or low-power devices may drop frames during the densest late-game swarms (the game reduces decorative particles first).
- Balance was tuned with a bot. Human skill varies, so the final boss may feel easy for strong players or the mid-game hard for new ones.
- Audio is simple synthesized blips (muted by default), and there's no music.
- No persistent meta-progression, settings menu or saved high scores.
