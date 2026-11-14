import { ALL_NUMBERS, OPS, OP_SYMBOL, buildPool, validTables } from '../game/facts';
import { SESSION_LENGTHS, type Settings } from '../game/settings';
import { Button } from './Button';

interface Props {
  settings: Settings;
  onChange: (patch: Partial<Settings>) => void;
  onStart: () => void;
  onProgress: () => void;
  onSound: () => void;
}

const OP_NAMES = { mul: 'TIMES', add: 'PLUS', sub: 'MINUS', div: 'DIVIDE' } as const;

export function HomeScreen({ settings, onChange, onStart, onProgress, onSound }: Props) {
  const valid = validTables(settings.op);
  const selected = new Set(settings.tables);
  const allOn = valid.every((n) => selected.has(n));
  const canStart = buildPool(settings.op, settings.tables).length > 0;

  const toggle = (n: number) => {
    const next = new Set(selected);
    if (next.has(n)) next.delete(n);
    else next.add(n);
    onChange({ tables: ALL_NUMBERS.filter((x) => next.has(x)) });
  };

  return (
    <main className="screen home">
      <header className="logo">
        <div className="logo-bars" aria-hidden="true">
          {[3, 5, 2, 6, 4, 7, 3].map((h, i) => (
            <span key={i} style={{ height: h * 4 }} />
          ))}
        </div>
        <h1>MATHWAVE</h1>
      </header>

      <section>
        <h2>OPERATION</h2>
        <div className="ops">
          {OPS.map((op) => (
            <Button key={op} className="op" selected={settings.op === op} label={OP_NAMES[op]} onPress={() => onChange({ op })}>
              {OP_SYMBOL[op]}
            </Button>
          ))}
        </div>
      </section>

      <section>
        <div className="row">
          <h2>NUMBERS</h2>
          <Button className="small" onPress={() => onChange({ tables: allOn ? [] : ALL_NUMBERS })}>
            {allOn ? 'CLEAR' : 'ALL'}
          </Button>
        </div>
        <div className="tables">
          {ALL_NUMBERS.map((n) => (
            <Button key={n} className="chip" selected={selected.has(n) && valid.includes(n)} disabled={!valid.includes(n)} onPress={() => toggle(n)}>
              {n}
            </Button>
          ))}
        </div>
      </section>

      <section>
        <h2>PROBLEMS</h2>
        <div className="lengths">
          {SESSION_LENGTHS.map((n) => (
            <Button key={n} className="chip" selected={settings.sessionLength === n} onPress={() => onChange({ sessionLength: n })}>
              {n}
            </Button>
          ))}
        </div>
      </section>

      <div className="home-actions">
        <Button className="primary start" disabled={!canStart} onPress={onStart}>
          {canStart ? 'START' : 'PICK A NUMBER'}
        </Button>
        <div className="row">
          <Button className="grow" onPress={onProgress}>
            PROGRESS
          </Button>
          <Button className="grow" onPress={onSound}>
            {settings.muted ? 'SOUND OFF' : 'SOUND'}
          </Button>
        </div>
      </div>
    </main>
  );
}
