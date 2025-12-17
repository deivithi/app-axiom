import { Link, useLocation, useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { Target, Wallet, Brain, Settings, LogOut, Menu, User, Sun, Moon, RefreshCw, Sparkles, CheckSquare, ChevronLeft, ChevronRight, LucideIcon } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { useState } from 'react';
import { MobileDrawer } from './MobileDrawer';
import { useTheme } from 'next-themes';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useSidebar } from '@/contexts/SidebarContext';
import { Logo, LogoIcon } from './Logo';

// === INTERFACES ===
interface NavItem {
  label: string;
  path: string;
  href?: string; // Link externo opcional
  icon: LucideIcon;
  description?: string;
  badge?: number | string;
}

// Type alias para compatibilidade
type Links = NavItem;

// 5 módulos core com suporte a badges
const navItems: NavItem[] = [
  { icon: Sparkles, label: 'Motor de Inteligência', path: '/intelligence', description: 'Análise e insights', badge: 0 },
  { icon: Wallet, label: 'CFO Pessoal', path: '/finances', description: 'Controle financeiro', badge: 0 },
  { icon: CheckSquare, label: 'Sistema de Execução', path: '/execution', description: 'Tarefas e projetos', badge: 0 },
  { icon: Target, label: 'Arquiteto de Rotina', path: '/habits', description: 'Hábitos e rotinas', badge: 0 },
  { icon: Brain, label: 'Segunda Memória', path: '/memory', description: 'Pensamentos e reflexões', badge: 0 },
];

