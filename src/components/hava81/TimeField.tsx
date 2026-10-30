import { useEffect, useState } from 'react';
import { CLOCK_PATTERN, normalizeClock } from '../../utils/clock';

interface Props {
  value: string | undefined;
  /** Called with a valid "HH:MM", or undefined when the field is cleared. */
  onChange: (value: string | undefined) => void;
  required?: boolean;
  'aria-describedby'?: string;
  className?: string;
}

/**
 * A 24-hour clock field. Browsers render <input type="time"> as 12-hour "AM/PM" in many locales;
 * Hava81 is a Turkish, 24-hour product, so the clock is typed, never localised.
 */
export function TimeField({ value, onChange, required, className, ...rest }: Props) {
  const [draft, setDraft] = useState(value ?? '');
  useEffect(() => setDraft(value ?? ''), [value]);

  const commit = (text: string) => {
    if (text.trim() === '') {
      if (!required) onChange(undefined);
      return;
    }
    const clock = normalizeClock(text);
    if (clock) onChange(clock);
  };

  return (
    <input
      type="text"
      inputMode="numeric"
      autoComplete="off"
      placeholder="00:00"
      maxLength={5}
      className={className}
      value={draft}
      required={required}
      aria-describedby={rest['aria-describedby']}
      aria-invalid={draft !== '' && normalizeClock(draft) === null ? true : undefined}
      onChange={event => {
        const text = event.target.value;
        setDraft(text);
        // A complete clock is saved right away; partial typing waits for blur.
        if (CLOCK_PATTERN.test(text) || text === '') commit(text);
      }}
      onBlur={() => {
        const clock = normalizeClock(draft);
        if (clock) {
          setDraft(clock);
          commit(clock);
        } else {
          setDraft(value ?? '');
        }
      }}
    />
  );
}

export default TimeField;
