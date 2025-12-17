import { Link, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

export interface SidebarLinkItem {
  label: string;
  href: string;
  icon: React.ReactNode;
  description?: string;
  badge?: number | string;
}

interface SidebarLinkProps {
  link: SidebarLinkItem;
  collapsed?: boolean;
  onClose?: () => void;
}

export const SidebarLink = ({ link, collapsed, onClose }: SidebarLinkProps) => {
  const location = useLocation();
  const isActive = location.pathname === link.href;

  const content = (
    <Link
      to={link.href}
      onClick={onClose}
      aria-current={isActive ? 'page' : undefined}
      className={cn(
        'flex items-center gap-4 rounded-lg transition-all duration-[var(--duration-fast)] ease-[var(--ease-smooth)]',
        collapsed ? 'justify-center p-2' : 'px-3 py-2.5'
      )}
      style={{ color: isActive ? 'var(--color-primary)' : 'var(--color-text-secondary)' }}
      onMouseOver={(e) => !isActive && (e.currentTarget.style.color = 'var(--color-text-primary)')}
      onMouseOut={(e) => !isActive && (e.currentTarget.style.color = 'var(--color-text-secondary)')}
    >
      {/* Ícone circular */}
      <div 
        className="relative w-10 h-10 rounded-full flex items-center justify-center border-2 transition-all duration-[var(--duration-fast)] ease-[var(--ease-smooth)] flex-shrink-0"
        style={{
          background: isActive ? 'var(--color-primary)' : 'transparent',
          borderColor: isActive ? 'var(--color-primary)' : 'var(--color-border-medium)',
          color: isActive ? 'var(--color-primary-foreground)' : 'inherit',
          boxShadow: isActive ? 'var(--shadow-glow)' : 'none'
        }}
      >
        {link.icon}
        
        {/* Mini badge quando colapsado */}
        {collapsed && link.badge !== undefined && link.badge !== 0 && (
          <span 
            className="absolute -top-1 -right-1 w-4 h-4 rounded-full text-[9px] font-bold flex items-center justify-center"
            style={{ 
              background: 'var(--color-primary)', 
              color: 'white' 
            }}
          >
            {typeof link.badge === 'number' && link.badge > 9 ? '•' : link.badge}
          </span>
        )}
      </div>
      
      {/* Label + Badge inline quando expandido */}
      {!collapsed && (
        <>
          <div className="flex-1 min-w-0">
            <span className="font-medium block truncate">{link.label}</span>
            {link.description && (
              <p className="text-xs truncate" style={{ color: 'var(--color-text-secondary)' }}>
                {link.description}
              </p>
            )}
          </div>
          
          {/* Badge pill inline */}
          {link.badge !== undefined && link.badge !== 0 && (
            <span 
              className="ml-auto px-2 py-0.5 text-xs font-semibold rounded-full flex-shrink-0 transition-all duration-[var(--duration-fast)]"
              style={{ 
                background: 'var(--color-primary)', 
                color: 'white' 
              }}
            >
              {typeof link.badge === 'number' && link.badge > 9 ? '9+' : link.badge}
            </span>
          )}
        </>
      )}
    </Link>
  );

  if (collapsed) {
    return (
      <Tooltip delayDuration={0}>
        <TooltipTrigger asChild>
          {content}
        </TooltipTrigger>
        <TooltipContent side="right" className="font-medium">
          {link.label}
        </TooltipContent>
      </Tooltip>
    );
  }

  return content;
};
