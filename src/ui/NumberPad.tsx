import { Button } from './Button';

interface Props {
  onKey: (key: string) => void;
  disabled: boolean;
  canSubmit: boolean;
}

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'del', '0', 'ok'];

/** Custom on-screen pad. Plain buttons only, so the system keyboard never opens. */
export function NumberPad({ onKey, disabled, canSubmit }: Props) {
  return (
    <div className="pad" data-disabled={disabled || undefined}>
      {KEYS.map((key) => (
        <Button
          key={key}
          immediate
          className={`key ${key === 'ok' ? 'primary' : key === 'del' ? 'danger' : ''}`}
          label={key === 'del' ? 'Backspace' : key === 'ok' ? 'Submit' : key}
          disabled={key === 'ok' && !canSubmit && !disabled}
          onPress={() => onKey(key)}
        >
          {key === 'del' ? 'DEL' : key === 'ok' ? 'OK' : key}
        </Button>
      ))}
    </div>
  );
}
