import { useState, useEffect, useRef } from 'react';

/**
 * useState that persists to localStorage under the given key. When the key
 * changes (e.g. switching tasks), the state is re-initialized from the new
 * key's stored value (or `initial` if none).
 */
export function usePersistedState<T>(key: string, initial: T): [T, React.Dispatch<React.SetStateAction<T>>] {
  const read = (): T => {
    try {
      const raw = localStorage.getItem(key);
      if (raw !== null) return JSON.parse(raw) as T;
    } catch {
      // Corrupted data — fall back to initial
    }
    return initial;
  };

  const [value, setValue] = useState<T>(read);
  const lastKeyRef = useRef(key);

  useEffect(() => {
    if (lastKeyRef.current !== key) {
      lastKeyRef.current = key;
      setValue(read());
      return;
    }
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // Storage full or unavailable — silently ignore
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, value]);

  return [value, setValue];
}
