import { Check, Plus } from 'lucide-react';

interface WatchlistButtonProps {
  saved: boolean;
  onToggle: () => void;
  className?: string;
  compact?: boolean;
}

export default function WatchlistButton({
  saved,
  onToggle,
  className = '',
  compact = false,
}: WatchlistButtonProps) {
  if (document.documentElement.classList.contains('noir-tv-app')) {
    return null;
  }

  const label = saved ? 'إزالة من قائمتي' : 'إضافة إلى قائمتي';

  return (
    <button
      type="button"
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        onToggle();
      }}
      className={`noir-save-button ${compact ? 'noir-save-button--compact' : ''} ${
        saved ? 'is-saved' : ''
      } ${className}`}
      aria-label={label}
      aria-pressed={saved}
      title={label}
    >
      {saved ? (
        <Check className={compact ? 'w-3.5 h-3.5' : 'w-[18px] h-[18px]'} strokeWidth={3} />
      ) : (
        <Plus className={compact ? 'w-4 h-4' : 'w-5 h-5'} strokeWidth={2.4} />
      )}
    </button>
  );
}
