import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

/**
 * Página Index — redireciona imediatamente para o dashboard principal.
 * Evita exibir placeholder genérico ao usuário.
 */
const Index = () => {
  const navigate = useNavigate();

  useEffect(() => {
    navigate('/intelligence', { replace: true });
  }, [navigate]);

  return null;
};

export default Index;
