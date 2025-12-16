import { ReactNode } from 'react';
import { Sidebar } from './Sidebar';
import { StarryBackground } from '@/components/ui/starry-background';
import { FloatingChatButton } from '@/components/FloatingChatButton';

interface AppLayoutProps {
  children: ReactNode;
}

export const AppLayout = ({
  children
}: AppLayoutProps) => {
  return <div className="min-h-screen relative bg-sidebar-border">
      <StarryBackground />
      <Sidebar />
      <main className="md:ml-64 min-h-screen relative z-10">
        {children}
      </main>
      <FloatingChatButton />
    </div>;
};