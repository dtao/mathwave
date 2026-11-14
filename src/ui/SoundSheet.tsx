import type { Settings } from '../game/settings';
import { Button } from './Button';

interface Props {
  settings: Settings;
  onChange: (patch: Partial<Settings>) => void;
  onClose: () => void;
}

const STEPS = 10;

/** A chunky 10-step volume control: no drag needed, big tap targets. */
function Volume({ label, value, onChange }: { label: string; value: number; onChange: (v: number) => void }) {
  const level = Math.round(value * STEPS);
  const set = (l: number) => onChange(Math.max(0, Math.min(STEPS, l)) / STEPS);
  return (
    <div className="volume">
      <h2>{label}</h2>
      <div className="row">
        <Button className="small" label={`${label} quieter`} onPress={() => set(level - 1)}>
          -
        </Button>
        <div className="meter" role="slider" aria-label={label} aria-valuemin={0} aria-valuemax={STEPS} aria-valuenow={level}>
          {Array.from({ length: STEPS }, (_, i) => (
            <button key={i} type="button" data-on={i < level || undefined} aria-label={`${label} ${i + 1}`} onClick={() => set(i + 1)} />
          ))}
        </div>
        <Button className="small" label={`${label} louder`} onPress={() => set(level + 1)}>
          +
        </Button>
      </div>
    </div>
  );
}

export function SoundSheet({ settings, onChange, onClose }: Props) {
  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" role="dialog" aria-label="Sound settings" onClick={(e) => e.stopPropagation()}>
        <div className="row">
          <h1>SOUND</h1>
          <Button className="small" onPress={onClose}>
            DONE
          </Button>
        </div>
        <Button className={settings.muted ? 'danger' : 'primary'} onPress={() => onChange({ muted: !settings.muted })}>
          {settings.muted ? 'MUTED - TAP TO UNMUTE' : 'SOUND ON - TAP TO MUTE'}
        </Button>
        <Volume label="BEAT" value={settings.beatVolume} onChange={(beatVolume) => onChange({ beatVolume })} />
        <Volume label="MELODY" value={settings.melodyVolume} onChange={(melodyVolume) => onChange({ melodyVolume })} />
      </div>
    </div>
  );
}
