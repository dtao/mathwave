/**
 * Melody generator. Pure data in, pure data out: no Web Audio in here, so it is
 * easy to test and tune. Times are in sixteenth-note steps from the phrase start.
 *
 * See the README ("How an answer becomes a melody") for the mapping in prose.
 */
import { MAJOR_PENTATONIC, scaleNote } from './theory';

export type Wave = 'pulse12' | 'pulse25' | 'pulse50' | 'triangle';

export interface NoteEvent {
  /** Start, in sixteenth-note steps from the start of the phrase. */
  start: number;
  /** Length in sixteenth-note steps. */
  dur: number;
  midi: number;
  wave: Wave;
  gain: number;
  /** Pitch glide over the tail of the note, in semitones (negative = down). */
  bend?: number;
  vibrato?: boolean;
  /** Run the note through a closing low-pass for a muted "wah". */
  wah?: boolean;
}

/** Knobs for tuning the feel of the feedback phrases. */
export const TUNING = {
  /** Pentatonic index 0. C4. */
  root: 60,
  /** Pentatonic index every correct melody resolves to. 10 = C6, two octaves up. */
  top: 10,
  /** The rise never starts above this index, so there is always room to climb. */
  riseCeiling: 6,
  finalDur: 6,
  finalDurWithFlourish: 8,
  leadGain: 0.8,
  echoGain: 0.22,
  harmonyGain: 0.3,
  flourishGain: 0.3,
  /** Streak length that earns the arpeggio, and the one that earns a second sweep. */
  flourishStreak: 5,
  doubleFlourishStreak: 10,
};

const pent = (index: number): number => scaleNote(TUNING.root, MAJOR_PENTATONIC, index);

/** The pentatonic indices (not yet rhythm) a correct answer plays, ending on the top tonic. */
export function correctContour(answer: number): { motif: number[]; rise: number[]; top: number } {
  const digits = String(Math.abs(Math.trunc(answer))).split('').map(Number);
  // Each digit 0-9 is a pentatonic index: 0=C4 1=D4 2=E4 3=G4 4=A4 5=C5 ... 9=A5.
  let motif = digits;
  if (motif.length === 1) {
    // A lone digit gets a partner a skip away so the motif is never one note.
    const d = motif[0];
    motif = [d, d <= 7 ? d + 2 : d - 2];
  }
  const last = motif[motif.length - 1];
  const from = Math.min(last, TUNING.riseCeiling);
  const span = TUNING.top - from;
  const rise = [1, 2].map((k) => Math.round(from + (span * k) / 3));
  return { motif, rise, top: TUNING.top };
}

/**
 * Triumphant phrase for a correct answer. Deterministic: the same answer (and
 * the same streak tier) always produces the same notes.
 */
export function correctMelody(answer: number, streak = 0): NoteEvent[] {
  const { motif, rise, top } = correctContour(answer);
  const rhythm = Math.abs(Math.trunc(answer)) % 3;
  const flourish = streak >= TUNING.flourishStreak;

  const lead: { start: number; dur: number; index: number }[] = [];
  let t = 0;
  motif.forEach((index, i) => {
    // 0: straight eighths.  1: dotted "gallop".  2: quick sixteenths.
    const dur = rhythm === 0 ? 2 : rhythm === 1 ? (i % 2 === 0 ? 3 : 1) : 1;
    lead.push({ start: t, dur, index });
    t += dur;
  });
  if (rhythm === 2) t += t % 2 === 0 ? 2 : 1; // a breath, landing back on an eighth
  const riseDur = rhythm === 2 ? 2 : 1;
  for (const index of rise) {
    lead.push({ start: t, dur: riseDur, index });
    t += riseDur;
  }
  const finalStart = t;
  const finalDur = flourish ? TUNING.finalDurWithFlourish : TUNING.finalDur;
  lead.push({ start: finalStart, dur: finalDur, index: top });

  const notes: NoteEvent[] = [];
  for (const n of lead) {
    const midi = pent(n.index);
    notes.push({ start: n.start, dur: n.dur * 0.9, midi, wave: 'pulse25', gain: TUNING.leadGain });
    // Classic two-channel echo: same note, one sixteenth late, thin and quiet.
    notes.push({ start: n.start + 1, dur: n.dur * 0.9, midi, wave: 'pulse12', gain: TUNING.echoGain });
  }
  // "Ta-da": fill in the tonic triad under the resolving note.
  for (const index of [top - 2, top - 3]) {
    notes.push({ start: finalStart, dur: finalDur * 0.9, midi: pent(index), wave: 'pulse50', gain: TUNING.harmonyGain });
  }
  notes.push({ start: finalStart, dur: finalDur * 0.9, midi: pent(top) - 24, wave: 'triangle', gain: 0.6 });

  if (flourish) {
    const sweep = [0, 4, 7, 12, 16, 19, 24].map((semis) => pent(top) - 12 + semis);
    const sweeps = streak >= TUNING.doubleFlourishStreak ? 2 : 1;
    let ft = finalStart + (sweeps === 2 ? 1 : 2);
    for (let s = 0; s < sweeps; s++) {
      sweep.forEach((midi, i) => {
        const lastNote = i === sweep.length - 1 && s === sweeps - 1;
        notes.push({ start: ft, dur: lastNote ? 1.5 : 0.45, midi, wave: 'pulse12', gain: TUNING.flourishGain });
        ft += 0.5;
      });
    }
  }
  return notes;
}

/** Descending minor figures in C minor. Each ends on a long, drooping note. */
const WRONG_SHAPES: number[][] = [
  [67, 65, 63, 60], // G F Eb C
  [63, 62, 61, 60], // Eb D Db C: the chromatic "wah wah wah wahhh"
  [72, 70, 68, 67], // C Bb Ab G: ends unresolved on the fifth
  [65, 63, 62, 60], // F Eb D C
];
export const WRONG_VARIANTS = WRONG_SHAPES.length;

/** Short sad phrase. `variant` cycles through the shapes so repeats don't grate. */
export function wrongPhrase(variant = 0): NoteEvent[] {
  const shape = WRONG_SHAPES[((variant % WRONG_VARIANTS) + WRONG_VARIANTS) % WRONG_VARIANTS];
  const notes: NoteEvent[] = [];
  shape.forEach((midi, i) => {
    const last = i === shape.length - 1;
    const base = {
      start: i * 2,
      dur: last ? 5 : 1.7,
      midi,
      bend: last ? -1.5 : -0.5,
      vibrato: last,
    };
    notes.push({ ...base, wave: 'pulse50', gain: 0.45, wah: true });
    notes.push({ ...base, wave: 'triangle', gain: 0.55 });
  });
  return notes;
}
