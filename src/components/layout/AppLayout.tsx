import { ReactNode } from 'react';
import { Sidebar } from './Sidebar';
import { StarryBackground } from '@/components/ui/starry-background';
import { ChatPanel } from '@/components/chat/ChatPanel';
import { useChatContext } from '@/contexts/ChatContext';
import { useChatPanelResize } from '@/hooks/useChatPanelResize';
import { useSidebar } from '@/contexts/SidebarContext';
import { cn } from '@/lib/utils';
import { useKeyboardNavigation } from '@/hooks/useKeyboardNavigation';
import { useIsMobile } from '@/hooks/use-mobile';
import { BottomNavigation } from '@/components/mobile/BottomNavigation';

interface AppLayoutProps {
  children: ReactNode;
}

export const AppLayout = ({ children }: AppLayoutProps) => {
  const { chatOpen, setChatOpen } = useChatContext();
  const { marginClass } = useChatPanelResize();
  const { open } = useSidebar();
  const isMobile = useIsMobile();
  
  // Enable keyboard navigation
  useKeyboardNavigation();

  return (
    <div className="min-h-screen relative bg-background">
      <StarryBackground />
      
      {/* Sidebar (Left) - Hidden on mobile */}
      {!isMobile && <Sidebar />}
      
      {/* Main Content (Center) */}
      <main className={cn(
        "min-h-screen relative z-10",
        "transition-all duration-200 ease-out",
        "pt-safe-top",
        // Desktop: sidebar margins
        !isMobile && (open ? "md:ml-64" : "md:ml-16"),
        !isMobile && marginClass,
        // Mobile: bottom nav padding
        isMobile && "pb-bottom-nav"
      )}>
        {children}
      </main>
      
      {/* Chat Panel (Right) - Desktop only persistent, Mobile as overlay */}
      <ChatPanel 
        isExpanded={chatOpen} 
        onToggle={() => setChatOpen(!chatOpen)} 
      />
      
      {/* Mobile: Bottom Navigation */}
      {isMobile && !chatOpen && <BottomNavigation />}
      
      {/* Mobile: Backdrop when chat is open - z-index between fixed (150) and modal (250) */}
      {chatOpen && isMobile && (
        <div 
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[200]"
          onClick={() => setChatOpen(false)}
        />
      )}
    </div>
  );
};
