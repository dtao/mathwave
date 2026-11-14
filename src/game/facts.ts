export type Op = 'mul' | 'add' | 'sub' | 'div';

export const OPS: Op[] = ['mul', 'add', 'sub', 'div'];
export const OP_SYMBOL: Record<Op, string> = { mul: '×', add: '+', sub: '-', div: '÷' };
export const MAX_NUMBER = 12;
export const ALL_NUMBERS = Array.from({ length: MAX_NUMBER + 1 }, (_, i) => i);

/**
 * One fact. `table` is the number being practiced ("the 7s") and `other` runs 0-12.
 *   mul: table × other          add: table + other
 *   sub: (table + other) - table = other
 *   div: (table × other) ÷ table = other
 */
export interface Fact {
  op: Op;
  table: number;
  other: number;
}

export const factKey = (f: Fact): string => `${f.op}:${f.table}:${f.other}`;

export function factAnswer(f: Fact): number {
  if (f.op === 'mul') return f.table * f.other;
  if (f.op === 'add') return f.table + f.other;
  return f.other;
}

/** Operands in the order they are written. */
export function factOperands(f: Fact): [number, number] {
  if (f.op === 'sub') return [f.table + f.other, f.table];
  if (f.op === 'div') return [f.table * f.other, f.table];
  return [f.table, f.other];
}

export function factText(f: Fact): string {
  const [a, b] = factOperands(f);
  return `${a} ${OP_SYMBOL[f.op]} ${b}`;
}

/** Numbers that can be picked as a table for this operation (no dividing by 0). */
export const validTables = (op: Op): number[] => (op === 'div' ? ALL_NUMBERS.filter((n) => n > 0) : ALL_NUMBERS);

export function buildPool(op: Op, tables: number[]): Fact[] {
  const allowed = new Set(validTables(op));
  const pool: Fact[] = [];
  for (const table of [...new Set(tables)].filter((t) => allowed.has(t)).sort((a, b) => a - b)) {
    for (const other of ALL_NUMBERS) pool.push({ op, table, other });
  }
  return pool;
}
