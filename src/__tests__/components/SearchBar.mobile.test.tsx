import React from 'react';
import { render, screen } from '@testing-library/react';
import { vi } from 'vitest';
import { SearchBar } from '../../components/SearchBar';

describe('SearchBar mobile keyboard hints', () => {
  it('requests a search-oriented mobile keyboard without spell correction', () => {
    render(<SearchBar value="" onChange={vi.fn()} onSubmit={vi.fn()} />);

    const input = screen.getByRole('combobox');
    expect(input).toHaveAttribute('enterkeyhint', 'search');
    expect(input).toHaveAttribute('autocapitalize', 'words');
    expect(input).toHaveAttribute('autocorrect', 'off');
    expect(input).toHaveAttribute('spellcheck', 'false');
  });
});
