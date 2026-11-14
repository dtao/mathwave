/**
 * Live audio engine: owns the AudioContext and the look-ahead clock, and is the
 * only audio API the UI talks to.
 */
import { Instruments } from './instruments';
import { correctMelody, wrongPhrase, type NoteEvent } from './melody';
import {
  beatGain,
  buildGraph,
  cutPhrase,
  melodyGain,
  nextEighth,
  scheduleBeatStep,
  schedulePhrase,
  stepDuration,
  type AudioGraph,
  type Mode,
  type PhraseHandle,
} from './sequencer';

export interface AudioSettings {
  muted: boolean;
  /** 0-1 slider positions. */
  beatVolume: number;
  melodyVolume: number;
}

/** How far ahead of the audio clock we schedule, and how often we top up. */
const LOOKAHEAD_S = 0.12;
const TICK_MS = 25;
/** Smallest gap between "now" and a quantized phrase start. */
const MIN_LEAD_S = 0.03;

type BeatListener = (beat: number) => void;

export class AudioEngine {
  private ctx: AudioContext | null = null;
  private graph: AudioGraph | null = null;
  private inst: Instruments | null = null;
  private settings: AudioSettings = { muted: false, beatVolume: 0.7, melodyVolume: 0.8 };

  private readonly stepDur = stepDuration();
  private timer: ReturnType<typeof setInterval> | null = null;
  private suspendTimer: ReturnType<typeof setTimeout> | null = null;
  private raf = 0;
  private gridStart = 0;
  private step = 0;
  private mode: Mode = 'major';
  private pendingMode: { time: number; mode: Mode } | null = null;
  private phrase: PhraseHandle | null = null;
  private misses = 0;

  private beatQueue: { time: number; beat: number }[] = [];
  private readonly listeners = new Set<BeatListener>();

  constructor() {
    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', () => {
        if (!this.ctx) return;
        if (document.hidden) void this.ctx.suspend();
        else if (this.timer !== null || this.suspendTimer !== null) void this.ctx.resume();
      });
    }
  }

  get running(): boolean {
    return this.timer !== null;
  }

  /**
   * Start the beat. Must be called synchronously from a tap/click handler:
   * that is what unlocks audio on iOS.
   */
  start(): void {
    const ctx = this.ensureContext();
    void ctx.resume();
    // Older iOS only unlocks once a source has actually been started in the gesture.
    const blip = ctx.createBufferSource();
    blip.buffer = ctx.createBuffer(1, 1, ctx.sampleRate);
    blip.connect(ctx.destination);
    blip.start();

    this.clearTimers();
    this.gridStart = ctx.currentTime + 0.12;
    this.step = 0;
    this.mode = 'major';
    this.pendingMode = null;
    this.misses = 0;
    this.beatQueue = [];
    this.timer = setInterval(() => this.tick(), TICK_MS);
    this.tick();
    const frame = () => {
      this.dispatchBeats();
      this.raf = requestAnimationFrame(frame);
    };
    this.raf = requestAnimationFrame(frame);
  }

  /** Stop the beat. Anything already playing (the last melody) rings out. */
  stop(): void {
    this.clearTimers();
    this.beatQueue = [];
    this.suspendTimer = setTimeout(() => {
      this.suspendTimer = null;
      void this.ctx?.suspend();
    }, 4000);
  }

  /** Correct answer: triumphant melody on the next eighth note, bass back to major. */
  correct(answer: number, streak: number): void {
    this.feedback(correctMelody(answer, streak), 'major');
  }

  /** Wrong answer: sad phrase on the next eighth note, bass turns minor. */
  wrong(): void {
    this.feedback(wrongPhrase(this.misses++), 'minor');
  }

  /** Subscribe to quarter-note beats (for the tempo LEDs). Returns an unsubscribe. */
  onBeat(listener: BeatListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  applySettings(settings: AudioSettings): void {
    this.settings = settings;
    if (!this.ctx || !this.graph) return;
    const t = this.ctx.currentTime;
    this.graph.master.gain.setTargetAtTime(settings.muted ? 0 : 1, t, 0.015);
    this.graph.beat.gain.setTargetAtTime(beatGain(settings.beatVolume), t, 0.015);
    this.graph.melody.gain.setTargetAtTime(melodyGain(settings.melodyVolume), t, 0.015);
  }

  private ensureContext(): AudioContext {
    if (this.ctx) return this.ctx;
    const Ctor: typeof AudioContext =
      window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new Ctor({ latencyHint: 'interactive' });
    // Ask iOS to treat us like a game/media app so the ring/silent switch doesn't mute the beat.
    const session = (navigator as unknown as { audioSession?: { type: string } }).audioSession;
    if (session) {
      try {
        session.type = 'playback';
      } catch {
        // not supported; fine
      }
    }
    this.ctx = ctx;
    this.graph = buildGraph(ctx);
    this.inst = new Instruments(ctx);
    this.graph.master.gain.value = this.settings.muted ? 0 : 1;
    this.graph.beat.gain.value = beatGain(this.settings.beatVolume);
    this.graph.melody.gain.value = melodyGain(this.settings.melodyVolume);
    return ctx;
  }

  private clearTimers(): void {
    if (this.timer !== null) clearInterval(this.timer);
    if (this.suspendTimer !== null) clearTimeout(this.suspendTimer);
    cancelAnimationFrame(this.raf);
    this.timer = null;
    this.suspendTimer = null;
  }

  private stepTime(step: number): number {
    return this.gridStart + step * this.stepDur;
  }

  /** Schedule every step that falls inside the look-ahead window. */
  private tick(): void {
    const { ctx, graph, inst } = this;
    if (!ctx || !graph || !inst) return;
    const now = ctx.currentTime;
    // If timers were throttled, skip what we missed but stay on the grid.
    while (this.stepTime(this.step) < now - 0.02) this.step++;
    while (this.stepTime(this.step) < now + LOOKAHEAD_S) {
      const time = this.stepTime(this.step);
      if (this.pendingMode && time >= this.pendingMode.time - 1e-4) {
        this.mode = this.pendingMode.mode;
        this.pendingMode = null;
      }
      scheduleBeatStep(inst, graph.beat, this.step, time, this.mode, this.stepDur);
      if (this.step % 4 === 0) this.beatQueue.push({ time, beat: this.step / 4 });
      this.step++;
    }
  }

  private feedback(notes: NoteEvent[], mode: Mode): void {
    const { ctx, graph, inst } = this;
    if (!ctx || !graph || !inst || !this.running) return;
    const start = nextEighth(ctx.currentTime + MIN_LEAD_S, this.gridStart, this.stepDur);
    if (this.phrase) cutPhrase(this.phrase, start);
    this.phrase = schedulePhrase(inst, graph.melody, notes, start, this.stepDur);
    this.pendingMode = { time: start, mode };
  }

  private dispatchBeats(): void {
    if (!this.ctx) return;
    const heard = this.ctx.currentTime - (this.ctx.outputLatency || 0);
    while (this.beatQueue.length && this.beatQueue[0].time <= heard) {
      const { beat } = this.beatQueue.shift()!;
      for (const listener of this.listeners) listener(beat);
    }
  }
}

export const engine = new AudioEngine();
