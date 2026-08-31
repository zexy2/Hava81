/**
 * SearchBar Component - Enhanced Version
 * Autocomplete search with keyboard navigation and accessibility
 */

import React, {
  forwardRef,
  memo,
  useState,
  useCallback,
  useMemo,
  useRef,
  useEffect,
  useImperativeHandle,
  useId,
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
  label?: string;
  submitLabel?: string;
  loadingLabel?: string;
  suggestionsLabel?: string;
  onDismiss?: () => void;
}

const MIN_QUERY_LENGTH = 2;
const MAX_SUGGESTIONS = 5;

const ClockIcon = () => (
  <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24">
    <circle cx="12" cy="12" r="8" />
    <path d="M12 7v5l3 2" />
  </svg>
);

const SearchIcon = () => (
  <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24">
    <circle cx="11" cy="11" r="6.5" />
    <path d="m16 16 4 4" />
  </svg>
);

const SearchBarComponent = forwardRef<HTMLInputElement, SearchBarProps>(function SearchBar(
  {
    value,
    onChange,
    onSubmit,
    isLoading = false,
    placeholder = 'Şehir giriniz...',
    disabled = false,
    recentSearches = [],
    onSelectRecent,
    label = 'Şehir Ara',
    submitLabel = 'Ara',
    loadingLabel = 'Yükleniyor...',
    suggestionsLabel = 'Şehir önerileri',
    onDismiss,
  },
  forwardedRef
) {
  const [isFocused, setIsFocused] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const listboxRef = useRef<HTMLUListElement>(null);
  const blurTimeoutRef = useRef<number | null>(null);
  const id = useId();
  const inputId = `city-search-${id}`;
  const listboxId = `city-suggestions-${id}`;

  useImperativeHandle(forwardedRef, () => inputRef.current as HTMLInputElement, []);

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
    const matches = TURKIYE_SEHIRLERI.filter(cityName =>
      normalizeTurkish(cityName).includes(normalized)
    );
    const prefixMatches = matches.filter(cityName =>
      normalizeTurkish(cityName).startsWith(normalized)
    );
    const substringMatches = matches.filter(cityName =>
      !normalizeTurkish(cityName).startsWith(normalized)
    );

    return [...prefixMatches, ...substringMatches].slice(0, MAX_SUGGESTIONS);
  }, [debouncedValue]);

  // Combine recent searches with suggestions
  const combinedItems = useMemo(() => {
    const currentQuery = value.trim();
    if (currentQuery.length < MIN_QUERY_LENGTH) {
      if (recentSearches.length > 0 && currentQuery.length === 0) {
        return recentSearches
          .slice(0, MAX_SUGGESTIONS)
          .map(({ city }) => ({ city, isRecent: true }));
      }
      return [];
    }

    // The debounce intentionally lags behind the controlled input. Do not keep
    // rendering suggestions for the previous valid query during that gap.
    const suggestionQuery = (debouncedValue ?? '').trim();
    if (suggestionQuery !== currentQuery) return [];

    if (suggestions.length > 0) {
      return suggestions.map(city => ({ city, isRecent: false }));
    }

    return [];
  }, [debouncedValue, suggestions, recentSearches, value]);

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

  useEffect(
    () => () => {
      if (blurTimeoutRef.current !== null) window.clearTimeout(blurTimeoutRef.current);
    },
    []
  );

  const handleSubmit = useCallback(
    (event: FormEvent) => {
      event.preventDefault();
      if (!isLoading && value.trim()) {
        onSubmit();
      }
    },
    [isLoading, value, onSubmit]
  );

  const selectItem = useCallback(
    (city: string, isRecent = false) => {
      onChange(city);
      setHighlightedIndex(-1);
      if (isRecent) {
        onSelectRecent?.(city);
      }
      onSubmit(city); // Pass the selected city directly
      inputRef.current?.blur();
    },
    [onChange, onSelectRecent, onSubmit]
  );

  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLInputElement>) => {
      if (!showDropdown) {
        if (event.key === 'ArrowDown' && combinedItems.length > 0) {
          setHighlightedIndex(0);
        }
        return;
      }

      switch (event.key) {
        case 'ArrowDown':
          event.preventDefault();
          setHighlightedIndex(prev => (prev < combinedItems.length - 1 ? prev + 1 : 0));
          break;
        case 'ArrowUp':
          event.preventDefault();
          setHighlightedIndex(prev => (prev > 0 ? prev - 1 : combinedItems.length - 1));
          break;
        case 'Enter':
          if (highlightedIndex >= 0) {
            event.preventDefault();
            selectItem(
              combinedItems[highlightedIndex].city,
              combinedItems[highlightedIndex].isRecent
            );
          }
          break;
        case 'Escape':
          setHighlightedIndex(-1);
          inputRef.current?.blur();
          onDismiss?.();
          break;
      }
    },
    [showDropdown, combinedItems, highlightedIndex, onDismiss, selectItem]
  );

  const handleChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      onChange(event.target.value);
    },
    [onChange]
  );

  const handleFocus = useCallback(() => {
    if (blurTimeoutRef.current !== null) {
      window.clearTimeout(blurTimeoutRef.current);
      blurTimeoutRef.current = null;
    }
    setIsFocused(true);
  }, []);
  const handleBlur = useCallback(() => {
    // Delay to allow click on suggestions, but cancel it if the user refocuses first.
    blurTimeoutRef.current = window.setTimeout(() => {
      blurTimeoutRef.current = null;
      setHighlightedIndex(-1);
      setIsFocused(false);
    }, 150);
  }, []);

  const activeDescendant =
    showDropdown && highlightedIndex >= 0 && highlightedIndex < combinedItems.length
      ? `${listboxId}-option-${highlightedIndex}`
      : undefined;

  return (
    <form className="search-bar" onSubmit={handleSubmit} autoComplete="off" role="search">
      <label className="search-bar__label" htmlFor={inputId}>
        {label}
      </label>

      <div className="search-bar__controls">
        <div className="search-bar__field">
          <input
            ref={inputRef}
            id={inputId}
            className="search-bar__input"
            type="text"
            value={value}
            placeholder={placeholder}
            onChange={handleChange}
            onFocus={handleFocus}
            onBlur={handleBlur}
            onKeyDown={handleKeyDown}
            disabled={disabled}
            role="combobox"
            aria-autocomplete="list"
            aria-controls={showDropdown ? listboxId : undefined}
            aria-activedescendant={activeDescendant}
            aria-haspopup="listbox"
            aria-expanded={showDropdown}
          />

          {showDropdown && (
            <ul
              ref={listboxRef}
              id={listboxId}
              className="search-bar__suggestions"
              role="listbox"
              aria-label={suggestionsLabel}
            >
              {combinedItems.map((item, index) => (
                <li
                  key={item.city}
                  id={`${listboxId}-option-${index}`}
                  className={`search-bar__suggestion ${
                    index === highlightedIndex ? 'is-active' : ''
                  } ${item.isRecent ? 'is-recent' : ''}`}
                  role="option"
                  aria-selected={index === highlightedIndex}
                  onMouseDown={e => {
                    e.preventDefault();
                    selectItem(item.city, item.isRecent);
                  }}
                  onMouseEnter={() => setHighlightedIndex(index)}
                >
                  {item.isRecent && (
                    <span className="search-bar__recent-icon" aria-hidden="true">
                      <ClockIcon />
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
          className="search-bar__submit"
          disabled={isLoading || disabled || !value.trim()}
          aria-busy={isLoading}
        >
          {isLoading ? (
            <>
              <span className="search-bar__spinner" aria-hidden="true" />
              {loadingLabel}
            </>
          ) : (
            <>
              <span className="search-bar__submit-icon" aria-hidden="true">
                <SearchIcon />
              </span>
              <span>{submitLabel}</span>
            </>
          )}
        </button>
      </div>
    </form>
  );
});

export const SearchBar = memo(SearchBarComponent);

SearchBar.displayName = 'SearchBar';

export default SearchBar;
