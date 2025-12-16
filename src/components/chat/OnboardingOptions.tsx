import { cn } from '@/lib/utils';

interface OnboardingOption {
  id: string;
  emoji: string;
  label: string;
  description: string;
}

interface OnboardingOptionsProps {
  options: OnboardingOption[];
  onSelect: (id: string) => void;
  disabled?: boolean;
}

export function OnboardingOptions({ options, onSelect, disabled }: OnboardingOptionsProps) {
  return (
    <div className="grid grid-cols-1 gap-2 mt-4 max-w-md">
      {options.map((option) => (
        <button
          key={option.id}
          onClick={() => onSelect(option.id)}
          disabled={disabled}
          className={cn(
            "flex items-center gap-3 p-4 rounded-xl text-left transition-all duration-200",
            "bg-card/50 border border-border/50 hover:bg-card hover:border-primary/30",
            "hover:shadow-lg hover:shadow-primary/5",
            "disabled:opacity-50 disabled:cursor-not-allowed",
            "group"
          )}
        >
          <span className="text-2xl group-hover:scale-110 transition-transform duration-200">
            {option.emoji}
          </span>
          <div className="flex-1 min-w-0">
            <p className="font-medium text-foreground">{option.label}</p>
            <p className="text-xs text-muted-foreground line-clamp-2">
              {option.description}
            </p>
          </div>
        </button>
      ))}
    </div>
  );
}
