import { useEffect, useState } from 'react';
import { sfx } from '../lib/audio';

interface Props {
  value: string;
  onChange: (v: string) => void;
  onSubmit: () => void;
  disabled?: boolean;
  submitLabel?: string;
  /** when false, the bottom-right key clears the input instead of submitting (a separate submit button is shown) */
  goKey?: boolean;
}

/** On-screen numeric keypad with physical keyboard support (digits, Backspace, Enter). */
export function Keypad({ value, onChange, onSubmit, disabled, submitLabel = 'OK', goKey = true }: Props) {
  const [pressed, setPressed] = useState<string | null>(null);

  const press = (k: string) => {
    if (disabled) return;
    setPressed(k);
    setTimeout(() => setPressed(null), 110);
    if (k === 'back') {
      if (value.length) { sfx.erase(); onChange(value.slice(0, -1)); }
    } else if (k === 'clear') {
      if (value.length) { sfx.erase(); onChange(''); }
    } else if (k === 'go') {
      if (value.length === 3) onSubmit(); else sfx.error();
    } else if (value.length < 3) {
      sfx.digit(Number(k));
      onChange(value + k);
    }
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement)?.tagName === 'INPUT') return;
      if (/^\d$/.test(e.key)) press(e.key);
      else if (e.key === 'Backspace') press('back');
      else if (e.key === 'Enter') press('go');
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'back', '0', goKey ? 'go' : 'clear'];
  return (
    <div className="keypad" role="group" aria-label="Number keypad">
      {keys.map((k) => (
        <button
          key={k}
          type="button"
          className={`key${k === 'back' || k === 'clear' ? ' key--fn' : ''}${k === 'go' ? ' key--go' : ''}${pressed === k ? ' is-pressed' : ''}`}
          onClick={() => press(k)}
          disabled={disabled || (k === 'go' && value.length !== 3)}
          aria-label={k === 'back' ? 'Delete digit' : k === 'go' ? submitLabel : k === 'clear' ? 'Clear' : `Digit ${k}`}
        >
          {k === 'back' ? '⌫' : k === 'go' ? submitLabel : k === 'clear' ? 'CLR' : k}
        </button>
      ))}
    </div>
  );
}
