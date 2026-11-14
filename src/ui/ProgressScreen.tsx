import { useState } from 'react';
import { ALL_NUMBERS, OPS, OP_SYMBOL, factAnswer, factKey, factText, validTables, type Fact, type Op } from '../game/facts';
import { MASTERY_LABELS, averageMs, clearStats, loadStats, mastery } from '../game/stats';
import { Button } from './Button';

interface Props {
  initialOp: Op;
  onBack: () => void;
}

export function ProgressScreen({ initialOp, onBack }: Props) {
  const [op, setOp] = useState<Op>(initialOp);
  const [stats, setStats] = useState(loadStats);
  const [picked, setPicked] = useState<Fact | null>(null);
  const [confirmReset, setConfirmReset] = useState(false);

  const pickedStat = picked ? stats[factKey(picked)] : undefined;

  return (
    <main className="screen progress">
      <header className="topbar">
        <Button className="small" onPress={onBack}>
          BACK
        </Button>
        <h1>PROGRESS</h1>
      </header>

      <div className="ops">
        {OPS.map((o) => (
          <Button
            key={o}
            className="op"
            selected={o === op}
            onPress={() => {
              setOp(o);
              setPicked(null);
            }}
          >
            {OP_SYMBOL[o]}
          </Button>
        ))}
      </div>

      <div className="grid" role="grid">
        <span className="corner">{OP_SYMBOL[op]}</span>
        {ALL_NUMBERS.map((n) => (
          <span key={n} className="axis">
            {n}
          </span>
        ))}
        {validTables(op).map((table) => (
          <div key={table} className="grid-row" role="row">
            <span className="axis">{table}</span>
            {ALL_NUMBERS.map((other) => {
              const fact: Fact = { op, table, other };
              const isPicked = picked !== null && factKey(picked) === factKey(fact);
              return (
                <button
                  key={other}
                  type="button"
                  className="cell"
                  data-m={mastery(stats[factKey(fact)])}
                  data-picked={isPicked || undefined}
                  aria-label={factText(fact)}
                  onClick={() => setPicked(fact)}
                />
              );
            })}
          </div>
        ))}
      </div>

      <div className="detail">
        {picked ? (
          <>
            <b>
              {factText(picked)} = {factAnswer(picked)}
            </b>
            <span>
              {pickedStat
                ? `${MASTERY_LABELS[mastery(pickedStat)]} - ${pickedStat.correct}/${pickedStat.attempts} RIGHT - ${(averageMs(pickedStat) / 1000).toFixed(1)}s AVG`
                : 'NOT TRIED YET'}
            </span>
          </>
        ) : (
          <span>TAP A SQUARE TO SEE A FACT</span>
        )}
      </div>

      <div className="legend">
        {MASTERY_LABELS.map((label, m) => (
          <span key={label}>
            <i className="cell" data-m={m} />
            {label}
          </span>
        ))}
      </div>

      <Button
        className={confirmReset ? 'danger' : ''}
        onPress={() => {
          if (!confirmReset) return setConfirmReset(true);
          clearStats();
          setStats({});
          setConfirmReset(false);
        }}
      >
        {confirmReset ? 'TAP AGAIN TO ERASE' : 'RESET PROGRESS'}
      </Button>
    </main>
  );
}
