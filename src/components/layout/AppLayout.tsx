import { ReactNode } from 'react';
import { Sidebar } from './Sidebar';
import { StarryBackground } from '@/components/ui/starry-background';

interface AppLayoutProps {
  children: ReactNode;
}

export const AppLayout = ({ children }: AppLayoutProps) => {
  return (
    <div className="min-h-screen bg-background relative">
      <StarryBackground />
      <Sidebar />
      <main className="md:ml-64 min-h-screen relative z-10">
        {children}
      </main>
    </div>
  );
};
