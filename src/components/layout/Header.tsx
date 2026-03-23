import { Link, useLocation } from 'react-router-dom';

interface HeaderProps {
  workbenchMode?: boolean;
  onUndo?: () => void;
  onRedo?: () => void;
  onReset?: () => void;
  canUndo?: boolean;
  canRedo?: boolean;
}

export default function Header({ workbenchMode, onUndo, onRedo, onReset, canUndo, canRedo }: HeaderProps) {
  const location = useLocation();
  const isWorkbench = location.pathname.startsWith('/workbench');

  return (
    <header className="flex items-center justify-between px-6 py-3 border-b border-[#e5e7eb] bg-white shadow-[0px_1px_2px_0px_rgba(0,0,0,0.05)] relative z-10">
      {/* Left: Logo + Nav */}
      <div className="flex items-center gap-8">
        <Link to="/" className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-[rgba(19,127,236,0.1)] flex items-center justify-center">
            <svg width="25" height="28" viewBox="0 0 25 28" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M14.9267 22.75V19.8333H11.0378V10.1111H9.09334V13.0278H2.28778V5.25H9.09334V8.16667H14.9267V5.25H21.7322V13.0278H14.9267V10.1111H12.9822V17.8889H14.9267V14.9722H21.7322V22.75H14.9267ZM16.8711 11.0833H19.7878V7.19444H16.8711V11.0833ZM16.8711 20.8056H19.7878V16.9167H16.8711V20.8056ZM4.23223 11.0833H7.14889V7.19444H4.23223V11.0833Z" fill="#137FEC"/>
            </svg>
          </div>
          <span className="font-lexend font-bold text-lg text-[#111418] tracking-[-0.27px]">ResTool</span>
        </Link>

        <nav className="flex items-center gap-1 bg-[#f3f4f6] rounded-lg p-1">
          <Link
            to="/"
            className={`px-3 py-1.5 rounded-md font-lexend font-medium text-sm transition-colors ${
              !isWorkbench
                ? 'bg-white text-[#111418] shadow-[0px_1px_2px_0px_rgba(0,0,0,0.05)]'
                : 'text-[#6b7280] hover:text-[#374151]'
            }`}
          >
            Exercises
          </Link>
          {workbenchMode && (
            <div className={`flex items-center gap-2 px-3 py-1.5 rounded-md ${
              isWorkbench
                ? 'bg-white shadow-[0px_1px_2px_0px_rgba(0,0,0,0.05)]'
                : ''
            }`}>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M2 4H14M2 8H14M2 12H14" stroke="#137fec" strokeWidth="1.5" strokeLinecap="round"/>
              </svg>
              <span className="font-lexend font-bold text-sm text-[#137fec]">Resolution Proof</span>
            </div>
          )}
        </nav>
      </div>

      {/* Right: Actions */}
      {workbenchMode && (
        <div className="flex items-center gap-2">
          <button
            onClick={onUndo}
            disabled={!canUndo}
            className="flex items-center gap-2 h-8 px-3.5 rounded-lg border border-[#e5e7eb] bg-white text-[#111418] hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M3 5H9C10.6569 5 12 6.34315 12 8C12 9.65685 10.6569 11 9 11H7" stroke="#111418" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M5 3L3 5L5 7" stroke="#111418" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <span className="font-lexend font-bold text-xs">Undo</span>
          </button>
          <button
            onClick={onRedo}
            disabled={!canRedo}
            className="flex items-center gap-2 h-8 px-3.5 rounded-lg border border-[#e5e7eb] bg-white text-[#111418] hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M11 5H5C3.34315 5 2 6.34315 2 8C2 9.65685 3.34315 11 5 11H7" stroke="#111418" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M9 3L11 5L9 7" stroke="#111418" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <span className="font-lexend font-bold text-xs">Redo</span>
          </button>

          {/* Vertical divider */}
          <div className="px-1">
            <div className="w-px h-8 bg-[#e5e7eb]" />
          </div>

          <button
            onClick={onReset}
            className="flex items-center gap-1 h-8 px-3 rounded-lg bg-[#fef2f2] text-[#dc2626] hover:bg-red-100 transition-colors"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M3 3L11 11M3 11L11 3" stroke="#dc2626" strokeWidth="1.5" strokeLinecap="round"/>
            </svg>
            <span className="font-lexend font-bold text-xs">Reset</span>
          </button>
        </div>
      )}
    </header>
  );
}
