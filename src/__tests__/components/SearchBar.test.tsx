/**
 * SearchBar Component Tests
 */

import { vi } from 'vitest';
import React from 'react';
import { act, render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SearchBar } from '../../components/SearchBar';

describe('SearchBar', () => {
  const defaultProps = {
    value: '',
    onChange: vi.fn(),
    onSubmit: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should render input field', () => {
    render(<SearchBar {...defaultProps} />);

    expect(screen.getByRole('combobox')).toBeInTheDocument();
  });

  it('should render submit button', () => {
    render(<SearchBar {...defaultProps} />);

    expect(screen.getByRole('button', { name: /ara/i })).toBeInTheDocument();
  });

  it('should call onChange when typing', async () => {
    const onChange = vi.fn();
    render(<SearchBar {...defaultProps} onChange={onChange} />);

    const input = screen.getByRole('combobox');
    await userEvent.type(input, 'İzmir');

    expect(onChange).toHaveBeenCalled();
  });

  it('should call onSubmit when form is submitted', async () => {
    const onSubmit = vi.fn();
    render(<SearchBar {...defaultProps} value="İzmir" onSubmit={onSubmit} />);

    const form = screen.getByRole('search');
    fireEvent.submit(form);

    expect(onSubmit).toHaveBeenCalled();
  });

  it('should disable button when loading', () => {
    render(<SearchBar {...defaultProps} value="test" isLoading />);

    expect(screen.getByRole('button')).toBeDisabled();
  });

  it('should show loading text when loading', () => {
    render(<SearchBar {...defaultProps} value="test" isLoading />);

    expect(screen.getByText(/yükleniyor/i)).toBeInTheDocument();
  });

  it('should disable input when disabled prop is true', () => {
    render(<SearchBar {...defaultProps} disabled />);

    expect(screen.getByRole('combobox')).toBeDisabled();
  });

  it('should show suggestions when typing', async () => {
    render(<SearchBar {...defaultProps} value="İz" />);

    const input = screen.getByRole('combobox');
    fireEvent.focus(input);

    await waitFor(() => {
      const listbox = screen.queryByRole('listbox');
      expect(listbox).toBeInTheDocument();
    });
  });

  it('ranks city-name prefixes ahead of substring-only matches', () => {
    render(<SearchBar {...defaultProps} value="An" />);

    const input = screen.getByRole('combobox');
    fireEvent.focus(input);

    const options = screen.getAllByRole('option');
    expect(options[0]).toHaveTextContent('Ankara');
    expect(options.some(option => option.textContent === 'Adana')).toBe(true);
  });

  it('does not show debounced suggestions from the previous query after the input is cleared', async () => {
    const recentSearches = [{ city: 'Ankara', timestamp: Date.now() }];
    const { rerender } = render(
      <SearchBar {...defaultProps} value="İz" recentSearches={recentSearches} />
    );
    const input = screen.getByRole('combobox');
    fireEvent.focus(input);
    await waitFor(() => expect(screen.getByRole('option', { name: 'İzmir' })).toBeInTheDocument());

    rerender(<SearchBar {...defaultProps} value="" recentSearches={recentSearches} />);

    expect(screen.queryByRole('option', { name: 'İzmir' })).not.toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Ankara' })).toBeInTheDocument();
  });

  it('does not show suggestions for the previous valid query while the next debounce settles', async () => {
    const { rerender } = render(<SearchBar {...defaultProps} value="İz" />);
    const input = screen.getByRole('combobox');
    fireEvent.focus(input);
    await waitFor(() => expect(screen.getByRole('option', { name: 'İzmir' })).toBeInTheDocument());

    rerender(<SearchBar {...defaultProps} value="An" />);

    expect(screen.queryByRole('option', { name: 'İzmir' })).not.toBeInTheDocument();
    expect(input).toHaveAttribute('aria-expanded', 'false');
    await waitFor(() => expect(screen.getByRole('option', { name: 'Ankara' })).toBeInTheDocument());
  });

  it('should have proper accessibility attributes', () => {
    render(<SearchBar {...defaultProps} />);

    const input = screen.getByRole('combobox');
    expect(input).toHaveAttribute('aria-autocomplete', 'list');
    expect(input).toHaveAttribute('aria-haspopup', 'listbox');
    expect(input).toHaveAttribute('aria-expanded', 'false');
  });

  it('should handle keyboard navigation', async () => {
    const user = userEvent.setup();
    render(<SearchBar {...defaultProps} value="İz" />);

    const input = screen.getByRole('combobox');
    await user.click(input);

    // Input should be focused after click
    expect(input).toHaveFocus();
  });

  it('keeps suggestions open when the input is immediately refocused after blur', () => {
    vi.useFakeTimers();
    try {
      render(<SearchBar {...defaultProps} value="İz" />);

      const input = screen.getByRole('combobox');
      fireEvent.focus(input);
      expect(screen.getByRole('listbox')).toBeInTheDocument();

      fireEvent.blur(input);
      fireEvent.focus(input);
      act(() => vi.advanceTimersByTime(200));

      expect(input).toHaveAttribute('aria-expanded', 'true');
      expect(screen.getByRole('listbox')).toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it('clears the active descendant when a completed blur closes suggestions', () => {
    vi.useFakeTimers();
    try {
      render(<SearchBar {...defaultProps} value="İz" />);

      const input = screen.getByRole('combobox');
      fireEvent.focus(input);
      expect(screen.getByRole('listbox')).toBeInTheDocument();

      fireEvent.keyDown(input, { key: 'ArrowDown' });
      expect(input).toHaveAttribute('aria-activedescendant', 'suggestion-0');

      fireEvent.blur(input);
      act(() => vi.advanceTimersByTime(200));

      expect(input).toHaveAttribute('aria-expanded', 'false');
      expect(input).not.toHaveAttribute('aria-activedescendant');
      expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    } finally {
      vi.useRealTimers();
    }
  });

  it('should expose the input through its forwarded ref', () => {
    const inputRef = React.createRef<HTMLInputElement>();
    render(<SearchBar {...defaultProps} ref={inputRef} />);

    act(() => inputRef.current?.focus());

    expect(screen.getByRole('combobox')).toHaveFocus();
  });
});
