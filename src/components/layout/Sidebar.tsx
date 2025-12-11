import { Link, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { MessageSquare, CheckSquare, Target, FolderKanban, Bell, Wallet, BookOpen, Brain, Settings, LogOut, Menu, User, Sun, RefreshCw } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { useState } from 'react';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import axiomLogo from '@/assets/axiom-logo.png';

const navItems = [
  { icon: MessageSquare, label: 'Chat IA', path: '/chat' },
  { icon: CheckSquare, label: 'Tarefas', path: '/tasks' },
  { icon: Target, label: 'Hábitos', path: '/habits' },
  { icon: FolderKanban, label: 'Projetos', path: '/projects' },
  { icon: Bell, label: 'Lembretes', path: '/reminders' },
  { icon: Wallet, label: 'Finanças', path: '/finances' },
  { icon: BookOpen, label: 'Diário', path: '/diary' },
  { icon: Brain, label: 'Brain Dump', path: '/brain-dump' },
  { icon: Settings, label: 'Configurações', path: '/settings' }
];

const NavContent = ({ onClose }: { onClose?: () => void }) => {
  const location = useLocation();
  const { signOut } = useAuth();

  return (
    <div className="flex flex-col h-full bg-sidebar">
      {/* Header centralizado estilo Néctar */}
      <div className="p-6 text-center border-b border-border/30">
        <img src={axiomLogo} alt="Axiom Logo" className="w-14 h-14 mx-auto mb-3" />
        <h1 className="font-orbitron text-xl font-semibold tracking-wider text-foreground">
          Axiom
        </h1>
        <p className="text-xs text-muted-foreground mt-1">Seu assistente pessoal</p>
      </div>
      
      {/* Navigation com ícones circulares */}
      <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
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
        <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground">
          <User className="h-5 w-5" />
        </Button>
        <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground">
          <Sun className="h-5 w-5" />
        </Button>
        <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground">
          <Bell className="h-5 w-5" />
        </Button>
        <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground">
          <RefreshCw className="h-5 w-5" />
        </Button>
        <Button 
          variant="ghost" 
          size="icon" 
          className="text-muted-foreground hover:text-destructive"
          onClick={signOut}
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
