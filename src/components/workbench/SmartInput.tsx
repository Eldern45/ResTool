import { useRef, useEffect, forwardRef, useImperativeHandle } from 'react';

/** Handle exposed via ref so parent components can insert chars at cursor position. */
export interface SmartInputHandle {
  insertChar(char: string): void;
}

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

const SmartInput = forwardRef<SmartInputHandle, Props>(function SmartInput({
  value,
  onChange,
  onCommaSplit,
  convertSlash = false,
  placeholder,
  className = '',
  autoFocus = false,
  onKeyDown: externalKeyDown,
}, ref) {
  const inputRef = useRef<HTMLInputElement>(null);
  const cursorRef = useRef<number | null>(null);
  /** Last known cursor position — saved on blur/click so ref.insertChar() inserts at the right spot */
  const savedCursorRef = useRef<number>(0);

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

  const saveCursor = () => {
    savedCursorRef.current = inputRef.current?.selectionStart ?? value.length;
  };

  useImperativeHandle(ref, () => ({
    insertChar(char: string) {
      // If input is still focused (e.g. button used onMouseDown+preventDefault), the live
      // selectionStart reflects the current caret. Otherwise fall back to the last saved position.
      const live = document.activeElement === inputRef.current ? inputRef.current?.selectionStart : null;
      const pos = live ?? savedCursorRef.current;
      const newVal = value.slice(0, pos) + char + value.slice(pos);
      onChange(newVal);
      cursorRef.current = pos + char.length;
      inputRef.current?.focus();
    },
  }));

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
    if (convertSlash && e.key === '/' || e.key === '<') {
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
      onBlur={saveCursor}
      onClick={saveCursor}
      onKeyUp={saveCursor}
      onSelect={saveCursor}
      placeholder={placeholder}
      className={className}
      autoComplete="off"
      spellCheck={false}
    />
  );
});

export default SmartInput;
