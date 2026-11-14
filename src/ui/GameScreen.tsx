import { useCallback, useEffect, useRef, useState } from 'react';
import { engine } from '../audio/engine';
import type { Problem, Session, Summary } from '../game/session';
import { BeatLeds } from './BeatLeds';
import { Button } from './Button';
import { NumberPad } from './NumberPad';

interface Props {
  session: Session;
  muted: boolean;
  onSound: () => void;
  onQuit: () => void;
  onFinish: (summary: Summary) => void;
}

type Phase = 'answering' | 'correct' | 'wrong';

const MAX_DIGITS = 3;
/** How long the feedback stays up before the next problem. */
const CORRECT_MS = 550;
const WRONG_MS = 2200;

export function GameScreen({ session, muted, onSound, onQuit, onFinish }: Props) {
  const [problem, setProblem] = useState<Problem | null>(() => session.current ?? session.next());
  const [input, setInput] = useState('');
  const [phase, setPhase] = useState<Phase>('answering');
  const [streak, setStreak] = useState(0);
  const shownAt = useRef(performance.now());
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => void (timer.current && clearTimeout(timer.current)), []);

  const advance = useCallback(() => {
    const next = session.next();
    if (!next) return onFinish(session.summary());
    setProblem(next);
    setInput('');
    setPhase('answering');
    shownAt.current = performance.now();
  }, [session, onFinish]);

  const press = useCallback(
    (key: string) => {
      if (phase !== 'answering' || !problem) return;
      if (key === 'del') return setInput((s) => s.slice(0, -1));
      if (key !== 'ok') return setInput((s) => (s.length >= MAX_DIGITS ? s : s === '0' ? key : s + key));
      if (input === '') return;

      const { correct } = session.submit(Number(input), performance.now() - shownAt.current);
      setStreak(session.streak);
      if (correct) engine.correct(problem.answer, session.streak);
      else engine.wrong();
      setPhase(correct ? 'correct' : 'wrong');
      timer.current = setTimeout(advance, correct ? CORRECT_MS : WRONG_MS);
    },
    [phase, problem, input, session, advance],
  );

  // Hardware keyboard support for desktop; phones only ever see the on-screen pad.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (/^[0-9]$/.test(e.key)) press(e.key);
      else if (e.key === 'Backspace') press('del');
      else if (e.key === 'Enter') press('ok');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [press]);

  if (!problem) return null;
  const number = Math.min(session.answered + (phase === 'answering' ? 1 : 0), session.length);

  return (
    <main className={`screen game phase-${phase}`}>
      <header className="topbar">
        <Button className="small" label="Quit" onPress={onQuit}>
          X
        </Button>
        <div className="count">
          {number}/{session.length}
        </div>
        <BeatLeds />
        <Button className="small" label="Sound settings" onPress={onSound}>
          {muted ? 'OFF' : 'SND'}
        </Button>
      </header>

      <div className="progress-track" aria-hidden="true">
        <div style={{ width: `${(session.answered / session.length) * 100}%` }} />
      </div>

      <section className="stage" aria-live="polite">
        <div className="streak" data-hot={streak >= 5 || undefined}>
          {streak >= 2 ? `STREAK ${streak}` : ' '}
        </div>
        <div className="problem">
          {problem.a} {problem.symbol} {problem.b}
        </div>
        <div className="answer" key={phase === 'answering' ? 'a' : `${phase}-${session.answered}`}>
          {phase === 'wrong' ? (
            <>
              <span className="given">{input}</span>
              <span className="truth">{problem.answer}</span>
            </>
          ) : (
            <>
              {input}
              {phase === 'answering' && <span className="cursor">_</span>}
            </>
          )}
        </div>
        <div className="verdict">{phase === 'correct' ? 'YES!' : phase === 'wrong' ? 'ALMOST! IT IS ' + problem.answer : ' '}</div>
      </section>

      <NumberPad onKey={press} disabled={phase !== 'answering'} canSubmit={input !== ''} />
    </main>
  );
}
