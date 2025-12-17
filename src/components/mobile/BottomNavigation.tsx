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
        "bg-card/95 backdrop-blur-xl",
        "border-t border-border/50",
        "pb-safe-bottom",
        "md:hidden"
      )}
    >
      <div className="flex items-center justify-between h-16 px-1 gap-0.5">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.path);
          
          return (
            <button
              key={item.path}
              onClick={() => handleNavigation(item.path, item.isChat)}
              className={cn(
                "relative flex flex-col items-center justify-center",
                "flex-1 min-w-0 h-14 rounded-xl",
                "transition-colors duration-200 ease-out",
                "active:scale-95",
                active 
                  ? "text-primary" 
                  : "text-muted-foreground hover:text-foreground"
              )}
              aria-label={item.label}
              aria-current={active ? 'page' : undefined}
            >
              <div className="relative flex items-center justify-center w-8 h-8 rounded-lg">
                {/* Animated background pill */}
                {active && (
                  <motion.div
                    layoutId="activeTabBg"
                    className="absolute inset-0 bg-primary/10 rounded-lg"
                    transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                  />
                )}
                
                <Icon 
                  className={cn(
                    "relative z-10 w-5 h-5 transition-transform duration-200",
                    active && "scale-110"
                  )} 
                />
                
                {/* Badge */}
                {item.badge && item.badge > 0 && (
                  <span className="absolute -top-1 -right-1 z-20 flex items-center justify-center min-w-[18px] h-[18px] px-1 text-[10px] font-bold text-destructive-foreground bg-destructive rounded-full">
                    {item.badge > 99 ? '99+' : item.badge}
                  </span>
                )}
              </div>
              
              {/* Animated dot indicator */}
              {active && (
                <motion.span 
                  layoutId="activeTabDot"
                  className="absolute bottom-1.5 w-1 h-1 rounded-full bg-primary"
                  transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                  aria-hidden="true"
                />
              )}
              
              <span className={cn(
                "text-[10px] font-medium mt-0.5",
                "max-w-full truncate px-0.5 leading-tight",
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
            "w-12 h-14 -mt-4 flex-shrink-0",
            "transition-all duration-200 ease-out",
            "active:scale-95"
          )}
          aria-label="Abrir chat"
        >
          <div className={cn(
            "flex items-center justify-center",
            "w-11 h-11 rounded-full",
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
