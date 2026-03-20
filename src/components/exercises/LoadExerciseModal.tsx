import { useState, useRef, useCallback } from 'react';
import Modal from '../common/Modal';

interface Props {
  open: boolean;
  onClose: () => void;
  onImport: (data: unknown) => string | null; // returns error message or null
}

export default function LoadExerciseModal({ open, onClose, onImport }: Props) {
  const [error, setError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const processFile = useCallback((file: File) => {
    setError(null);
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = JSON.parse(e.target?.result as string);
        const err = onImport(data);
        if (err) {
          setError(err);
        } else {
          onClose();
        }
      } catch {
        setError('Invalid JSON file.');
      }
    };
    reader.readAsText(file);
  }, [onImport, onClose]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  }, [processFile]);

  return (
    <Modal open={open} onClose={onClose} title="Load Exercise">
      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
          dragging ? 'border-primary bg-primary-tint' : 'border-gray-300 hover:border-gray-400'
        }`}
      >
        <div className="text-gray-500 mb-2">
          <svg className="mx-auto h-10 w-10 text-gray-400 mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
          </svg>
          <p className="text-sm font-medium text-gray-600">
            Drag & drop a JSON file here, or click to browse
          </p>
          <p className="text-xs text-gray-400 mt-1">
            Accepts .json task files
          </p>
        </div>
        <input
          ref={inputRef}
          type="file"
          accept=".json"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) processFile(file);
            e.target.value = '';
          }}
        />
      </div>
      {error && (
        <p className="mt-3 text-sm text-red-600">{error}</p>
      )}
    </Modal>
  );
}