const NavContent = ({ onClose, collapsed = false, onToggle }: { onClose?: () => void; collapsed?: boolean; onToggle?: () => void }) => {
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
      {/* Header com logo + toggle interno */}
      <div 
        className={cn("p-4 flex items-center", collapsed ? "px-2 flex-col gap-2" : "justify-between")}
        style={{
          borderBottom: '1px solid var(--color-border-subtle)',
          background: 'var(--color-glass-bg)',
          backdropFilter: 'blur(var(--glass-blur))'
        }}
      >
        {collapsed ? <LogoIcon size="md" /> : <Logo size="lg" />}
        
        {/* Toggle button interno simplificado */}
        {onToggle && (
          <button 
            onClick={onToggle}
            className="p-2 rounded-lg transition-colors"
            style={{ color: 'var(--color-text-secondary)' }}
            onMouseOver={(e) => {
              e.currentTarget.style.background = 'var(--color-bg-elevated-2)';
              e.currentTarget.style.color = 'var(--color-text-primary)';
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.background = 'transparent';
              e.currentTarget.style.color = 'var(--color-text-secondary)';
            }}
            aria-label={collapsed ? "Expandir menu" : "Colapsar menu"}
            aria-expanded={!collapsed}
            aria-controls="sidebar-nav"
          >
            {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
          </button>
        )}
      </div>
      
      {/* Navigation */}
      <nav 
        className={cn("flex-1 p-4 space-y-2 overflow-y-auto", collapsed && "p-2")}
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
                  'flex items-center gap-4 rounded-lg transition-all duration-[var(--duration-fast)] ease-[var(--ease-smooth)]',
                  collapsed ? 'justify-center p-2' : 'px-3 py-2.5'
                )}
                style={{ color: isActive ? 'var(--color-primary)' : 'var(--color-text-secondary)' }}
                onMouseOver={(e) => !isActive && (e.currentTarget.style.color = 'var(--color-text-primary)')}
                onMouseOut={(e) => !isActive && (e.currentTarget.style.color = 'var(--color-text-secondary)')}
              >
                {/* Ícone circular */}
                <div 
                  className="relative w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all duration-[var(--duration-fast)] ease-[var(--ease-smooth)] flex-shrink-0"
                  style={{
                    background: isActive ? 'var(--color-primary)' : 'transparent',
                    borderColor: isActive ? 'var(--color-primary)' : 'var(--color-border-medium)',
                    color: isActive ? 'var(--color-primary-foreground)' : 'inherit',
                    boxShadow: isActive ? 'var(--shadow-glow)' : 'none'
                  }}
                >
                  <item.icon className="h-5 w-5" />
                  
                  {/* Mini badge quando colapsado */}
                  {collapsed && item.badge !== undefined && item.badge !== 0 && (
                    <span 
                      className="absolute -top-1 -right-1 w-4 h-4 rounded-full text-[9px] font-bold flex items-center justify-center"
                      style={{ 
                        background: 'var(--color-primary)', 
                        color: 'white' 
                      }}
                    >
                      {typeof item.badge === 'number' && item.badge > 9 ? '•' : item.badge}
                    </span>
                  )}
                </div>
                
                {/* Label + Badge inline quando expandido */}
                {!collapsed && (
                  <>
                    <div className="flex-1 min-w-0">
                      <span className="font-medium block truncate">{item.label}</span>
                      <p className="text-xs truncate" style={{ color: 'var(--color-text-secondary)' }}>{item.description}</p>
                    </div>
                    
                    {/* Badge pill inline */}
                    {item.badge !== undefined && item.badge !== 0 && (
                      <span 
                        className="ml-auto px-2 py-0.5 text-xs font-semibold rounded-full flex-shrink-0 transition-all duration-[var(--duration-fast)]"
                        style={{ 
                          background: 'var(--color-primary)', 
                          color: 'white' 
                        }}
                      >
                        {typeof item.badge === 'number' && item.badge > 9 ? '9+' : item.badge}
                      </span>
                    )}
                  </>
                )}
              </Link>
            </NavItemWrapper>
          );
        })}

        {/* Separador */}
        <div style={{ borderTop: '1px solid var(--color-border-subtle)', margin: '0.5rem 0' }} />

        {/* Configurações */}
        <NavItemWrapper label="Configurações">
          <Link
            to="/settings"
            onClick={onClose}
            aria-current={location.pathname === '/settings' ? 'page' : undefined}
            className={cn(
              'flex items-center gap-4 rounded-lg transition-all duration-[var(--duration-fast)] ease-[var(--ease-smooth)]',
              collapsed ? 'justify-center p-2' : 'px-3 py-2.5'
            )}
            style={{ color: location.pathname === '/settings' ? 'var(--color-primary)' : 'var(--color-text-secondary)' }}
          >
            <div 
              className="w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all duration-[var(--duration-fast)] ease-[var(--ease-smooth)]"
              style={{
                background: location.pathname === '/settings' ? 'var(--color-primary)' : 'transparent',
                borderColor: location.pathname === '/settings' ? 'var(--color-primary)' : 'var(--color-border-medium)',
                color: location.pathname === '/settings' ? 'var(--color-primary-foreground)' : 'inherit',
                boxShadow: location.pathname === '/settings' ? 'var(--shadow-glow)' : 'none'
              }}
            >
              <Settings className="h-5 w-5" />
            </div>
            {!collapsed && <span className="font-medium">Configurações</span>}
          </Link>
        </NavItemWrapper>
      </nav>

      {/* Bottom bar */}
      <div 
        className={cn("p-4 flex items-center", collapsed ? "flex-col gap-2 p-2" : "justify-around")}
        style={{
          borderTop: '1px solid var(--color-border-subtle)',
          background: 'var(--color-glass-bg)',
          backdropFilter: 'blur(var(--glass-blur))'
        }}
      >
        <Tooltip delayDuration={0}>
          <TooltipTrigger asChild>
            <Button 
              variant="ghost" 
              size="icon" 
              className="transition-colors duration-[var(--duration-fast)]"
              style={{ color: 'var(--color-text-secondary)' }}
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
              className="transition-colors duration-[var(--duration-fast)]"
              style={{ color: 'var(--color-text-secondary)' }}
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
              className="transition-colors duration-[var(--duration-fast)]"
              style={{ color: 'var(--color-text-secondary)' }}
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
              className="transition-colors duration-[var(--duration-fast)] hover:text-destructive"
              style={{ color: 'var(--color-text-secondary)' }}
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
  const { open, toggle } = useSidebar();
  const collapsed = !open;

  return (
    <>
      {/* Mobile Trigger */}
      <div className="md:hidden fixed top-4 left-4 z-50">
        <Button 
          variant="outline" 
          size="icon" 
          className="backdrop-blur-sm shadow-md"
          style={{ 
            background: 'var(--color-bg-elevated)', 
            borderColor: 'var(--color-border-subtle)' 
          }}
          onClick={() => setMobileOpen(true)}
          aria-label="Abrir menu de navegação"
        >
          <Menu className="h-5 w-5" />
        </Button>
      </div>

      {/* Mobile Drawer com animação */}
      <MobileDrawer open={mobileOpen} setOpen={setMobileOpen}>
        <NavContent onClose={() => setMobileOpen(false)} />
      </MobileDrawer>

      {/* Desktop Sidebar */}
      <aside 
        className={cn(
          "hidden md:flex flex-col h-screen fixed left-0 top-0",
          "transition-[width] duration-[var(--duration-base)] ease-[var(--ease-smooth)] will-change-[width]",
          collapsed ? "w-16" : "w-64"
        )}
        style={{
          background: 'var(--color-glass-bg)',
          backdropFilter: 'blur(var(--glass-blur))',
          borderRight: '1px solid var(--color-glass-border)',
          boxShadow: 'var(--shadow-lg)'
        }}
        aria-label="Barra lateral de navegação"
      >
        <NavContent collapsed={collapsed} onToggle={toggle} />
      </aside>
    </>
  );
};