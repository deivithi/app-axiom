import { cn } from '@/lib/utils';
import { Target, Wallet, Brain, Settings, LogOut, Menu, Sun, Moon, RefreshCw, Sparkles, CheckSquare, ChevronLeft, ChevronRight, FileText } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { useState } from 'react';
import { MobileDrawer } from './MobileDrawer';
import { useTheme } from 'next-themes';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useSidebar } from '@/contexts/SidebarContext';
import { Logo, LogoIcon } from './Logo';
import { UserProfileLink } from './UserProfileLink';
import { SidebarBody } from './SidebarBody';
import { SidebarLink, SidebarLinkItem } from './SidebarLink';

// Links principais (5 módulos core)
const links: SidebarLinkItem[] = [
  { 
    icon: <Sparkles className="h-5 w-5" />, 
    label: 'Motor de Inteligência', 
    href: '/intelligence', 
    description: 'Análise e insights'
  },
  { 
    icon: <Wallet className="h-5 w-5" />, 
    label: 'CFO Pessoal', 
    href: '/finances', 
    description: 'Controle financeiro'
  },
  { 
    icon: <CheckSquare className="h-5 w-5" />, 
    label: 'Sistema de Execução', 
    href: '/execution', 
    description: 'Tarefas e projetos'
  },
  { 
    icon: <Target className="h-5 w-5" />, 
    label: 'Arquiteto de Rotina', 
    href: '/habits', 
    description: 'Hábitos e rotinas'
  },
  { 
    icon: <Brain className="h-5 w-5" />, 
    label: 'Segunda Memória', 
    href: '/memory', 
    description: 'Pensamentos e reflexões'
  },
  { 
    icon: <FileText className="h-5 w-5" />, 
    label: 'Biblioteca de Prompts', 
    href: '/prompts', 
    description: 'Seus prompts salvos'
  },
];


// Footer links
const footerLinks: SidebarLinkItem[] = [
  { 
    icon: <Settings className="h-5 w-5" />, 
    label: 'Configurações', 
    href: '/settings'
  },
];

const NavContent = ({ onClose, collapsed = false, onToggle }: { onClose?: () => void; collapsed?: boolean; onToggle?: () => void }) => {
  const { signOut } = useAuth();
  const { theme, setTheme } = useTheme();

  const handleThemeToggle = () => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  };

  const handleRefresh = () => {
    window.location.reload();
  };

  const open = !collapsed;

  return (
    <SidebarBody className="justify-between gap-10">
      {/* Seção superior: Logo + Links */}
      <div className="flex flex-col flex-1 overflow-y-auto overflow-x-hidden">
        {/* Header com Logo + Toggle */}
        <div 
          className={cn("p-4 flex items-center", collapsed ? "px-2 flex-col gap-2" : "justify-between")}
          style={{
            borderBottom: '1px solid var(--color-border-subtle)',
            background: 'var(--color-glass-bg)',
            backdropFilter: 'blur(var(--glass-blur))'
          }}
        >
          {open ? <Logo size="lg" /> : <LogoIcon size="md" />}
          
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

        {/* Links principais */}
        <nav 
          className={cn("mt-4 flex flex-col gap-1", collapsed ? "px-2" : "px-4")}
          role="navigation"
          aria-label="Navegação principal"
          id="sidebar-nav"
        >
          {links.map((link, idx) => (
            <SidebarLink key={idx} link={link} collapsed={collapsed} onClose={onClose} />
          ))}
        </nav>
        
      </div>
      
      {/* Footer */}
      <div 
        className="pt-4"
        style={{ borderTop: '1px solid var(--color-border-subtle)' }}
      >
        {/* Footer Links (Settings) */}
        <div className={cn("flex flex-col gap-1", collapsed ? "px-2" : "px-4")}>
          {footerLinks.map((link, idx) => (
            <SidebarLink key={idx} link={link} collapsed={collapsed} onClose={onClose} />
          ))}
        </div>
        
        {/* User Profile */}
        <div className={cn("mt-2", collapsed ? "px-2" : "px-4")}>
          <UserProfileLink collapsed={collapsed} onClose={onClose} />
        </div>

        {/* Bottom bar actions */}
        <div 
          className={cn("p-4 flex items-center mt-2", collapsed ? "flex-col gap-2 p-2" : "justify-around")}
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
    </SidebarBody>
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

      {/* Mobile Drawer */}
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
