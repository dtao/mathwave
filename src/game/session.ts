import { OP_SYMBOL, factAnswer, factKey, factOperands, factText, type Fact } from './facts';
import { recordAttempt, saveStats, selectionWeight, type StatsMap } from './stats';

export interface Problem {
  fact: Fact;
  a: number;
  b: number;
  symbol: string;
  answer: number;
}

export interface MissedFact {
  text: string;
  answer: number;
  misses: number;
}

export interface Summary {
  total: number;
  correct: number;
  /** 0-1 */
  accuracy: number;
  averageMs: number;
  bestStreak: number;
  missed: MissedFact[];
}

/** A missed fact comes back after this many other problems. */
export const REQUEUE_GAP = 3;

export class Session {
  answered = 0;
  streak = 0;
  bestStreak = 0;
  current: Problem | null = null;

  private correctCount = 0;
  private totalMs = 0;
  private readonly misses = new Map<string, { fact: Fact; misses: number }>();
  private retries: { fact: Fact; due: number }[] = [];
  private recentKeys: string[] = [];

  constructor(
    private readonly pool: Fact[],
    readonly length: number,
    private readonly stats: StatsMap,
    private readonly rng: () => number = Math.random,
    private readonly persist: (stats: StatsMap) => void = saveStats,
  ) {
    if (pool.length === 0) throw new Error('Session needs at least one fact');
  }

  /** Advance to the next problem, or null when the session is over. */
  next(): Problem | null {
    if (this.answered >= this.length) return (this.current = null);
    const fact = this.pick();
    this.recentKeys = [...this.recentKeys, factKey(fact)].slice(-2);
    let [a, b] = factOperands(fact);
    if ((fact.op === 'mul' || fact.op === 'add') && this.rng() < 0.5) [a, b] = [b, a];
    return (this.current = { fact, a, b, symbol: OP_SYMBOL[fact.op], answer: factAnswer(fact) });
  }

  submit(given: number, ms: number): { correct: boolean; answer: number } {
    const problem = this.current;
    if (!problem) throw new Error('No current problem');
    const correct = given === problem.answer;
    const key = factKey(problem.fact);
    recordAttempt(this.stats, key, correct, ms);
    this.persist(this.stats);
    this.totalMs += ms;
    if (correct) {
      this.correctCount++;
      this.streak++;
      this.bestStreak = Math.max(this.bestStreak, this.streak);
    } else {
      this.streak = 0;
      const entry = this.misses.get(key) ?? { fact: problem.fact, misses: 0 };
      entry.misses++;
      this.misses.set(key, entry);
      this.retries.push({ fact: problem.fact, due: this.answered + 1 + REQUEUE_GAP });
    }
    this.answered++;
    return { correct, answer: problem.answer };
  }

  summary(): Summary {
    const missed = [...this.misses.values()]
      .sort((x, y) => y.misses - x.misses)
      .slice(0, 5)
      .map(({ fact, misses }) => ({ text: factText(fact), answer: factAnswer(fact), misses }));
    return {
      total: this.answered,
      correct: this.correctCount,
      accuracy: this.answered ? this.correctCount / this.answered : 0,
      averageMs: this.answered ? this.totalMs / this.answered : 0,
      bestStreak: this.bestStreak,
      missed,
    };
  }

  private pick(): Fact {
    const dueIndex = this.retries.findIndex((r) => r.due <= this.answered);
    if (dueIndex >= 0) return this.retries.splice(dueIndex, 1)[0].fact;

    // Avoid immediate repeats and facts already waiting to come back, when there is a choice.
    const waiting = new Set(this.retries.map((r) => factKey(r.fact)));
    let candidates = this.pool.filter((f) => !this.recentKeys.includes(factKey(f)) && !waiting.has(factKey(f)));
    if (candidates.length === 0) candidates = this.pool.filter((f) => factKey(f) !== this.recentKeys.at(-1));
    if (candidates.length === 0) candidates = this.pool;

    const weights = candidates.map((f) => selectionWeight(this.stats[factKey(f)]));
    let roll = this.rng() * weights.reduce((sum, w) => sum + w, 0);
    for (let i = 0; i < candidates.length; i++) {
      roll -= weights[i];
      if (roll <= 0) return candidates[i];
    }
    return candidates[candidates.length - 1];
  }
}
