import { useRef, useEffect } from 'react';

interface Props {
  value: string;
  onChange: (value: string) => void;
  onCommaSplit?: () => void; // called when user presses ","
  convertSlash?: boolean;   // "/" → "←" (for MGU inputs)
  placeholder?: string;
  className?: string;
  autoFocus?: boolean;
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
}

export default function SmartInput({
  value,
  onChange,
  onCommaSplit,
  convertSlash = false,
  placeholder,
  className = '',
  autoFocus = false,
  onKeyDown: externalKeyDown,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const cursorRef = useRef<number | null>(null);

  // Restore cursor position after React re-render
  useEffect(() => {
    if (cursorRef.current !== null && inputRef.current) {
      inputRef.current.selectionStart = cursorRef.current;
      inputRef.current.selectionEnd = cursorRef.current;
      cursorRef.current = null;
    }
  });

  useEffect(() => {
    if (autoFocus && inputRef.current) {
      inputRef.current.focus();
    }
  }, [autoFocus]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    const input = e.currentTarget;
    const pos = input.selectionStart ?? 0;
    const end = input.selectionEnd ?? pos;

    // Dash or tilde → insert ¬ (negation)
    if (e.key === '-' || e.key === '~') {
      e.preventDefault();
      const newVal = value.slice(0, pos) + '¬' + value.slice(end);
      onChange(newVal);
      cursorRef.current = pos + 1;
      return;
    }

    // Slash → insert ← (binding arrow) in MGU mode
    if (convertSlash && e.key === '/') {
      e.preventDefault();
      const newVal = value.slice(0, pos) + '←' + value.slice(end);
      onChange(newVal);
      cursorRef.current = pos + 1;
      return;
    }

    // Comma → split into new binding (MGU)
    if (e.key === ',' && onCommaSplit) {
      e.preventDefault();
      onCommaSplit();
      return;
    }

    // Auto-close parentheses: typing "(" → insert "()" and cursor between
    if (e.key === '(') {
      e.preventDefault();
      const newVal = value.slice(0, pos) + '()' + value.slice(end);
      onChange(newVal);
      cursorRef.current = pos + 1;
      return;
    }

    // Skip over closing paren if cursor is right before one
    if (e.key === ')' && pos < value.length && value[pos] === ')') {
      e.preventDefault();
      cursorRef.current = pos + 1;
      // Force re-render to move cursor
      onChange(value);
      return;
    }

    // Backspace: if deleting opening paren and next char is closing paren, delete both
    if (e.key === 'Backspace' && pos > 0 && pos < value.length) {
      if (value[pos - 1] === '(' && value[pos] === ')') {
        e.preventDefault();
        const newVal = value.slice(0, pos - 1) + value.slice(pos + 1);
        onChange(newVal);
        cursorRef.current = pos - 1;
        return;
      }
    }

    externalKeyDown?.(e);
  };

  return (
    <input
      ref={inputRef}
      type="text"
      value={value}
      onChange={e => onChange(e.target.value)}
      onKeyDown={handleKeyDown}
      placeholder={placeholder}
      className={className}
      autoComplete="off"
      spellCheck={false}
    />
  );
}
