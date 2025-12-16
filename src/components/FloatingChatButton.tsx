import { useLocation, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { MessageSquare } from 'lucide-react';

export function FloatingChatButton() {
  const location = useLocation();
  const navigate = useNavigate();
  
  // Don't show on chat page
  if (location.pathname === '/chat') return null;
  
  return (
    <Button
      onClick={() => navigate('/chat')}
      className="fixed bottom-6 right-6 z-50 rounded-full w-14 h-14 shadow-lg"
      size="icon"
      title="Falar com Axiom (Cmd/Ctrl+K)"
    >
      <MessageSquare className="h-6 w-6" />
    </Button>
  );
}