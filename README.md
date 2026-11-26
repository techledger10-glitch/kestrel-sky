# kestrel-sky

[![make.fun · best-flight-game-20261126-0057](https://make.fun/badge/best-flight-game-20261126-0057.svg)](https://make.fun/bounty/best-flight-game-20261126-0057?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)
[![rank](https://make.fun/badge/best-flight-game-20261126-0057/techledger10-glitch/kestrel-sky/rank.svg)](https://make.fun/bounty/best-flight-game-20261126-0057/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)
[![reward](https://make.fun/badge/best-flight-game-20261126-0057/techledger10-glitch/kestrel-sky/reward.svg)](https://make.fun/bounty/best-flight-game-20261126-0057?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)

**Kestrel Sky** is a low-poly flight game for the desktop browser, set over the Alder Isles at
eighteen-forty on a single long evening. You fly a light single-engine aircraft with throttle,
prop and stick, and a sortie is graded on how you flew it, not how fast you got there: gates are
flown through their centre, survey markers are crossed low and level, the strip is landed on with
the gear down and the nose up. Everything — terrain, aircraft, instruments, sky and sea — is
generated in code from one WebGL renderer and a handful of ES modules. No engine, no libraries,
no network request, no build step.

Three sorties and free flight:

| Sortie | Goal |
| --- | --- |
| **Ridge Run** | Eight gates down the Alder spine, from the coast to the high pass |
| **Low Survey** | Five passes over the coastal survey, each marker crossed low and level |
| **Dusk Delivery** | Four gates and a landing at a strip with a leaking tank |
| **Free Flight** | The islands, the light, and no clock |

## Run it

```sh
node serve.ts          # then open http://localhost:8080/
```

`main.ts` is the entry Make.fun's grader runs: it copies `game/` and `screenshots/` to `/output`
and writes the dossier beside them.

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

## Flying it

| Key | Control |
| --- | --- |
| `↑` `↓` | pitch / elevator |
| `←` `→` | roll / aileron |
| `A` `D` | rudder |
| `W` `S` | throttle |
| `Space` | wheel brakes |
| `C` | chase / cockpit view |
| `G` | landing gear |
| `P` | pause |
| `R` | restart sortie |
| `N` | sound on / off |
| `Enter` | confirm / fly again |

A mouse held and moved flies the aircraft too; the wheel is the throttle.

## What is in `game/`

| File | Job |
| --- | --- |
| `index.html` | the page: the canvas, the overlay canvas, the sortie list |
| `src/main.js` | the frame loop and the scenes: title, brief, flight, debrief, screenshots |
| `src/flight-run.js` | the rules of a sortie: gate order, scoring, grades, debrief figures |
| `src/missions.js` | the four sorties and the start of each one |
| `src/rings.js` | course state, which gate is next, what went through it, and its rendering |
| `src/aircraft.js` | the flight model: lift, drag, prop thrust, stall, ground contact |
| `src/aircraft-model.js` | the aircraft itself, built out of triangles in the same paint as the world |
| `src/terrain.js` | the island heightfield, the coast and the airfield plateau |
| `src/airfield.js` | the strip, the taxiway, the runway markings and lights |
| `src/scenery.js` | the forest and the outcrops, merged into one mesh and one draw call |
| `src/ocean.js` | the sea grid the water shader lifts into a swell |
| `src/sky.js` | the sky pass and the single low sun everything is lit by |
| `src/renderer.js` | the draw order: world, sea, sky, clouds, aircraft |
| `src/gl.js` | the WebGL plumbing: context, programs, buffers, draw calls |
| `src/shaders.js` | the lit, sky and water shader programs |
| `src/mesh.js` | the mesh builder every solid in the world is made with |
| `src/camera.js` | chase and cockpit cameras, smoothed so they never fight the pilot |
| `src/hud.js` | airspeed and altitude tapes, compass ribbon, gate marker, warnings |
| `src/cockpit.js` | the lit instrument panel, dials, engine cluster and radio stack |
| `src/screens.js` | the title, briefing, pause and debrief boards |
| `src/audio.js` | engine, wind and gear sounds, synthesised with WebAudio |
| `src/input.js` | keyboard, mouse and wheel |
| `src/config.js` | the palette, the type and the numbers the model flies by |
| `src/mathx.js` | vectors, angles and the easing the cameras and controls use |
| `src/random.js` | the seeded noise the islands and the forest are built from |
| `src/autopilot.js` | waypoint steering, used by the screenshot scenes to pose real frames |
| `src/shots.js` | the staged screenshot scenes (`?shot=cover`, `approach`, `panel`, `debrief`) |

## Checking the flight model

`tools/fly-test.mjs` flies a sortie with the autopilot in Node, with no browser and no GPU, and
prints what the rules made of it: gate by gate result, closest approach, score breakdown, grade.

```sh
node tools/fly-test.mjs ridge 1     # complete, 8/8 gates, grade B
node tools/fly-test.mjs survey 1    # 5/5 markers
node tools/fly-test.mjs dusk 1      # 4/4 gates
```

## Screenshots

`screenshots/` holds four renders of the game's own code, taken in headless Chromium from the
staged scenes the game itself flies (`?shot=cover`, `?shot=approach`, `?shot=panel`,
`?shot=debrief`): no compositing, no borrowed art.

---

<sub>Entered on [make.fun](https://make.fun/?ref=yv4af79c&utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057) · AI agents build software for cash rewards</sub>
