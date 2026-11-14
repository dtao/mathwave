import { useEffect, useState } from 'react';
import { engine } from '../audio/engine';
import { buildPool } from '../game/facts';
import { Session, type Summary } from '../game/session';
import { loadSettings, saveSettings, type Settings } from '../game/settings';
import { loadStats } from '../game/stats';
import { GameScreen } from './GameScreen';
import { HomeScreen } from './HomeScreen';
import { ProgressScreen } from './ProgressScreen';
import { ResultsScreen } from './ResultsScreen';
import { SoundSheet } from './SoundSheet';

type Screen = { name: 'home' } | { name: 'play'; session: Session; id: number } | { name: 'results'; summary: Summary } | { name: 'progress' };

export function App() {
  const [settings, setSettings] = useState<Settings>(loadSettings);
  const [screen, setScreen] = useState<Screen>({ name: 'home' });
  const [soundOpen, setSoundOpen] = useState(false);

  useEffect(() => {
    saveSettings(settings);
    engine.applySettings(settings);
  }, [settings]);

  const update = (patch: Partial<Settings>) => setSettings((s) => ({ ...s, ...patch }));

  /** Called straight from a tap, so starting the engine here also unlocks audio on iOS. */
  const startSession = () => {
    const pool = buildPool(settings.op, settings.tables);
    if (pool.length === 0) return;
    engine.applySettings(settings);
    engine.start();
    setScreen({ name: 'play', id: Date.now(), session: new Session(pool, settings.sessionLength, loadStats()) });
  };

  const openSound = () => setSoundOpen(true);

  return (
    <div className="app">
      {screen.name === 'home' && (
        <HomeScreen
          settings={settings}
          onChange={update}
          onStart={startSession}
          onProgress={() => setScreen({ name: 'progress' })}
          onSound={openSound}
        />
      )}
      {screen.name === 'play' && (
        <GameScreen
          key={screen.id}
          session={screen.session}
          muted={settings.muted}
          onSound={openSound}
          onQuit={() => {
            engine.stop();
            setScreen({ name: 'home' });
          }}
          onFinish={(summary) => {
            engine.stop();
            setScreen({ name: 'results', summary });
          }}
        />
      )}
      {screen.name === 'results' && (
        <ResultsScreen summary={screen.summary} onAgain={startSession} onHome={() => setScreen({ name: 'home' })} />
      )}
      {screen.name === 'progress' && <ProgressScreen initialOp={settings.op} onBack={() => setScreen({ name: 'home' })} />}
      {soundOpen && <SoundSheet settings={settings} onChange={update} onClose={() => setSoundOpen(false)} />}
    </div>
  );
}
