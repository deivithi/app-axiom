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
        "bottom-nav-glass",
        "border-t border-primary/10",
        "pb-safe-bottom pl-safe-left pr-safe-right",
        "md:hidden"
      )}
    >
      <div className="flex items-center justify-around min-h-[56px] px-2">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.path);
          
          return (
            <button
              key={item.path}
              onClick={() => handleNavigation(item.path, item.isChat)}
              className={cn(
                "relative flex flex-col items-center justify-center",
                "min-w-[44px] min-h-[44px] flex-1",
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
                      className="absolute inset-[-4px] bg-primary/10 rounded-lg"
                      transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                    />
                  )}
                  
                  <Icon 
                    className={cn(
                      "relative z-10 w-6 h-6 flex-shrink-0 transition-all duration-200",
                      active ? "text-primary scale-110" : "text-muted-foreground"
                    )}
                    aria-hidden="true"
                  />
                  
                  {/* Badge */}
                  {item.badge && item.badge > 0 && (
                    <span 
                      className="absolute -top-1 -right-1 z-20 flex items-center justify-center min-w-[16px] h-[16px] px-1 text-[9px] font-bold text-destructive-foreground bg-destructive rounded-full"
                      role="status"
                      aria-label={`${item.badge} ${item.badge === 1 ? 'item pendente' : 'itens pendentes'}`}
                    >
                      <span aria-hidden="true">{item.badge > 99 ? '99+' : item.badge}</span>
                    </span>
                  )}
                </div>
                
                <span className={cn(
                  "nav-item-label-clamp",
                  "text-center max-w-full overflow-hidden",
                  "transition-colors duration-200",
                  active ? "text-primary" : "text-muted-foreground"
                )}>
                  {item.label}
                </span>
              </div>
              
              {/* Animated dot indicator */}
              {active && (
                <motion.span 
                  layoutId="activeTabDot"
                  className="absolute bottom-1 w-1 h-1 rounded-full bg-primary"
                  transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                  aria-hidden="true"
                />
              )}
            </button>
          );
        })}
        
        {/* Chat FAB */}
        <button
          onClick={() => handleNavigation('', true)}
          className={cn(
            "flex flex-col items-center justify-center",
            "min-w-[44px] min-h-[44px] -mt-3 flex-shrink-0",
            "transition-all duration-200 ease-out",
            "active:scale-95",
            "-webkit-tap-highlight-color-transparent"
          )}
          aria-label="Abrir chat"
        >
          <div className={cn(
            "flex items-center justify-center",
            "w-12 h-12 rounded-full",
            "bg-primary text-primary-foreground",
            "shadow-lg shadow-primary/30"
          )}>
            <MessageSquare className="w-5 h-5" aria-hidden="true" />
          </div>
        </button>
      </div>
    </nav>
  );
});

BottomNavigation.displayName = 'BottomNavigation';

export { BottomNavigation };
