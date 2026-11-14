import { describe, expect, it } from 'vitest';
import { correctContour, correctMelody, wrongPhrase, WRONG_VARIANTS } from '../audio/melody';
import { nextEighth, stepDuration } from '../audio/sequencer';
import { buildPool, factAnswer, factKey, factOperands } from './facts';
import { REQUEUE_GAP, Session } from './session';
import { mastery, recordAttempt, selectionWeight, type StatsMap } from './stats';

/** Small deterministic PRNG so session tests are repeatable. */
function seeded(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 2 ** 32;
    return s / 2 ** 32;
  };
}

describe('melody', () => {
  it('is deterministic per answer and differs between answers', () => {
    expect(correctMelody(56, 0)).toEqual(correctMelody(56, 0));
    expect(correctMelody(56, 0)).not.toEqual(correctMelody(54, 0));
  });

  it('always resolves upward onto the top tonic', () => {
    for (let answer = 0; answer <= 144; answer++) {
      const { motif, rise, top } = correctContour(answer);
      expect(rise[0]).toBeLessThanOrEqual(rise[1]);
      expect(rise[1]).toBeLessThan(top);
      expect(Math.max(...motif)).toBeLessThan(top);
      const notes = correctMelody(answer, 12);
      const end = Math.max(...notes.map((n) => n.start + n.dur));
      expect(end).toBeLessThanOrEqual(32); // never longer than two bars
    }
  });

  it('adds a flourish on a streak of 5+', () => {
    expect(correctMelody(42, 5).length).toBeGreaterThan(correctMelody(42, 4).length);
  });

  it('cycles through wrong-phrase variants, all descending', () => {
    expect(wrongPhrase(0)).not.toEqual(wrongPhrase(1));
    expect(wrongPhrase(0)).toEqual(wrongPhrase(WRONG_VARIANTS));
    for (let v = 0; v < WRONG_VARIANTS; v++) {
      const pitches = wrongPhrase(v).filter((n) => n.wave === 'triangle').map((n) => n.midi);
      expect([...pitches].sort((a, b) => b - a)).toEqual(pitches);
    }
  });
});

describe('quantizing', () => {
  it('snaps to the next eighth note on the grid', () => {
    const step = stepDuration();
    const eighth = step * 2;
    expect(nextEighth(10 + eighth * 3.2, 10, step)).toBeCloseTo(10 + eighth * 4);
    expect(nextEighth(10 + eighth * 4, 10, step)).toBeCloseTo(10 + eighth * 4);
    expect(nextEighth(9, 10, step)).toBe(10);
  });
});

describe('facts', () => {
  it('builds inverse facts for subtraction and division', () => {
    expect(factOperands({ op: 'sub', table: 7, other: 8 })).toEqual([15, 7]);
    expect(factAnswer({ op: 'sub', table: 7, other: 8 })).toBe(8);
    expect(factOperands({ op: 'div', table: 7, other: 8 })).toEqual([56, 7]);
    expect(buildPool('div', [0, 3]).every((f) => f.table === 3)).toBe(true);
    expect(buildPool('mul', [3, 4, 7])).toHaveLength(39);
  });
});

describe('stats', () => {
  it('weights weak facts above mastered ones', () => {
    const stats: StatsMap = {};
    for (let i = 0; i < 4; i++) recordAttempt(stats, 'strong', true, 1500);
    for (let i = 0; i < 4; i++) recordAttempt(stats, 'weak', i === 0, 6000);
    expect(mastery(stats.strong)).toBe(4);
    expect(mastery(stats.weak)).toBe(1);
    expect(selectionWeight(stats.weak)).toBeGreaterThan(selectionWeight(undefined));
    expect(selectionWeight(undefined)).toBeGreaterThan(selectionWeight(stats.strong));
  });
});

describe('session', () => {
  it('brings a missed fact back a few problems later', () => {
    const session = new Session(buildPool('mul', [3, 4, 7]), 20, {}, seeded(1), () => {});
    const missed = session.next()!;
    session.submit(-1, 1000);
    const seen: string[] = [];
    for (let i = 0; i < REQUEUE_GAP + 1; i++) {
      const p = session.next()!;
      seen.push(factKey(p.fact));
      session.submit(p.answer, 1000);
    }
    expect(seen.slice(0, REQUEUE_GAP)).not.toContain(factKey(missed.fact));
    expect(seen[REQUEUE_GAP]).toBe(factKey(missed.fact));
  });

  it('ends after the configured number of problems and summarizes', () => {
    const session = new Session(buildPool('add', [5]), 10, {}, seeded(2), () => {});
    let p = session.next();
    let n = 0;
    while (p) {
      session.submit(n % 5 === 0 ? -1 : p.answer, 2000);
      n++;
      p = session.next();
    }
    const summary = session.summary();
    expect(n).toBe(10);
    expect(summary.total).toBe(10);
    expect(summary.correct).toBe(8);
    expect(summary.averageMs).toBe(2000);
    expect(summary.missed.length).toBeGreaterThan(0);
  });

  it('favours weak facts over many picks', () => {
    const stats: StatsMap = {};
    const pool = buildPool('mul', [2]);
    for (const f of pool) for (let i = 0; i < 4; i++) recordAttempt(stats, factKey(f), true, 1000);
    const weak = factKey(pool[7]);
    stats[weak] = { attempts: 4, correct: 0, totalMs: 32000, recent: '0000' };
    const counts = new Map<string, number>();
    const session = new Session(pool, 400, structuredClone(stats), seeded(3), () => {});
    // Fresh stats each pick so the weak fact stays weak for the whole run.
    for (let i = 0; i < 400; i++) {
      const p = session.next()!;
      counts.set(factKey(p.fact), (counts.get(factKey(p.fact)) ?? 0) + 1);
      session.submit(p.answer, 1000);
      Object.assign((session as unknown as { stats: StatsMap }).stats, structuredClone(stats));
    }
    const others = [...counts.entries()].filter(([k]) => k !== weak).map(([, c]) => c);
    expect(counts.get(weak)!).toBeGreaterThan(Math.max(...others));
  });
});
