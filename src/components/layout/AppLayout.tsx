import { ReactNode } from 'react';
import { Sidebar } from './Sidebar';
import { StarryBackground } from '@/components/ui/starry-background';
import { ChatPanel } from '@/components/chat/ChatPanel';
import { useChatContext } from '@/contexts/ChatContext';
import { PageTransition } from '@/components/ui/PageTransition';
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
      <main
        id="main-content"
        tabIndex={-1}
        className={cn(
          "min-h-screen relative z-10",
          "transition-all duration-[var(--duration-base)] ease-[var(--ease-smooth)]",
          "pt-safe-top",
          "focus:outline-none",
          // Desktop: padding to accommodate floating sidebar and chat
          !isMobile && (open ? "md:pl-[280px]" : "md:pl-[88px]"),
          !isMobile && marginClass,
          // Mobile: bottom nav padding
          isMobile && "pb-bottom-nav"
        )}
      >
        <PageTransition>
          {children}
        </PageTransition>
      </main>

      {/* Mobile: Backdrop when chat is open - rendered before ChatPanel for correct stacking */}
      {chatOpen && isMobile && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-modal-backdrop"
          onClick={() => setChatOpen(false)}
        />
      )}

      {/* Chat Panel (Right) - Desktop only persistent, Mobile as overlay */}
      <ChatPanel
        isExpanded={chatOpen}
        onToggle={() => setChatOpen(!chatOpen)}
      />

      {/* Mobile: Bottom Navigation */}
      {isMobile && !chatOpen && <BottomNavigation />}
    </div>
  );
};
