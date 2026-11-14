/** Per-fact history, persisted in localStorage. */

export interface FactStat {
  attempts: number;
  correct: number;
  /** Sum of response times, so the average is totalMs / attempts. */
  totalMs: number;
  /** Last few results, oldest first: '1' correct, '0' wrong. */
  recent: string;
}

export type StatsMap = Record<string, FactStat>;

const STORAGE_KEY = 'mathwave:stats:v1';
const RECENT_WINDOW = 5;
/** Cap one response so a phone left on the table doesn't wreck an average. */
const MAX_RESPONSE_MS = 30_000;
const FAST_MS = 4000;

export function loadStats(): StatsMap {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as StatsMap) : {};
  } catch {
    return {};
  }
}

export function saveStats(stats: StatsMap): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(stats));
  } catch {
    // storage full or blocked: keep playing without persistence
  }
}

export function clearStats(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
    // ignore
  }
}

export function recordAttempt(stats: StatsMap, key: string, correct: boolean, ms: number): void {
  const s = (stats[key] ??= { attempts: 0, correct: 0, totalMs: 0, recent: '' });
  s.attempts++;
  if (correct) s.correct++;
  s.totalMs += Math.min(Math.max(ms, 0), MAX_RESPONSE_MS);
  s.recent = (s.recent + (correct ? '1' : '0')).slice(-RECENT_WINDOW);
}

export const averageMs = (s: FactStat): number => (s.attempts ? s.totalMs / s.attempts : 0);

const recentAccuracy = (s: FactStat): number =>
  s.recent.length ? [...s.recent].filter((c) => c === '1').length / s.recent.length : 0;

/** 0 unseen, 1 struggling, 2 learning, 3 good, 4 mastered (accurate, repeated and fast). */
export type Mastery = 0 | 1 | 2 | 3 | 4;
export const MASTERY_LABELS = ['NEW', 'TRICKY', 'LEARNING', 'GOOD', 'MASTERED'] as const;

export function mastery(s: FactStat | undefined): Mastery {
  if (!s || s.attempts === 0) return 0;
  const accuracy = recentAccuracy(s);
  if (accuracy < 0.5) return 1;
  if (accuracy < 0.8) return 2;
  if (s.recent.length >= 3 && averageMs(s) <= FAST_MS) return 4;
  return 3;
}

/** How strongly a fact should be favoured when picking the next problem. */
export function selectionWeight(s: FactStat | undefined): number {
  const base = [3, 6, 4, 2, 1][mastery(s)];
  const slow = s ? Math.min(averageMs(s) / FAST_MS, 2) : 0;
  return base + slow;
}
