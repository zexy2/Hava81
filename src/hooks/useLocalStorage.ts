/**
 * useLocalStorage Hook
 * Persist state to localStorage with automatic serialization
 */

import { useState, useEffect, useCallback, useRef } from 'react';

type SetValue<T> = (value: T | ((prev: T) => T)) => void;

interface UseLocalStorageOptions<T> {
  serializer?: (value: T) => string;
  deserializer?: (value: string) => T;
}

export function useLocalStorage<T>(
  key: string,
  initialValue: T,
  options: UseLocalStorageOptions<T> = {}
): [T, SetValue<T>, () => void] {
  const { serializer = JSON.stringify, deserializer = JSON.parse } = options;

  // Get stored value or fall back to initial
  const readValue = useCallback((): T => {
    if (typeof window === 'undefined') {
      return initialValue;
    }

    try {
      const item = window.localStorage.getItem(key);
      return item ? deserializer(item) : initialValue;
    } catch (error) {
      console.warn(`Error reading localStorage key "${key}":`, error);
      return initialValue;
    }
  }, [key, initialValue, deserializer]);

  const [storedValue, setStoredValue] = useState<T>(readValue);
  const storedValueRef = useRef(storedValue);

  useEffect(() => {
    storedValueRef.current = storedValue;
  }, [storedValue]);

  // Update localStorage when value changes
  const setValue: SetValue<T> = useCallback(
    value => {
      try {
        const newValue = value instanceof Function ? value(storedValueRef.current) : value;
        const serializedValue = serializer(newValue);
        window.localStorage.setItem(key, serializedValue);
        storedValueRef.current = newValue;
        setStoredValue(newValue);

        // Dispatch event so other tabs/windows can sync
        window.dispatchEvent(
          new StorageEvent('storage', {
            key,
            newValue: serializedValue,
          })
        );
      } catch (error) {
        console.warn(`Error setting localStorage key "${key}":`, error);
      }
    },
    [key, serializer]
  );

  // Remove from localStorage
  const removeValue = useCallback(() => {
    try {
      window.localStorage.removeItem(key);
      storedValueRef.current = initialValue;
      setStoredValue(initialValue);
      window.dispatchEvent(
        new StorageEvent('storage', {
          key,
          newValue: null,
        })
      );
    } catch (error) {
      console.warn(`Error removing localStorage key "${key}":`, error);
    }
  }, [key, initialValue]);

  // Listen for changes from other tabs/windows
  useEffect(() => {
    const handleStorageChange = (event: StorageEvent) => {
      if (event.key !== key) return;
      if (event.newValue === null) {
        storedValueRef.current = initialValue;
        setStoredValue(initialValue);
        return;
      }
      try {
        const nextValue = deserializer(event.newValue);
        storedValueRef.current = nextValue;
        setStoredValue(nextValue);
      } catch {
        setStoredValue(initialValue);
        storedValueRef.current = initialValue;
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, [key, deserializer, initialValue]);

  return [storedValue, setValue, removeValue];
}

export default useLocalStorage;
