import { useEffect, useId, useState, type Ref } from 'react';
import { useTranslation } from 'react-i18next';
import { CLOCK_PATTERN, normalizeClock } from '../../utils/clock';

interface Props {
  value: string | undefined;
  /** Called with a valid "HH:MM", or undefined when the field is cleared. */
  onChange: (value: string | undefined) => void;
  required?: boolean;
  'aria-describedby'?: string;
  'aria-label'?: string;
  className?: string;
  onFocus?: () => void;
  inputRef?: Ref<HTMLInputElement>;
}

/**
 * A 24-hour clock field. Browsers render <input type="time"> as 12-hour "AM/PM" in many locales;
 * Hava81 is a Turkish, 24-hour product, so the clock is typed, never localised.
 */
export function TimeField({
  value,
  onChange,
  required,
  className,
  onFocus,
  inputRef,
  ...rest
}: Props) {
  const { t } = useTranslation();
  const errorId = useId();
  const [draft, setDraft] = useState(value ?? '');
  // An unreadable clock stays on screen after blur, flagged, instead of silently reverting.
  const [showError, setShowError] = useState(false);
  useEffect(() => {
    setDraft(value ?? '');
    setShowError(false);
  }, [value]);

  const commit = (text: string) => {
    if (text.trim() === '') {
      if (!required) onChange(undefined);
      return;
    }
    const clock = normalizeClock(text.trim());
    if (clock) onChange(clock);
  };

  const invalid = draft.trim() !== '' && normalizeClock(draft.trim()) === null;
  const describedBy =
    [rest['aria-describedby'], showError && invalid ? errorId : undefined]
      .filter(Boolean)
      .join(' ') || undefined;

  return (
    <>
      <input
        type="text"
        inputMode="numeric"
        autoComplete="off"
        placeholder="00:00"
        maxLength={8}
        className={className}
        value={draft}
        required={required}
        ref={inputRef}
        aria-describedby={describedBy}
        aria-label={rest['aria-label']}
        onFocus={onFocus}
        aria-invalid={invalid ? true : undefined}
        onChange={event => {
          const text = event.target.value;
          setDraft(text);
          if (normalizeClock(text.trim()) !== null) setShowError(false);
          // A complete clock is saved right away; partial typing waits for blur.
          if (CLOCK_PATTERN.test(text.trim()) || text.trim() === '') commit(text);
        }}
        onBlur={() => {
          const clock = normalizeClock(draft.trim());
          if (clock) {
            setDraft(clock);
            setShowError(false);
            commit(clock);
          } else if (draft.trim() === '') {
            setShowError(false);
            // A required clock cannot be emptied: show the saved one again.
            if (required) setDraft(value ?? '');
          } else {
            setShowError(true);
          }
        }}
      />
      {showError && invalid ? (
        <span id={errorId} className="time-field__error">
          {t('hava81.routines.timeInvalid')}
        </span>
      ) : null}
    </>
  );
}

export default TimeField;
