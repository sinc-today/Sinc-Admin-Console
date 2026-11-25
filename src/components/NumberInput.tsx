'use client';

import { InputHTMLAttributes, useEffect, useState } from 'react';

type Props = Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'value' | 'onChange'> & {
  value: string | number | null | undefined;
  /** Called on every keystroke with what is typed (possibly empty or partial, like "12." or "") and its number, or null. */
  onValue: (text: string, n: number | null) => void;
};

const toText = (v: Props['value']) => (v === null || v === undefined || (typeof v === 'number' && !Number.isFinite(v)) ? '' : String(v));
const toNum = (t: string) => (t.trim() === '' || !Number.isFinite(Number(t)) ? null : Number(t));

/**
 * A number field you can type into freely: it keeps what you type (including an empty box, "0.", "-") instead of
 * forcing it back to a number on every keystroke, which made it impossible to clear a field or type over a value.
 * The browser still checks min, max, step and required when the form is sent. Scrolling the page over a focused
 * field no longer changes its value, and the letters number fields would otherwise accept (e, +) are ignored.
 */
export function NumberInput({ value, onValue, min, onKeyDown, onWheel, inputMode, step, ...rest }: Props) {
  const [text, setText] = useState(() => toText(value));

  // Follow changes made from outside (a reset, a prefill), but never rewrite what is being typed when it means the same number.
  useEffect(() => {
    const outside = toText(value);
    setText((t) => (toNum(t) === toNum(outside) ? t : outside));
  }, [value]);

  const decimals = step !== undefined && step !== 'any' ? !Number.isInteger(Number(step)) : false;
  const negative = min === undefined || Number(min) < 0;
  return (
    <input
      type="number"
      inputMode={inputMode ?? (decimals || step === 'any' ? 'decimal' : 'numeric')}
      min={min}
      step={step}
      value={text}
      onChange={(e) => {
        setText(e.target.value);
        onValue(e.target.value, toNum(e.target.value));
      }}
      onKeyDown={(e) => {
        if (e.key === 'e' || e.key === 'E' || e.key === '+' || (e.key === '-' && !negative)) e.preventDefault();
        onKeyDown?.(e);
      }}
      onWheel={(e) => {
        if (document.activeElement === e.currentTarget) e.currentTarget.blur();
        onWheel?.(e);
      }}
      {...rest}
    />
  );
}
