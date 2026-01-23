/**
 * SearchBar Component - Enhanced Version
 * Autocomplete search with keyboard navigation and accessibility
 */

import React, { 
  memo, 
  useState, 
  useCallback, 
  useMemo, 
  useRef,
  useEffect,
  type KeyboardEvent,
  type FormEvent,
  type ChangeEvent,
} from 'react';
import { useDebounce } from '../hooks/useDebounce';
import { TURKIYE_SEHIRLERI } from '../constants/cities';

interface SearchBarProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit: (city?: string) => void;
  isLoading?: boolean;
  placeholder?: string;
  disabled?: boolean;
  recentSearches?: Array<{ city: string; timestamp: number }>;
  onSelectRecent?: (city: string) => void;
}

const MIN_QUERY_LENGTH = 2;
const MAX_SUGGESTIONS = 5;

export const SearchBar: React.FC<SearchBarProps> = memo(({
  value,
  onChange,
  onSubmit,
  isLoading = false,
  placeholder = 'Şehir giriniz...',
  disabled = false,
  recentSearches = [],
  onSelectRecent,
}) => {
  const [isFocused, setIsFocused] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const listboxRef = useRef<HTMLUListElement>(null);
  
  const debouncedValue = useDebounce(value, 150);

  // Generate suggestions based on input
  const suggestions = useMemo(() => {
    const query = (debouncedValue ?? '').trim();
    if (query.length < MIN_QUERY_LENGTH) return [];

    // Normalize Turkish characters for comparison
    // Replace Turkish chars BEFORE toLowerCase to avoid Unicode issues
    const normalizeTurkish = (str: string) => 
      str
        .replace(/İ/g, 'i')
        .replace(/I/g, 'i')
        .replace(/ı/g, 'i')
        .replace(/Ü/g, 'u')
        .replace(/ü/g, 'u')
        .replace(/Ö/g, 'o')
        .replace(/ö/g, 'o')
        .replace(/Ş/g, 's')
        .replace(/ş/g, 's')
        .replace(/Ğ/g, 'g')
        .replace(/ğ/g, 'g')
        .replace(/Ç/g, 'c')
        .replace(/ç/g, 'c')
        .toLowerCase();
    
    const normalized = normalizeTurkish(query);
    
    return TURKIYE_SEHIRLERI
      .filter((cityName) => normalizeTurkish(cityName).includes(normalized))
      .slice(0, MAX_SUGGESTIONS);
  }, [debouncedValue]);

  // Combine recent searches with suggestions
  const combinedItems = useMemo(() => {
    if (suggestions.length > 0) {
      return suggestions.map(city => ({ city, isRecent: false }));
    }
    
    if (recentSearches.length > 0 && value.length === 0) {
      return recentSearches
        .slice(0, MAX_SUGGESTIONS)
        .map(({ city }) => ({ city, isRecent: true }));
    }
    
    return [];
  }, [suggestions, recentSearches, value]);

  const showDropdown = isFocused && combinedItems.length > 0;

  // Reset highlight when value changes
  useEffect(() => {
    setHighlightedIndex(-1);
  }, [value]);

  // Scroll highlighted item into view
  useEffect(() => {
    if (highlightedIndex >= 0 && listboxRef.current) {
      const highlighted = listboxRef.current.children[highlightedIndex] as HTMLElement;
      highlighted?.scrollIntoView({ block: 'nearest' });
    }
  }, [highlightedIndex]);

  const handleSubmit = useCallback((event: FormEvent) => {
    event.preventDefault();
    if (!isLoading && value.trim()) {
      onSubmit();
    }
  }, [isLoading, value, onSubmit]);

  const selectItem = useCallback((city: string) => {
    onChange(city);
    setHighlightedIndex(-1);
    onSubmit(city);  // Pass the selected city directly
    inputRef.current?.blur();
  }, [onChange, onSubmit]);

  const handleKeyDown = useCallback((event: KeyboardEvent<HTMLInputElement>) => {
    if (!showDropdown) {
      if (event.key === 'ArrowDown' && combinedItems.length > 0) {
        setHighlightedIndex(0);
      }
      return;
    }

    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        setHighlightedIndex((prev) =>
          prev < combinedItems.length - 1 ? prev + 1 : 0
        );
        break;
      case 'ArrowUp':
        event.preventDefault();
        setHighlightedIndex((prev) =>
          prev > 0 ? prev - 1 : combinedItems.length - 1
        );
        break;
      case 'Enter':
        if (highlightedIndex >= 0) {
          event.preventDefault();
          selectItem(combinedItems[highlightedIndex].city);
        }
        break;
      case 'Escape':
        setHighlightedIndex(-1);
        inputRef.current?.blur();
        break;
      case 'Tab':
        if (highlightedIndex >= 0) {
          selectItem(combinedItems[highlightedIndex].city);
        }
        break;
    }
  }, [showDropdown, combinedItems, highlightedIndex, selectItem]);

  const handleChange = useCallback((event: ChangeEvent<HTMLInputElement>) => {
    onChange(event.target.value);
  }, [onChange]);

  const handleFocus = useCallback(() => setIsFocused(true), []);
  const handleBlur = useCallback(() => {
    // Delay to allow click on suggestions
    setTimeout(() => setIsFocused(false), 150);
  }, []);

  const listboxId = 'city-suggestions';
  const activeDescendant = highlightedIndex >= 0 
    ? `suggestion-${highlightedIndex}` 
    : undefined;

  return (
    <form 
      className="search-bar" 
      onSubmit={handleSubmit} 
      autoComplete="off"
      role="search"
    >
      <label className="search-bar__label" htmlFor="city-search">
        Şehir Ara
      </label>

      <div className="search-bar__controls">
        <div className="search-bar__field">
          <input
            ref={inputRef}
            id="city-search"
            className="search-bar__input"
            type="text"
            value={value}
            placeholder={placeholder}
            onChange={handleChange}
            onFocus={handleFocus}
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
            disabled={disabled}
            aria-autocomplete="list"
            aria-controls={showDropdown ? listboxId : undefined}
            aria-activedescendant={activeDescendant}
            aria-haspopup="listbox"
          />

          {showDropdown && (
            <ul
              ref={listboxRef}
              id={listboxId}
              className="search-bar__suggestions"
              role="listbox"
              aria-label="Şehir önerileri"
            >
              {combinedItems.map((item, index) => (
                <li
                  key={item.city}
                  id={`suggestion-${index}`}
                  className={`search-bar__suggestion ${
                    index === highlightedIndex ? 'is-active' : ''
                  } ${item.isRecent ? 'is-recent' : ''}`}
                  role="option"
                  aria-selected={index === highlightedIndex}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    selectItem(item.city);
                  }}
                  onMouseEnter={() => setHighlightedIndex(index)}
                >
                  {item.isRecent && (
                    <span className="search-bar__recent-icon\" aria-hidden="true">
                      🕐
                    </span>
                  )}
                  {item.city}
                </li>
              ))}
            </ul>
          )}
        </div>

        <button
          type="submit"
          className="search-bar__button"
          disabled={isLoading || disabled || !value.trim()}
          aria-busy={isLoading}
        >
          {isLoading ? (
            <>
              <span className="search-bar__spinner" aria-hidden="true" />
              Yükleniyor...
            </>
          ) : (
            'Ara'
          )}
        </button>
      </div>
    </form>
  );
});

SearchBar.displayName = 'SearchBar';

export default SearchBar;
