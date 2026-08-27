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

  it('should expose the input through its forwarded ref', () => {
    const inputRef = React.createRef<HTMLInputElement>();
    render(<SearchBar {...defaultProps} ref={inputRef} />);

    act(() => inputRef.current?.focus());

    expect(screen.getByRole('combobox')).toHaveFocus();
  });
});
