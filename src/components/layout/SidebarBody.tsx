import { cn } from '@/lib/utils';

interface SidebarBodyProps {
  children: React.ReactNode;
  className?: string;
}

export const SidebarBody = ({ children, className }: SidebarBodyProps) => (
  <div className={cn("flex flex-col h-full", className)}>
    {children}
  </div>
);
