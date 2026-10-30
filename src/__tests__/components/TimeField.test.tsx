import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { TimeField } from '../../components/hava81/TimeField';
import { normalizeClock } from '../../utils/clock';

describe('normalizeClock', () => {
  it.each([
    ['08:30', '08:30'],
    ['8:30', '08:30'],
    ['830', '08:30'],
    ['0830', '08:30'],
    ['08.30', '08:30'],
    ['8', '08:00'],
    ['23:59', '23:59'],
  ])('reads %s as %s', (raw, clock) => {
    expect(normalizeClock(raw)).toBe(clock);
  });

  it.each(['24:00', '12:60', '9999', 'ab', '', '12345'])('rejects %s', raw => {
    expect(normalizeClock(raw)).toBeNull();
  });
});

describe('TimeField', () => {
  const setup = (value?: string, required?: boolean) => {
    const onChange = vi.fn();
    render(
      <label>
        Çıkış
        <TimeField value={value} onChange={onChange} required={required} />
      </label>
    );
    return { onChange, input: screen.getByRole('textbox', { name: 'Çıkış' }) };
  };

  it('is a 24-hour text field with a numeric keypad', () => {
    const { input } = setup('18:00');
    expect(input).toHaveAttribute('inputmode', 'numeric');
    expect(input).toHaveValue('18:00');
  });

  it('saves a complete clock as soon as it is typed', () => {
    const { input, onChange } = setup();
    fireEvent.change(input, { target: { value: '14:37' } });
    expect(onChange).toHaveBeenCalledWith('14:37');
  });

  it('waits for blur to read shorthand, then shows it formatted', () => {
    const { input, onChange } = setup();
    fireEvent.change(input, { target: { value: '830' } });
    expect(onChange).not.toHaveBeenCalled();
    fireEvent.blur(input);
    expect(onChange).toHaveBeenCalledWith('08:30');
    expect(input).toHaveValue('08:30');
  });

  it('marks nonsense invalid and restores the saved value on blur', () => {
    const { input, onChange } = setup('07:00');
    fireEvent.change(input, { target: { value: '99' } });
    expect(input).toHaveAttribute('aria-invalid', 'true');
    fireEvent.blur(input);
    expect(onChange).not.toHaveBeenCalled();
    expect(input).toHaveValue('07:00');
  });

  it('clears an optional clock but keeps a required one', () => {
    const optional = setup('07:00');
    fireEvent.change(optional.input, { target: { value: '' } });
    expect(optional.onChange).toHaveBeenCalledWith(undefined);
  });

  it('does not clear a required clock', () => {
    const { input, onChange } = setup('07:00', true);
    fireEvent.change(input, { target: { value: '' } });
    expect(onChange).not.toHaveBeenCalled();
  });
});
