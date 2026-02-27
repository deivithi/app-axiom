import { memo, useCallback, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Brain, DollarSign, Target, Repeat, BookOpen, MessageSquare } from 'lucide-react';
import { cn } from '@/lib/utils';
import { haptics } from '@/lib/haptics';
import { useChatContext } from '@/contexts/ChatContext';
import { useNavBadges } from '@/hooks/useNavBadges';

interface NavItem {
  path: string;
  icon: React.ElementType;
  label: string;
  isChat?: boolean;
  badge?: number;
}

const BottomNavigation = memo(() => {
  const navigate = useNavigate();
  const location = useLocation();
  const { setChatOpen } = useChatContext();
  const badges = useNavBadges();

  const navItems: NavItem[] = useMemo(() => [
    { path: '/intelligence', icon: Brain, label: 'Score' },
    { path: '/execution', icon: Target, label: 'Execução', badge: badges.execution },
    { path: '/habits', icon: Repeat, label: 'Hábitos', badge: badges.habits },
    { path: '/finances', icon: DollarSign, label: 'Finanças', badge: badges.finances },
    { path: '/memory', icon: BookOpen, label: 'Memória' },
  ], [badges]);

  const handleNavigation = useCallback((path: string, isChat?: boolean) => {
    haptics.light();
    if (isChat) {
      setChatOpen(true);
    } else {
      navigate(path);
    }
  }, [navigate, setChatOpen]);

  const isActive = (path: string) => location.pathname === path;

  return (
    <nav
      className={cn(
        "fixed bottom-0 left-0 right-0 z-fixed",
        "bg-background/80 backdrop-blur-xl",
        "border-t border-border/50",
        "pb-safe-bottom pl-safe-left pr-safe-right",
        "md:hidden shadow-lg",
        "supports-[backdrop-filter]:bg-background/60"
      )}
    >
      <div className="flex items-center justify-around min-h-[64px] px-2">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.path);

          return (
            <button
              key={item.path}
              onClick={() => handleNavigation(item.path, item.isChat)}
              className={cn(
                "relative flex flex-col items-center justify-center",
                "min-w-[48px] h-[56px] flex-1",
                "transition-all duration-200 ease-out",
                "active:scale-95",
                "-webkit-tap-highlight-color-transparent"
              )}
              aria-label={item.label}
              aria-current={active ? 'page' : undefined}
            >
              <div className="flex flex-col items-center gap-1 p-1 w-full">
                <div className="relative flex items-center justify-center">
                  {/* Animated background pill */}
                  {active && (
                    <motion.div
                      layoutId="activeTabBg"
                      className="absolute inset-[-6px] bg-primary/15 rounded-xl"
                      transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                    />
                  )}

                  <Icon
                    className={cn(
                      "relative z-10 w-6 h-6 flex-shrink-0 transition-all duration-200",
                      active ? "text-primary scale-110 drop-shadow-[0_0_8px_rgba(10,132,255,0.4)]" : "text-muted-foreground hover:text-foreground"
                    )}
                    aria-hidden="true"
                  />

                  {/* Badge */}
                  {item.badge && item.badge > 0 && (
                    <span
                      className="absolute -top-[6px] -right-[6px] z-20 flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-bold text-white bg-destructive rounded-full border-2 border-background shadow-sm"
                      role="status"
                      aria-label={`${item.badge} ${item.badge === 1 ? 'item pendente' : 'itens pendentes'}`}
                    >
                      <span aria-hidden="true">{item.badge > 99 ? '99+' : item.badge}</span>
                    </span>
                  )}
                </div>

                <span className={cn(
                  "nav-item-label-clamp",
                  "text-center max-w-full overflow-hidden mt-[2px]",
                  "transition-colors duration-200",
                  active ? "text-primary font-medium tracking-tight text-[11px]" : "text-muted-foreground font-normal text-[10px]"
                )}>
                  {item.label}
                </span>
              </div>
            </button>
          );
        })}

        {/* Chat FAB (Centralized / Elevated) */}
        <button
          onClick={() => handleNavigation('', true)}
          className={cn(
            "relative flex flex-col items-center justify-center group",
            "min-w-[56px] min-h-[56px] -mt-6 flex-shrink-0",
            "transition-transform duration-300 ease-[var(--ease-spring)]",
            "active:scale-90",
            "-webkit-tap-highlight-color-transparent"
          )}
          aria-label="Abrir chat do Axiom"
        >
          <div className={cn(
            "flex items-center justify-center",
            "w-[52px] h-[52px] rounded-full",
            "bg-gradient-to-br from-primary to-accent",
            "text-white border-[3px] border-background",
            "shadow-[0_8px_16px_-4px_rgba(191,90,242,0.4)]",
            "group-hover:shadow-[0_12px_20px_-4px_rgba(191,90,242,0.6)]",
            "transition-shadow duration-300"
          )}>
            <MessageSquare className="w-[22px] h-[22px] fill-white/10" aria-hidden="true" />
            <motion.div
              className="absolute inset-0 rounded-full bg-white/20"
              initial={{ scale: 0, opacity: 0 }}
              whileTap={{ scale: 1.5, opacity: 0 }}
              transition={{ duration: 0.4 }}
            />
          </div>
        </button>
      </div>
    </nav>
  );
});

BottomNavigation.displayName = 'BottomNavigation';

export { BottomNavigation };
