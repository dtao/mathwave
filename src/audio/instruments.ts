/**
 * The "sound chip": pulse waves at three duty cycles, a triangle, and a noise
 * channel. Everything is synthesized; there are no samples.
 *
 * Works on any BaseAudioContext so the same code renders offline for tuning.
 */
import type { Wave } from './melody';

export interface ToneOptions {
  wave: Wave;
  freq: number;
  time: number;
  dur: number;
  gain: number;
  bend?: number;
  vibrato?: boolean;
  wah?: boolean;
}

const HARMONICS = 48;

function pulseWave(ctx: BaseAudioContext, duty: number): PeriodicWave {
  const real = new Float32Array(HARMONICS + 1);
  const imag = new Float32Array(HARMONICS + 1);
  for (let n = 1; n <= HARMONICS; n++) {
    real[n] = (4 / (n * Math.PI)) * Math.sin(Math.PI * n * duty);
  }
  return ctx.createPeriodicWave(real, imag);
}

export class Instruments {
  private readonly pulses: Record<Exclude<Wave, 'triangle'>, PeriodicWave>;
  private readonly noise: AudioBuffer;

  constructor(readonly ctx: BaseAudioContext) {
    this.pulses = {
      pulse12: pulseWave(ctx, 0.125),
      pulse25: pulseWave(ctx, 0.25),
      pulse50: pulseWave(ctx, 0.5),
    };
    const length = ctx.sampleRate;
    this.noise = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = this.noise.getChannelData(0);
    for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
  }

  /** One pitched note. Returns its oscillator so a phrase can be cut short. */
  tone(dest: AudioNode, o: ToneOptions): OscillatorNode {
    const { ctx } = this;
    const end = o.time + o.dur;
    const osc = ctx.createOscillator();
    if (o.wave === 'triangle') osc.type = 'triangle';
    else osc.setPeriodicWave(this.pulses[o.wave]);
    osc.frequency.setValueAtTime(o.freq, o.time);
    if (o.bend) {
      osc.frequency.setValueAtTime(o.freq, o.time + o.dur * 0.35);
      osc.frequency.exponentialRampToValueAtTime(o.freq * 2 ** (o.bend / 12), end);
    }

    const amp = ctx.createGain();
    amp.gain.value = 0;
    amp.gain.setValueAtTime(0, o.time);
    amp.gain.linearRampToValueAtTime(o.gain, o.time + 0.005);
    amp.gain.linearRampToValueAtTime(o.gain * 0.6, end);
    amp.gain.linearRampToValueAtTime(0, end + 0.03);

    const nodes: AudioNode[] = [osc, amp];
    let lfo: OscillatorNode | null = null;
    if (o.vibrato) {
      lfo = ctx.createOscillator();
      lfo.frequency.value = 5.5;
      const depth = ctx.createGain();
      depth.gain.setValueAtTime(0, o.time);
      depth.gain.linearRampToValueAtTime(o.freq * 0.012, o.time + o.dur * 0.6);
      lfo.connect(depth).connect(osc.frequency);
      lfo.start(o.time);
      nodes.push(lfo, depth);
    }

    if (o.wah) {
      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.Q.value = 3;
      filter.frequency.setValueAtTime(500, o.time);
      filter.frequency.linearRampToValueAtTime(1700, o.time + Math.min(0.06, o.dur / 3));
      filter.frequency.exponentialRampToValueAtTime(420, end);
      osc.connect(filter).connect(amp);
      nodes.push(filter);
    } else {
      osc.connect(amp);
    }
    amp.connect(dest);

    osc.start(o.time);
    osc.stop(end + 0.05);
    osc.onended = () => {
      lfo?.stop();
      for (const node of nodes) node.disconnect();
    };
    return osc;
  }

  /** Kick: a triangle wave pitched down fast. */
  kick(dest: AudioNode, time: number, gain: number): void {
    const { ctx } = this;
    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(210, time);
    osc.frequency.exponentialRampToValueAtTime(48, time + 0.09);
    const amp = ctx.createGain();
    amp.gain.setValueAtTime(gain, time);
    amp.gain.exponentialRampToValueAtTime(0.001, time + 0.17);
    osc.connect(amp).connect(dest);
    osc.start(time);
    osc.stop(time + 0.18);
    osc.onended = () => amp.disconnect();
  }

  private noiseBurst(dest: AudioNode, time: number, gain: number, decay: number, type: BiquadFilterType, freq: number): void {
    const { ctx } = this;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const filter = ctx.createBiquadFilter();
    filter.type = type;
    filter.frequency.value = freq;
    filter.Q.value = 0.7;
    const amp = ctx.createGain();
    amp.gain.setValueAtTime(gain, time);
    amp.gain.exponentialRampToValueAtTime(0.001, time + decay);
    src.connect(filter).connect(amp).connect(dest);
    src.start(time, Math.random() * 0.5);
    src.stop(time + decay + 0.01);
    src.onended = () => amp.disconnect();
  }

  /** Noise-channel hi-hat. */
  hat(dest: AudioNode, time: number, gain: number, open = false): void {
    this.noiseBurst(dest, time, gain, open ? 0.14 : 0.035, 'highpass', 7000);
  }

  /** Noise-channel snare with a little triangle body. */
  snare(dest: AudioNode, time: number, gain: number): void {
    this.noiseBurst(dest, time, gain, 0.11, 'bandpass', 1900);
    const { ctx } = this;
    const osc = ctx.createOscillator();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(220, time);
    osc.frequency.exponentialRampToValueAtTime(120, time + 0.06);
    const amp = ctx.createGain();
    amp.gain.setValueAtTime(gain * 0.6, time);
    amp.gain.exponentialRampToValueAtTime(0.001, time + 0.08);
    osc.connect(amp).connect(dest);
    osc.start(time);
    osc.stop(time + 0.09);
    osc.onended = () => amp.disconnect();
  }
}
