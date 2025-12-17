import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import axiomLogo from '@/assets/axiom-logo.png';

interface LogoProps {
  size?: 'sm' | 'md' | 'lg';
}

const sizes = {
  sm: 'h-8 w-8',
  md: 'h-10 w-10',
  lg: 'h-12 w-12'
};

// Logo completo (expandido) com subtítulo
export const Logo = ({ size = 'lg' }: LogoProps) => {
  return (
    <Link to="/" className="flex items-center gap-3 py-1">
      <img 
        src={axiomLogo} 
        alt="Axiom" 
        className={`${sizes[size]} object-contain`} 
      />
      <motion.div
        initial={{ opacity: 0, x: -10 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.2 }}
        className="flex flex-col"
      >
        <span 
          className="font-semibold text-sm"
          style={{ color: 'var(--color-text-primary)' }}
        >
          Axiom
        </span>
        <span 
          className="text-xs"
          style={{ color: 'var(--color-text-secondary)' }}
        >
          Estrategista pessoal
        </span>
      </motion.div>
    </Link>
  );
};

// Apenas ícone (colapsado)
export const LogoIcon = ({ size = 'md' }: LogoProps) => {
  return (
    <Link to="/" className="flex items-center justify-center py-1">
      <img 
        src={axiomLogo} 
        alt="Axiom" 
        className={`${sizes[size]} object-contain`} 
      />
    </Link>
  );
};
