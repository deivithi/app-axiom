import { memo, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Brain, DollarSign, Target, Repeat, BookOpen, MessageSquare } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useHaptics } from '@/hooks/useHaptics';
import { useChatContext } from '@/contexts/ChatContext';

interface NavItem {
  path: string;
  icon: React.ElementType;
  label: string;
  isChat?: boolean;
}

const navItems: NavItem[] = [
  { path: '/intelligence', icon: Brain, label: 'Score' },
  { path: '/execution', icon: Target, label: 'Execução' },
  { path: '/habits', icon: Repeat, label: 'Hábitos' },
  { path: '/finances', icon: DollarSign, label: 'Finanças' },
  { path: '/memory', icon: BookOpen, label: 'Memória' },
];

const BottomNavigation = memo(() => {
  const navigate = useNavigate();
  const location = useLocation();
  const { haptic } = useHaptics();
  const { setChatOpen } = useChatContext();

  const handleNavigation = useCallback((path: string, isChat?: boolean) => {
    haptic('light');
    if (isChat) {
      setChatOpen(true);
    } else {
      navigate(path);
    }
  }, [navigate, haptic, setChatOpen]);

  const isActive = (path: string) => location.pathname === path;

  return (
    <nav 
      className={cn(
        "fixed bottom-0 left-0 right-0 z-50",
        "bg-card/95 backdrop-blur-xl",
        "border-t border-border/50",
        "pb-safe-bottom",
        "md:hidden" // Hide on desktop
      )}
    >
      <div className="flex items-center justify-around h-16 px-2">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.path);
          
          return (
            <button
              key={item.path}
              onClick={() => handleNavigation(item.path, item.isChat)}
              className={cn(
                "flex flex-col items-center justify-center",
                "w-14 h-14 rounded-xl",
                "transition-all duration-200 ease-out",
                "active:scale-95",
                active 
                  ? "text-primary" 
                  : "text-muted-foreground hover:text-foreground"
              )}
              aria-label={item.label}
              aria-current={active ? 'page' : undefined}
            >
              <div className={cn(
                "relative flex items-center justify-center",
                "w-10 h-10 rounded-lg",
                "transition-all duration-200",
                active && "bg-primary/10"
              )}>
                <Icon 
                  className={cn(
                    "w-5 h-5 transition-transform duration-200",
                    active && "scale-110"
                  )} 
                />
                {active && (
                  <span 
                    className="absolute -bottom-1 w-1 h-1 rounded-full bg-primary"
                    aria-hidden="true"
                  />
                )}
              </div>
              <span className={cn(
                "text-[10px] font-medium mt-0.5",
                "transition-opacity duration-200",
                active ? "opacity-100" : "opacity-70"
              )}>
                {item.label}
              </span>
            </button>
          );
        })}
        
        {/* Chat FAB */}
        <button
          onClick={() => handleNavigation('', true)}
          className={cn(
            "flex flex-col items-center justify-center",
            "w-14 h-14 -mt-4",
            "transition-all duration-200 ease-out",
            "active:scale-95"
          )}
          aria-label="Abrir chat"
        >
          <div className={cn(
            "flex items-center justify-center",
            "w-12 h-12 rounded-full",
            "bg-primary text-primary-foreground",
            "shadow-lg shadow-primary/30"
          )}>
            <MessageSquare className="w-5 h-5" />
          </div>
        </button>
      </div>
    </nav>
  );
});

BottomNavigation.displayName = 'BottomNavigation';

export { BottomNavigation };
