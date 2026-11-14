import { useEffect, useState } from 'react';
import { engine } from '../audio/engine';

/** Four LEDs that step with the quarter notes; the downbeat is the bright one. */
export function BeatLeds() {
  const [beat, setBeat] = useState(-1);
  useEffect(() => engine.onBeat(setBeat), []);
  return (
    <div className="leds" aria-hidden="true">
      {[0, 1, 2, 3].map((i) => (
        <span key={i === beat % 4 ? `${i}-${beat}` : i} className="led" data-on={i === beat % 4 || undefined} data-down={i === 0 || undefined} />
      ))}
    </div>
  );
}
