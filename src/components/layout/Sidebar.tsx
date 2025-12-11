import { Link, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { MessageSquare, CheckSquare, Target, FolderKanban, Bell, Wallet, BookOpen, Brain, Settings, LogOut, Menu, X } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { useState } from 'react';
import { Sheet, SheetContent, SheetTrigger } from '@/components/ui/sheet';
import axiomLogo from '@/assets/axiom-logo.png';
const navItems = [{
  icon: MessageSquare,
  label: 'Chat IA',
  path: '/chat'
}, {
  icon: CheckSquare,
  label: 'Tarefas',
  path: '/tasks'
}, {
  icon: Target,
  label: 'Hábitos',
  path: '/habits'
}, {
  icon: FolderKanban,
  label: 'Projetos',
  path: '/projects'
}, {
  icon: Bell,
  label: 'Lembretes',
  path: '/reminders'
}, {
  icon: Wallet,
  label: 'Finanças',
  path: '/finances'
}, {
  icon: BookOpen,
  label: 'Diário',
  path: '/diary'
}, {
  icon: Brain,
  label: 'Brain Dump',
  path: '/brain-dump'
}, {
  icon: Settings,
  label: 'Configurações',
  path: '/settings'
}];
const NavContent = ({
  onClose
}: {
  onClose?: () => void;
}) => {
  const location = useLocation();
  const {
    signOut
  } = useAuth();
  return <div className="flex flex-col h-full">
      <div className="p-6 border-b border-border flex items-center gap-3 bg-sidebar-border">
        <img src={axiomLogo} alt="Axiom" className="w-8 h-8 object-contain" />
        <div>
          <h1 className="text-xl font-bold text-secondary-foreground">Axiom</h1>
          <p className="text-xs text-primary-foreground">Consultor Estratégico Pessoal</p>
        </div>
      </div>
      
      <nav className="flex-1 p-4 space-y-1 bg-sidebar-border">
        {navItems.map(item => {
        const isActive = location.pathname === item.path;
        return <Link key={item.path} to={item.path} onClick={onClose} className={cn('flex items-center gap-3 px-4 py-3 rounded-lg transition-colors', isActive ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-accent hover:text-accent-foreground')}>
              <item.icon className="h-5 w-5" />
              <span className="font-medium text-primary-foreground">{item.label}</span>
            </Link>;
      })}
      </nav>

      <div className="p-4 border-t border-border bg-sidebar-border">
        <Button variant="ghost" className="w-full justify-start text-muted-foreground hover:text-destructive" onClick={signOut}>
          <LogOut className="h-5 w-5 mr-3" />
          Sair
        </Button>
      </div>
    </div>;
};
export const Sidebar = () => {
  const [open, setOpen] = useState(false);
  return <>
      {/* Mobile Trigger */}
      <div className="md:hidden fixed top-4 left-4 z-50">
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <Button variant="outline" size="icon" className="bg-background">
              <Menu className="h-5 w-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-64 p-0 bg-card">
            <NavContent onClose={() => setOpen(false)} />
          </SheetContent>
        </Sheet>
      </div>

      {/* Desktop Sidebar */}
      <aside className="hidden md:flex flex-col w-64 bg-card border-r border-border h-screen fixed left-0 top-0">
        <NavContent />
      </aside>
    </>;
};