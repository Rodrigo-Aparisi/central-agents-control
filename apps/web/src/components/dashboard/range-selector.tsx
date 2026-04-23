import { cn } from '@/lib/cn';

export type RangeDays = 1 | 7 | 30;

interface Props {
  value: RangeDays;
  onChange: (v: RangeDays) => void;
}

const OPTIONS: ReadonlyArray<{ value: RangeDays; label: string }> = [
  { value: 1, label: '24h' },
  { value: 7, label: '7d' },
  { value: 30, label: '30d' },
];

export function RangeSelector({ value, onChange }: Props) {
  return (
    <div className="inline-flex h-7 rule divide-x divide-[var(--rule-strong)] border overflow-hidden">
      {OPTIONS.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          aria-pressed={value === opt.value}
          className={cn(
            'tnum px-3 font-mono text-[11px] transition-colors duration-120',
            value === opt.value
              ? 'bg-foreground text-background'
              : 'bg-transparent text-muted-foreground hover:text-foreground',
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}
