import { Link } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

interface UserProfileLinkProps {
  collapsed?: boolean;
  onClose?: () => void;
}

export const UserProfileLink = ({ collapsed, onClose }: UserProfileLinkProps) => {
  const { user } = useAuth();
  
  const { data: profile } = useQuery({
    queryKey: ['profile', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data } = await supabase
        .from('profiles')
        .select('full_name, avatar_url')
        .eq('id', user.id)
        .maybeSingle();
      return data;
    },
    enabled: !!user?.id
  });

  const userName = profile?.full_name || user?.user_metadata?.full_name || 'Usuário';
  const initial = userName.charAt(0).toUpperCase();
  const avatarUrl = profile?.avatar_url;

  const content = (
    <Link
      to="/settings"
      onClick={onClose}
      className={cn(
        'flex items-center gap-3 rounded-lg transition-all duration-[var(--duration-fast)] ease-[var(--ease-smooth)]',
        collapsed ? 'justify-center p-2' : 'px-3 py-2.5'
      )}
      style={{ color: 'var(--color-text-secondary)' }}
      onMouseOver={(e) => {
        e.currentTarget.style.background = 'var(--color-bg-elevated-2)';
        e.currentTarget.style.color = 'var(--color-text-primary)';
      }}
      onMouseOut={(e) => {
        e.currentTarget.style.background = 'transparent';
        e.currentTarget.style.color = 'var(--color-text-secondary)';
      }}
    >
      {/* Avatar com inicial ou imagem */}
      {avatarUrl ? (
        <img 
          src={avatarUrl} 
          alt={userName}
          className="h-8 w-8 rounded-full object-cover flex-shrink-0"
        />
      ) : (
        <div 
          className="h-8 w-8 rounded-full flex items-center justify-center text-white font-semibold flex-shrink-0"
          style={{
            background: 'linear-gradient(135deg, hsl(var(--primary)), hsl(280 70% 50%))'
          }}
        >
          {initial}
        </div>
      )}
      
      {/* Nome quando expandido */}
      {!collapsed && (
        <span className="font-medium truncate">
          {userName}
        </span>
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
          {userName}
        </TooltipContent>
      </Tooltip>
    );
  }

  return content;
};
