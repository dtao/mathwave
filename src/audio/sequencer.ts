/**
 * What gets played when: the drum/bass pattern, phrase scheduling, and the
 * beat-grid maths. Nothing here owns a clock; the engine (live) and the offline
 * renderer both call into these with explicit times.
 */
import type { Instruments } from './instruments';
import type { NoteEvent } from './melody';
import { MAJOR, MINOR_COLOR, midiToFreq, scaleNote } from './theory';

export const BPM = 110;
export const STEPS_PER_BAR = 16;
/** Length of one sixteenth-note step in seconds. */
export const stepDuration = (bpm = BPM): number => 60 / bpm / 4;

export type Mode = 'major' | 'minor';

/** C3. The loop is I-vi-IV-V, written as scale degrees so the mode can recolour it. */
const BASS_ROOT = 48;
const PROGRESSION = [0, -2, -4, -3];
/** Eighth-note bass figures, in scale degrees above the chord root (7 = octave). */
const BASS_BAR = [0, 7, 0, 7, 0, 7, 2, 4];
const BASS_TURNAROUND = [0, 7, 0, 7, 0, 0, 1, 2];

/** Schedule every drum and bass event that falls on one sixteenth-note step. */
export function scheduleBeatStep(inst: Instruments, dest: AudioNode, step: number, time: number, mode: Mode, stepDur: number): void {
  const s = step % STEPS_PER_BAR;
  const bar = Math.floor(step / STEPS_PER_BAR);
  const barInLoop = bar % PROGRESSION.length;

  if (s === 0 || s === 8) inst.kick(dest, time, 0.9);
  else if (s === 10 && bar % 2 === 1) inst.kick(dest, time, 0.55);

  if (s === 4 || s === 12) inst.snare(dest, time, 0.45);
  else if (barInLoop === 3 && s >= 14) inst.snare(dest, time, 0.25);

  if (s % 2 === 0) inst.hat(dest, time, s % 4 === 2 ? 0.2 : 0.13, s === 14 && bar % 2 === 0);
  else if (s % 4 === 3 && bar % 2 === 1) inst.hat(dest, time, 0.07);

  if (s % 2 === 0) {
    const scale = mode === 'major' ? MAJOR : MINOR_COLOR;
    const figure = barInLoop === 3 ? BASS_TURNAROUND : BASS_BAR;
    const freq = midiToFreq(scaleNote(BASS_ROOT, scale, PROGRESSION[barInLoop] + figure[s / 2]));
    inst.tone(dest, { wave: 'triangle', freq, time, dur: stepDur * 1.7, gain: 0.55 });
    // A whisper of pulse on top so the bass still reads on phone speakers.
    inst.tone(dest, { wave: 'pulse25', freq, time, dur: stepDur * 1.2, gain: 0.06 });
  }
}

/** The first eighth-note boundary at or after `now`, on the grid that began at `gridStart`. */
export function nextEighth(now: number, gridStart: number, stepDur: number): number {
  const eighth = stepDur * 2;
  const n = Math.max(0, Math.ceil((now - gridStart) / eighth - 1e-9));
  return gridStart + n * eighth;
}

export interface PhraseHandle {
  gain: GainNode;
  oscs: OscillatorNode[];
}

/** Schedule a melody phrase starting at `startTime`. */
export function schedulePhrase(inst: Instruments, dest: AudioNode, notes: NoteEvent[], startTime: number, stepDur: number): PhraseHandle {
  const gain = inst.ctx.createGain();
  gain.connect(dest);
  let remaining = notes.length;
  const oscs = notes.map((n) => {
    const osc = inst.tone(gain, {
      wave: n.wave,
      freq: midiToFreq(n.midi),
      time: startTime + n.start * stepDur,
      dur: n.dur * stepDur,
      gain: n.gain,
      bend: n.bend,
      vibrato: n.vibrato,
      wah: n.wah,
    });
    osc.addEventListener('ended', () => {
      if (--remaining === 0) gain.disconnect();
    });
    return osc;
  });
  return { gain, oscs };
}

/** Fade a phrase out at `time` so a new one can take over the lead voice. */
export function cutPhrase(phrase: PhraseHandle, time: number): void {
  phrase.gain.gain.setTargetAtTime(0, time, 0.01);
  for (const osc of phrase.oscs) {
    try {
      osc.stop(time + 0.08);
    } catch {
      // already finished
    }
  }
}

export interface AudioGraph {
  master: GainNode;
  beat: GainNode;
  melody: GainNode;
}

/** beat + melody buses -> master (mute) -> limiter -> speakers. */
export function buildGraph(ctx: BaseAudioContext): AudioGraph {
  const limiter = ctx.createDynamicsCompressor();
  limiter.threshold.value = -8;
  limiter.knee.value = 6;
  limiter.ratio.value = 12;
  limiter.attack.value = 0.003;
  limiter.release.value = 0.12;
  limiter.connect(ctx.destination);
  const master = ctx.createGain();
  master.connect(limiter);
  const beat = ctx.createGain();
  const melody = ctx.createGain();
  beat.connect(master);
  melody.connect(master);
  return { master, beat, melody };
}

/** Slider position (0-1) to bus gain. Squared so the slider feels even. */
export const beatGain = (volume: number): number => 0.55 * volume * volume;
export const melodyGain = (volume: number): number => 0.42 * volume * volume;
