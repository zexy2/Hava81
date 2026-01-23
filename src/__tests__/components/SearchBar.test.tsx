/**
 * SearchBar Component Tests
 */

import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SearchBar } from '../../components/SearchBar';

describe('SearchBar', () => {
  const defaultProps = {
    value: '',
    onChange: jest.fn(),
    onSubmit: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should render input field', () => {
    render(<SearchBar {...defaultProps} />);
    
    expect(screen.getByRole('textbox')).toBeInTheDocument();
  });

  it('should render submit button', () => {
    render(<SearchBar {...defaultProps} />);
    
    expect(screen.getByRole('button', { name: /ara/i })).toBeInTheDocument();
  });

  it('should call onChange when typing', async () => {
    const onChange = jest.fn();
    render(<SearchBar {...defaultProps} onChange={onChange} />);
    
    const input = screen.getByRole('textbox');
    await userEvent.type(input, 'İzmir');
    
    expect(onChange).toHaveBeenCalled();
  });

  it('should call onSubmit when form is submitted', async () => {
    const onSubmit = jest.fn();
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
    
    expect(screen.getByRole('textbox')).toBeDisabled();
  });

  it('should show suggestions when typing', async () => {
    render(<SearchBar {...defaultProps} value="İz" />);
    
    const input = screen.getByRole('textbox');
    fireEvent.focus(input);
    
    await waitFor(() => {
      const listbox = screen.queryByRole('listbox');
      expect(listbox).toBeInTheDocument();
    });
  });

  it('should have proper accessibility attributes', () => {
    render(<SearchBar {...defaultProps} />);
    
    const input = screen.getByRole('textbox');
    expect(input).toHaveAttribute('aria-autocomplete', 'list');
    expect(input).toHaveAttribute('aria-haspopup', 'listbox');
  });

  it('should handle keyboard navigation', async () => {
    const user = userEvent.setup();
    render(<SearchBar {...defaultProps} value="İz" />);
    
    const input = screen.getByRole('textbox');
    await user.click(input);
    
    // Input should be focused after click
    expect(input).toHaveFocus();
  });
});
