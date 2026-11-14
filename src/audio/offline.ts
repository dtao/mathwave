/**
 * Tuning aid: renders the beat plus a scripted run of answers through the exact
 * same instruments and scheduling code as the live engine, and returns a WAV.
 *
 * In dev, call `await mathwaveDemo()` from the browser console to download it.
 */
import { Instruments } from './instruments';
import { correctMelody, wrongPhrase, type NoteEvent } from './melody';
import {
  STEPS_PER_BAR,
  beatGain,
  buildGraph,
  melodyGain,
  nextEighth,
  scheduleBeatStep,
  schedulePhrase,
  cutPhrase,
  stepDuration,
  type Mode,
  type PhraseHandle,
} from './sequencer';

export interface DemoEvent {
  /** When the player "submits", in seconds. Deliberately off the grid. */
  at: number;
  kind: 'correct' | 'wrong';
  answer?: number;
  streak?: number;
}

export const DEFAULT_DEMO: DemoEvent[] = [
  { at: 2.31, kind: 'correct', answer: 56, streak: 1 },
  { at: 4.87, kind: 'correct', answer: 54, streak: 2 },
  { at: 7.4, kind: 'wrong' },
  { at: 11.93, kind: 'correct', answer: 12, streak: 1 },
  { at: 14.5, kind: 'correct', answer: 7, streak: 5 },
  { at: 17.77, kind: 'wrong' },
  { at: 21.2, kind: 'correct', answer: 144, streak: 10 },
];

export interface DemoRender {
  buffer: AudioBuffer;
  /** Where each phrase actually started after quantizing. */
  starts: number[];
  stepDur: number;
}

export async function renderDemo(events: DemoEvent[] = DEFAULT_DEMO, bars = 12, opts = { beat: 0.7, melody: 0.8 }): Promise<DemoRender> {
  const stepDur = stepDuration();
  const sampleRate = 44100;
  const seconds = bars * STEPS_PER_BAR * stepDur + 1;
  const ctx = new OfflineAudioContext(1, Math.ceil(seconds * sampleRate), sampleRate);
  const graph = buildGraph(ctx);
  graph.beat.gain.value = beatGain(opts.beat);
  graph.melody.gain.value = melodyGain(opts.melody);
  const inst = new Instruments(ctx);

  const modeChanges: { time: number; mode: Mode }[] = [];
  const starts: number[] = [];
  let phrase: PhraseHandle | null = null;
  let misses = 0;
  for (const e of events) {
    const start = nextEighth(e.at + 0.03, 0, stepDur);
    const notes: NoteEvent[] = e.kind === 'correct' ? correctMelody(e.answer ?? 0, e.streak ?? 0) : wrongPhrase(misses++);
    if (phrase) cutPhrase(phrase, start);
    phrase = schedulePhrase(inst, graph.melody, notes, start, stepDur);
    modeChanges.push({ time: start, mode: e.kind === 'correct' ? 'major' : 'minor' });
    starts.push(start);
  }

  for (let step = 0; step < bars * STEPS_PER_BAR; step++) {
    const time = step * stepDur;
    let mode: Mode = 'major';
    for (const change of modeChanges) if (time >= change.time - 1e-4) mode = change.mode;
    scheduleBeatStep(inst, graph.beat, step, time, mode, stepDur);
  }
  return { buffer: await ctx.startRendering(), starts, stepDur };
}

export function encodeWav(buffer: AudioBuffer): Blob {
  const data = buffer.getChannelData(0);
  const bytes = new DataView(new ArrayBuffer(44 + data.length * 2));
  const text = (offset: number, s: string) => [...s].forEach((c, i) => bytes.setUint8(offset + i, c.charCodeAt(0)));
  text(0, 'RIFF');
  bytes.setUint32(4, 36 + data.length * 2, true);
  text(8, 'WAVEfmt ');
  bytes.setUint32(16, 16, true);
  bytes.setUint16(20, 1, true);
  bytes.setUint16(22, 1, true);
  bytes.setUint32(24, buffer.sampleRate, true);
  bytes.setUint32(28, buffer.sampleRate * 2, true);
  bytes.setUint16(32, 2, true);
  bytes.setUint16(34, 16, true);
  text(36, 'data');
  bytes.setUint32(40, data.length * 2, true);
  for (let i = 0; i < data.length; i++) {
    bytes.setInt16(44 + i * 2, Math.max(-1, Math.min(1, data[i])) * 0x7fff, true);
  }
  return new Blob([bytes], { type: 'audio/wav' });
}

/** Render the demo and download it as mathwave-demo.wav. */
export async function downloadDemo(events?: DemoEvent[]): Promise<void> {
  const { buffer } = await renderDemo(events);
  const a = document.createElement('a');
  a.href = URL.createObjectURL(encodeWav(buffer));
  a.download = 'mathwave-demo.wav';
  a.click();
}
