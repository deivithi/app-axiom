import { ReactNode } from 'react';
import { Sidebar } from './Sidebar';
import { StarryBackground } from '@/components/ui/starry-background';
import { ChatPanel } from '@/components/chat/ChatPanel';
import { Button } from '@/components/ui/button';
import { MessageSquare } from 'lucide-react';
import { useChatContext } from '@/contexts/ChatContext';
import { useChatPanelResize } from '@/hooks/useChatPanelResize';
import { cn } from '@/lib/utils';
import { useKeyboardNavigation } from '@/hooks/useKeyboardNavigation';

interface AppLayoutProps {
  children: ReactNode;
}

export const AppLayout = ({ children }: AppLayoutProps) => {
  const { chatOpen, setChatOpen } = useChatContext();
  const { marginClass } = useChatPanelResize();
  
  // Enable keyboard navigation
  useKeyboardNavigation();

  return (
    <div className="min-h-screen relative bg-background">
      <StarryBackground />
      
      {/* Sidebar (Left) */}
      <Sidebar />
      
      {/* Main Content (Center) */}
      <main className={cn(
        "min-h-screen relative z-10",
        "transition-all duration-300",
        "md:ml-64",
        marginClass
      )}>
        {children}
      </main>
      
      {/* Chat Panel (Right) - Always visible on desktop */}
      <ChatPanel 
        isExpanded={chatOpen} 
        onToggle={() => setChatOpen(!chatOpen)} 
      />
      
      {/* Mobile: Floating button to open chat */}
      <Button
        onClick={() => setChatOpen(true)}
        className={cn(
          "fixed bottom-6 right-6 z-50 rounded-full w-14 h-14 shadow-lg",
          "lg:hidden",
          chatOpen && "hidden"
        )}
        size="icon"
      >
        <MessageSquare className="h-6 w-6" />
      </Button>
      
      {/* Mobile: Backdrop when chat is open */}
      {chatOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-30 lg:hidden"
          onClick={() => setChatOpen(false)}
        />
      )}
    </div>
  );
};
