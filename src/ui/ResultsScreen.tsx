import type { Summary } from '../game/session';
import { Button } from './Button';

interface Props {
  summary: Summary;
  onAgain: () => void;
  onHome: () => void;
}

export function ResultsScreen({ summary, onAgain, onHome }: Props) {
  const percent = Math.round(summary.accuracy * 100);
  const headline = percent === 100 ? 'PERFECT!' : percent >= 80 ? 'GREAT JOB!' : percent >= 50 ? 'NICE WORK!' : 'KEEP GOING!';
  return (
    <main className="screen results">
      <h1>{headline}</h1>

      <div className="tiles">
        <div className="tile">
          <b>{percent}%</b>
          <span>ACCURACY</span>
        </div>
        <div className="tile">
          <b>{(summary.averageMs / 1000).toFixed(1)}s</b>
          <span>AVG TIME</span>
        </div>
        <div className="tile">
          <b>
            {summary.correct}/{summary.total}
          </b>
          <span>CORRECT</span>
        </div>
        <div className="tile">
          <b>{summary.bestStreak}</b>
          <span>BEST STREAK</span>
        </div>
      </div>

      <section className="missed">
        <h2>{summary.missed.length ? 'PRACTICE THESE' : 'NO MISSES!'}</h2>
        <ul>
          {summary.missed.map((m) => (
            <li key={m.text}>
              <span>
                {m.text} = <em>{m.answer}</em>
              </span>
              <span className="times">x{m.misses}</span>
            </li>
          ))}
        </ul>
      </section>

      <div className="home-actions">
        <Button className="primary start" onPress={onAgain}>
          PLAY AGAIN
        </Button>
        <Button onPress={onHome}>HOME</Button>
      </div>
    </main>
  );
}
