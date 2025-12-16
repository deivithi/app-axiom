import { Link, useLocation, useNavigate } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { MessageSquare, CheckSquare, Target, FolderKanban, Bell, Wallet, BookOpen, Brain, Settings, LogOut, Menu, User, Sun, Moon, RefreshCw, Sparkles, Globe } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { useState } from 'react';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import { useTheme } from 'next-themes';
import axiomLogo from '@/assets/axiom-logo.png';

// Chat item destacado separadamente
const chatItem = { icon: MessageSquare, label: 'Falar com Axiom', path: '/chat' };

// Demais itens de navegação
const navItems = [
  { icon: CheckSquare, label: 'Tarefas', path: '/tasks' },
  { icon: Target, label: 'Hábitos', path: '/habits' },
  { icon: FolderKanban, label: 'Projetos', path: '/projects' },
  { icon: Bell, label: 'Lembretes', path: '/reminders' },
  { icon: Wallet, label: 'Finanças', path: '/finances' },
  { icon: BookOpen, label: 'Diário', path: '/diary' },
  { icon: Brain, label: 'Brain Dump', path: '/brain-dump' },
  { icon: Sparkles, label: 'Prompts', path: '/prompts' },
  { icon: Globe, label: 'Sites', path: '/sites' },
  { icon: Settings, label: 'Configurações', path: '/settings' }
];

const NavContent = ({ onClose }: { onClose?: () => void }) => {
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

  const handleBellClick = () => {
    navigate('/reminders');
    onClose?.();
  };

  const handleRefresh = () => {
    window.location.reload();
  };

  const isChatActive = location.pathname === '/chat';

  return (
    <div className="flex flex-col h-full bg-sidebar">
      {/* Header com logo oficial */}
      <div className="p-4 text-center border-b border-border/30">
        <img src={axiomLogo} alt="Axiom Logo" className="w-28 h-auto mx-auto mb-2 object-contain" />
        <p className="text-xs text-muted-foreground">Estrategista conversacional</p>
      </div>
      
      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
        {/* Chat destacado como item principal */}
        <Link
          to={chatItem.path}
          onClick={onClose}
          className={cn(
            'flex items-center gap-4 px-3 py-3 rounded-lg transition-all duration-200 mb-4',
            'bg-primary/10 border border-primary/20 hover:bg-primary/20',
            isChatActive && 'bg-primary text-primary-foreground border-primary'
          )}
        >
          <div className={cn(
            'w-10 h-10 rounded-full flex items-center justify-center transition-all duration-200',
            isChatActive 
              ? 'bg-primary-foreground/20' 
              : 'bg-primary text-primary-foreground'
          )}>
            <chatItem.icon className="h-5 w-5" />
          </div>
          <div>
            <span className="font-semibold block">{chatItem.label}</span>
            <p className="text-xs opacity-70">Seu estrategista pessoal</p>
          </div>
        </Link>

        {/* Separador */}
        <div className="border-t border-border/30 my-2" />

        {/* Demais itens */}
        {navItems.map(item => {
          const isActive = location.pathname === item.path;
          return (
            <Link
              key={item.path}
              to={item.path}
              onClick={onClose}
              className={cn(
                'flex items-center gap-4 px-3 py-2.5 rounded-lg transition-all duration-200',
                isActive 
                  ? 'text-primary' 
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <div className={cn(
                'w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all duration-200',
                isActive 
                  ? 'bg-primary border-primary text-primary-foreground' 
                  : 'border-muted-foreground/30 text-muted-foreground hover:border-muted-foreground/50'
              )}>
                <item.icon className="h-5 w-5" />
              </div>
              <span className="font-medium">{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Bottom bar com ícones utilitários */}
      <div className="p-4 border-t border-border/30 flex justify-around items-center">
        <Button 
          variant="ghost" 
          size="icon" 
          className="text-muted-foreground hover:text-foreground"
          onClick={handleUserClick}
          title="Configurações"
        >
          <User className="h-5 w-5" />
        </Button>
        <Button 
          variant="ghost" 
          size="icon" 
          className="text-muted-foreground hover:text-foreground"
          onClick={handleThemeToggle}
          title="Alternar tema"
        >
          {theme === 'dark' ? <Sun className="h-5 w-5" /> : <Moon className="h-5 w-5" />}
        </Button>
        <Button 
          variant="ghost" 
          size="icon" 
          className="text-muted-foreground hover:text-foreground"
          onClick={handleBellClick}
          title="Lembretes"
        >
          <Bell className="h-5 w-5" />
        </Button>
        <Button 
          variant="ghost" 
          size="icon" 
          className="text-muted-foreground hover:text-foreground"
          onClick={handleRefresh}
          title="Atualizar"
        >
          <RefreshCw className="h-5 w-5" />
        </Button>
        <Button 
          variant="ghost" 
          size="icon" 
          className="text-muted-foreground hover:text-destructive"
          onClick={signOut}
          title="Sair"
        >
          <LogOut className="h-5 w-5" />
        </Button>
      </div>
    </div>
  );
};

export const Sidebar = () => {
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* Mobile Trigger */}
      <div className="md:hidden fixed top-4 left-4 z-50">
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <Button variant="outline" size="icon" className="bg-background">
              <Menu className="h-5 w-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-64 p-0 bg-sidebar">
            <NavContent onClose={() => setOpen(false)} />
          </SheetContent>
        </Sheet>
      </div>

      {/* Desktop Sidebar */}
      <aside className="hidden md:flex flex-col w-64 bg-sidebar border-r border-border h-screen fixed left-0 top-0">
        <NavContent />
      </aside>
    </>
  );
};
