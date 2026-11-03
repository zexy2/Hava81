import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { TimeField } from '../../components/hava81/TimeField';
import { normalizeClock } from '../../utils/clock';
import '../../i18n';

describe('normalizeClock', () => {
  it.each([
    ['08:30', '08:30'],
    ['8:30', '08:30'],
    ['830', '08:30'],
    ['0830', '08:30'],
    ['08.30', '08:30'],
    ['8', '08:00'],
    ['23:59', '23:59'],
    // Midnight typed as the end of the day.
    ['24:00', '00:00'],
    ['2400', '00:00'],
  ])('reads %s as %s', (raw, clock) => {
    expect(normalizeClock(raw)).toBe(clock);
  });

  it.each(['1:2:3', '12:30:00', '24:30', '12:60', '9999', 'ab', '', '12345'])('rejects %s', raw => {
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

  it('keeps nonsense on blur, flagged, with an inline error linked to the field', () => {
    const { input, onChange } = setup('07:00');
    fireEvent.change(input, { target: { value: '99' } });
    expect(input).toHaveAttribute('aria-invalid', 'true');
    fireEvent.blur(input);
    expect(onChange).not.toHaveBeenCalled();
    expect(input).toHaveValue('99');
    expect(input).toHaveAttribute('aria-invalid', 'true');
    const describedBy = input.getAttribute('aria-describedby') ?? '';
    const error = document.getElementById(describedBy.split(' ').pop()!);
    expect(error).toHaveTextContent('24 saat biçiminde yaz, ör. 18:30');
    fireEvent.change(input, { target: { value: '18:30' } });
    expect(onChange).toHaveBeenCalledWith('18:30');
    expect(input).not.toHaveAttribute('aria-invalid');
  });

  it('merges a passed aria-describedby with the error and trims padded input', () => {
    const onChange = vi.fn();
    render(
      <>
        <p id="help">Yardım</p>
        <TimeField value="07:00" aria-label="Saat" aria-describedby="help" onChange={onChange} />
      </>
    );
    const input = screen.getByRole('textbox', { name: 'Saat' });
    expect(input).toHaveAttribute('maxlength', '8');
    expect(input).toHaveAttribute('aria-describedby', 'help');
    fireEvent.change(input, { target: { value: 'ab' } });
    fireEvent.blur(input);
    expect(input.getAttribute('aria-describedby')).toMatch(/^help \S+$/);
    fireEvent.change(input, { target: { value: '  9:15  ' } });
    fireEvent.blur(input);
    expect(onChange).toHaveBeenLastCalledWith('09:15');
    expect(input).toHaveValue('09:15');
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
