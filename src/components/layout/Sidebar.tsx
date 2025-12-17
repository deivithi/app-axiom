import { Link, useLocation, useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { Target, Wallet, Brain, Settings, LogOut, Menu, User, Sun, Moon, RefreshCw, Sparkles, CheckSquare, ChevronLeft, ChevronRight } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { useState } from 'react';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { useTheme } from 'next-themes';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useSidebar } from '@/contexts/SidebarContext';
import axiomLogo from '@/assets/axiom-logo.png';

// 5 módulos core com suporte a badges
const navItems = [
  { icon: Sparkles, label: 'Motor de Inteligência', path: '/intelligence', description: 'Análise e insights', badge: 0 },
  { icon: Wallet, label: 'CFO Pessoal', path: '/finances', description: 'Controle financeiro', badge: 0 },
  { icon: CheckSquare, label: 'Sistema de Execução', path: '/execution', description: 'Tarefas e projetos', badge: 0 },
  { icon: Target, label: 'Arquiteto de Rotina', path: '/habits', description: 'Hábitos e rotinas', badge: 0 },
  { icon: Brain, label: 'Segunda Memória', path: '/memory', description: 'Pensamentos e reflexões', badge: 0 },
];

const NavContent = ({ onClose, collapsed = false }: { onClose?: () => void; collapsed?: boolean }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { signOut } = useAuth();
  const { theme, setTheme } = useTheme();

  const handleUserClick = () => {
    navigate('/settings');
    onClose?.();
  };

  const handleThemeToggle = () => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  };

  const handleRefresh = () => {
    window.location.reload();
  };

  const NavItemWrapper = ({ children, label }: { children: React.ReactNode; label: string }) => {
    if (collapsed) {
      return (
        <Tooltip delayDuration={0}>
          <TooltipTrigger asChild>
            {children}
          </TooltipTrigger>
          <TooltipContent side="right" className="font-medium">
            {label}
          </TooltipContent>
        </Tooltip>
      );
    }
    return <>{children}</>;
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header com logo + glassmorphism */}
      <div className={cn(
        "p-4 text-center border-b border-border-subtle",
        "bg-glass backdrop-blur-[var(--glass-blur)]",
        collapsed && "px-2"
      )}>
        <img 
          src={axiomLogo} 
          alt="Axiom Logo" 
          className={cn(
            "mx-auto mb-2 object-contain",
            "transition-all duration-[var(--duration-base)] ease-[var(--ease-smooth)]",
            collapsed ? "w-10 h-10" : "w-28 h-auto"
          )} 
        />
        {!collapsed && (
          <p className="text-xs text-muted-foreground">Estrategista conversacional</p>
        )}
      </div>
      
      {/* Navigation */}
      <nav 
        className={cn(
          "flex-1 p-4 space-y-2 overflow-y-auto",
          collapsed && "p-2"
        )}
        role="navigation"
        aria-label="Navegação principal"
        id="sidebar-nav"
      >
        {/* 5 módulos core */}
        {navItems.map(item => {
          const isActive = location.pathname === item.path;
          return (
            <NavItemWrapper key={item.path} label={item.label}>
              <Link
                to={item.path}
                onClick={onClose}
                aria-current={isActive ? 'page' : undefined}
                className={cn(
                  'flex items-center gap-4 rounded-lg',
                  'transition-all duration-[var(--duration-fast)] ease-[var(--ease-smooth)]',
                  collapsed ? 'justify-center p-2' : 'px-3 py-2.5',
                  isActive 
                    ? 'text-primary' 
                    : 'text-muted-foreground hover:text-foreground'
                )}
              >
                <div className={cn(
                  'relative w-10 h-10 rounded-full flex items-center justify-center border-2',
                  'transition-all duration-[var(--duration-fast)] ease-[var(--ease-smooth)]',
                  isActive 
                    ? 'bg-primary border-primary text-primary-foreground shadow-glow-primary' 
                    : 'border-border-medium text-muted-foreground hover:border-primary/50 hover:text-primary/70'
                )}>
                  <item.icon className="h-5 w-5" />
                  
                  {/* Badge de notificação */}
                  {item.badge > 0 && (
                    <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-destructive text-[10px] font-bold flex items-center justify-center text-destructive-foreground shadow-sm">
                      {item.badge > 9 ? '9+' : item.badge}
                    </span>
                  )}
                </div>
                {!collapsed && (
                  <div>
                    <span className="font-medium block">{item.label}</span>
                    <p className="text-xs text-muted-foreground">{item.description}</p>
                  </div>
                )}
              </Link>
            </NavItemWrapper>
          );
        })}

        {/* Separador com token semântico */}
        <div className="border-t border-border-subtle my-2" />

        {/* Configurações */}
        <NavItemWrapper label="Configurações">
          <Link
            to="/settings"
            onClick={onClose}
            aria-current={location.pathname === '/settings' ? 'page' : undefined}
            className={cn(
              'flex items-center gap-4 rounded-lg',
              'transition-all duration-[var(--duration-fast)] ease-[var(--ease-smooth)]',
              collapsed ? 'justify-center p-2' : 'px-3 py-2.5',
              location.pathname === '/settings' 
                ? 'text-primary' 
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            <div className={cn(
              'w-10 h-10 rounded-full flex items-center justify-center border-2',
              'transition-all duration-[var(--duration-fast)] ease-[var(--ease-smooth)]',
              location.pathname === '/settings' 
                ? 'bg-primary border-primary text-primary-foreground shadow-glow-primary' 
                : 'border-border-medium text-muted-foreground hover:border-primary/50 hover:text-primary/70'
            )}>
              <Settings className="h-5 w-5" />
            </div>
            {!collapsed && <span className="font-medium">Configurações</span>}
          </Link>
        </NavItemWrapper>
      </nav>

      {/* Bottom bar com glassmorphism */}
      <div className={cn(
        "p-4 border-t border-border-subtle flex items-center",
        "bg-glass backdrop-blur-[var(--glass-blur)]",
        collapsed ? "flex-col gap-2 p-2" : "justify-around"
      )}>
        <Tooltip delayDuration={0}>
          <TooltipTrigger asChild>
            <Button 
              variant="ghost" 
              size="icon" 
              className="text-muted-foreground hover:text-foreground transition-colors duration-[var(--duration-fast)]"
              onClick={handleUserClick}
              aria-label="Configurações de usuário"
            >
              <User className="h-5 w-5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side={collapsed ? "right" : "top"}>Configurações</TooltipContent>
        </Tooltip>
        
        <Tooltip delayDuration={0}>
          <TooltipTrigger asChild>
            <Button 
              variant="ghost" 
              size="icon" 
              className="text-muted-foreground hover:text-foreground transition-colors duration-[var(--duration-fast)]"
              onClick={handleThemeToggle}
              aria-label={theme === 'dark' ? 'Mudar para tema claro' : 'Mudar para tema escuro'}
            >
              {theme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
            </Button>
          </TooltipTrigger>
          <TooltipContent side={collapsed ? "right" : "top"}>Alternar tema</TooltipContent>
        </Tooltip>
        
        <Tooltip delayDuration={0}>
          <TooltipTrigger asChild>
            <Button 
              variant="ghost" 
              size="icon" 
              className="text-muted-foreground hover:text-foreground transition-colors duration-[var(--duration-fast)]"
              onClick={handleRefresh}
              aria-label="Atualizar página"
            >
              <RefreshCw className="h-5 w-5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side={collapsed ? "right" : "top"}>Atualizar</TooltipContent>
        </Tooltip>
        
        <Tooltip delayDuration={0}>
          <TooltipTrigger asChild>
            <Button 
              variant="ghost" 
              size="icon" 
              className="text-muted-foreground hover:text-destructive transition-colors duration-[var(--duration-fast)]"
              onClick={signOut}
              aria-label="Sair da conta"
            >
              <LogOut className="h-5 w-5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side={collapsed ? "right" : "top"}>Sair</TooltipContent>
        </Tooltip>
      </div>
    </div>
  );
};

export const Sidebar = () => {
  const [mobileOpen, setMobileOpen] = useState(false);
  const { collapsed, toggle } = useSidebar();

  return (
    <>
      {/* Mobile Trigger */}
      <div className="md:hidden fixed top-4 left-4 z-50">
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetTrigger asChild>
            <Button 
              variant="outline" 
              size="icon" 
              className="bg-card/80 backdrop-blur-sm border-border-subtle shadow-md"
              aria-label="Abrir menu de navegação"
            >
              <Menu className="h-5 w-5" />
            </Button>
          </SheetTrigger>
          <SheetContent 
            side="left" 
            className={cn(
              "w-64 p-0",
              "bg-glass backdrop-blur-[var(--glass-blur)]",
              "border-r border-glass-border"
            )}
          >
            <NavContent onClose={() => setMobileOpen(false)} />
          </SheetContent>
        </Sheet>
      </div>

      {/* Desktop Sidebar com glassmorphism */}
      <aside 
        className={cn(
          "hidden md:flex flex-col h-screen fixed left-0 top-0",
          "transition-[width] duration-[var(--duration-base)] ease-[var(--ease-smooth)] will-change-[width]",
          // Glassmorphism
          "bg-glass backdrop-blur-[var(--glass-blur)]",
          "border-r border-glass-border",
          "shadow-lg",
          collapsed ? "w-16" : "w-64"
        )}
        aria-label="Barra lateral de navegação"
      >
        <NavContent collapsed={collapsed} />
        
        {/* Toggle Button refinado */}
        <Tooltip delayDuration={0}>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              onClick={toggle}
              aria-expanded={!collapsed}
              aria-controls="sidebar-nav"
              aria-label={collapsed ? "Expandir menu" : "Colapsar menu"}
              className={cn(
                "absolute -right-3 top-20 h-6 w-6 rounded-full",
                "bg-elevated-3 border border-border-medium",
                "shadow-md hover:shadow-lg",
                "text-muted-foreground hover:text-primary",
                "transition-all duration-[var(--duration-fast)] ease-[var(--ease-smooth)]"
              )}
            >
              {collapsed ? (
                <ChevronRight className="h-3 w-3" />
              ) : (
                <ChevronLeft className="h-3 w-3" />
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent side="right">
            {collapsed ? "Expandir [" : "Colapsar ["}
          </TooltipContent>
        </Tooltip>
      </aside>
    </>
  );
};
