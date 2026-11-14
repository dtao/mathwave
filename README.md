# mathwave

Flash cards with a beat. A mobile web app for practicing math facts: a chiptune loop plays the whole session, a right answer earns a short triumphant melody, and a wrong one gets a gentle sad phrase. Every sound is synthesized with the Web Audio API; there are no audio files and no backend.

## Run it

```sh
npm install
npm run dev      # http://localhost:5173 (add --host to try it on a phone)
npm test         # unit tests for the melody generator, quantizing, stats and session logic
npm run build    # type-check and build to dist/
npm run preview  # serve the build; the service worker only registers in a production build
```

Installing to a home screen needs HTTPS (or localhost).

## Deploy

Every push to `main` runs the tests, builds, and publishes `dist/` to GitHub Pages (`.github/workflows/deploy.yml`). One-time setup: in the repository's Settings -> Pages, set Source to "GitHub Actions".

## Layout

```
src/audio/   the audio engine; no React in here
  theory.ts       note frequencies and scales
  instruments.ts  the "sound chip": 12.5/25/50% pulse waves, triangle, noise hats/snare, kick
  melody.ts       answer -> notes. Pure data, no Web Audio. Tune the feedback here.
  sequencer.ts    drum + bass pattern, beat-grid maths, phrase scheduling, mixer graph
  engine.ts       live engine: AudioContext, look-ahead clock, start/stop/correct/wrong
  offline.ts      renders the same code to a WAV for tuning
src/game/    facts, per-fact stats (localStorage), session queue, settings
src/ui/      React screens and the stylesheet
public/      manifest, service worker, icons
```

The UI only calls `engine.start()`, `engine.stop()`, `engine.correct(answer, streak)`, `engine.wrong()`, `engine.applySettings()` and `engine.onBeat()`.

## How the music works

**Beat.** 110 BPM in C, sequenced in sixteenth-note steps by a look-ahead scheduler (a 25 ms timer schedules everything in the next 120 ms on the audio clock, so timing does not depend on JavaScript timers). Kick on beats 1 and 3, noise snare on 2 and 4, noise hats on the eighths, and a triangle bass playing a four-bar I-vi-IV-V loop.

**Quantizing.** When an answer is submitted the engine finds the next eighth-note boundary on the beat grid (at least 30 ms away) and starts the phrase there, so feedback lands in time and never waits more than about 0.3 s. A new phrase cuts off the previous one, so fast answers don't pile up.

**Major and minor.** The bass is written in scale degrees. After a miss it reads them from C harmonic minor (flat 3rd and 6th) starting on the beat where the sad phrase begins; the next correct answer switches it back to major.

### How an answer becomes a melody

All of this is in `correctMelody()` in `src/audio/melody.ts`, with the knobs collected in `TUNING` at the top of the file.

1. **Digits pick the notes.** Each digit of the answer is an index into the C major pentatonic scale starting at C4:

   | digit | 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 |
   |-------|----|----|----|----|----|----|----|----|----|----|
   | note  | C4 | D4 | E4 | G4 | A4 | C5 | D5 | E5 | G5 | A5 |

   These are the *motif*. 56 opens C5 D5; 54 opens C5 A4. A one-digit answer gets a second note two scale steps away (two steps down for 8 and 9) so it is never a single note.
2. **The rise.** From the last motif note (capped at D5 so there is always room to climb), two notes step evenly up toward the target.
3. **The resolution.** Every melody ends on a held C6 with the rest of the C major chord underneath: the "ta-da".
4. **Answer mod 3 picks the rhythm.** 0: straight eighths. 1: a dotted "gallop". 2: quick sixteenths, a breath, then a slower rise. So two answers that share digits (45 and 54) still differ in rhythm as well as order.
5. **Echo.** Each lead note (25% pulse) repeats one sixteenth later on a quiet 12.5% pulse.
6. **Streaks.** At 5 in a row the final note is held longer and a fast 12.5% pulse arpeggio sweeps up over it; at 10 it sweeps twice.

Worked example, 56: digits 5, 6 give C5 D5; the rise from D5 gives E5 A5; then C6. 56 mod 3 = 2, so: two sixteenths, a rest, two eighths, and the long final note.

The melody depends only on the answer and the streak tier, so 56 always sounds the same.

**Things to try when tuning**

- `TUNING.root`: transpose every melody (also change `BASS_ROOT` in `sequencer.ts` to keep the key).
- `TUNING.top` / `riseCeiling`: how high the resolution is and how big the final climb can be.
- Swap `MAJOR_PENTATONIC` for another scale in `pent()`, or replace `digits` with something like `answer % 7`, to change which answers sound alike.
- The rhythm table is the single `dur` expression inside `correctMelody()`.
- Gains for lead, echo, harmony and flourish are in `TUNING`; overall bus levels are `beatGain` / `melodyGain` in `sequencer.ts`.

**Wrong phrases** come from `wrongPhrase()`: four descending C minor shapes that cycle so the same one never plays twice in a row. Each note droops half a semitone, and the last one is long, bends down a semitone and a half with vibrato, and runs through a closing low-pass filter for a muted "wah".

### Hearing changes quickly

With `npm run dev` running, open the browser console and run:

```js
await mathwaveDemo()
```

It renders 12 bars of the beat with a scripted run of right and wrong answers (edit `DEFAULT_DEMO` in `src/audio/offline.ts`) through the same instruments and scheduling as the live engine, and downloads `mathwave-demo.wav`.

## Game rules

- Pick an operation and the numbers to practice. For subtraction and division the picked number is the one taken away or divided by (the 7s are `15 - 7`, `56 ÷ 7`), so they are the inverse of the addition and multiplication tables.
- A missed fact comes back after 3 other problems (`REQUEUE_GAP` in `src/game/session.ts`). Retries count toward the session length.
- Problems are picked at random, weighted toward facts that are new, recently missed or slow (`selectionWeight` in `src/game/stats.ts`).
- Mastery (the colors in the progress grid) is based on the last 5 attempts at a fact: under 50% right is "tricky", under 80% "learning", otherwise "good", and "mastered" once it has been right at least 3 times recently with an average under 4 seconds.

Stats live in `localStorage` under `mathwave:stats:v1`, settings under `mathwave:settings:v1`.
