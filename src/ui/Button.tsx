import { useState, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
  onPress: () => void;
  className?: string;
  disabled?: boolean;
  selected?: boolean;
  label?: string;
  /** Fire on touch-down instead of on release. Used by the number pad for snappy entry. */
  immediate?: boolean;
}

/**
 * Chunky pixel button. Tracks its own pressed state from pointer events because
 * :active is unreliable on iOS, and never takes focus so no keyboard can open.
 */
export function Button({ children, onPress, className = '', disabled, selected, label, immediate }: Props) {
  const [pressed, setPressed] = useState(false);
  return (
    <button
      type="button"
      className={`btn ${className}`}
      disabled={disabled}
      aria-label={label}
      aria-pressed={selected}
      data-pressed={pressed || undefined}
      data-selected={selected || undefined}
      onPointerDown={(e) => {
        if (disabled) return;
        setPressed(true);
        if (immediate) {
          e.preventDefault();
          onPress();
        }
      }}
      onPointerUp={() => setPressed(false)}
      onPointerLeave={() => setPressed(false)}
      onPointerCancel={() => setPressed(false)}
      onClick={(e) => {
        // Pointer taps on immediate buttons were handled on pointerdown; detail 0 means keyboard/AT activation.
        if (!immediate || e.detail === 0) onPress();
      }}
    >
      {children}
    </button>
  );
}
