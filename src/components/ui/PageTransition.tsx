import { ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLocation } from 'react-router-dom';

interface PageTransitionProps {
    children: ReactNode;
}

/**
 * Componente de transição de página — fade + subtle slide.
 * Usado no AppLayout para envolver o conteúdo principal.
 * Padrão Google Material Design 3 motion.
 */
export const PageTransition = ({ children }: PageTransitionProps) => {
    const location = useLocation();

    return (
        <AnimatePresence mode="wait" initial={false}>
            <motion.div
                key={location.pathname}
                initial={{ opacity: 0, y: 8 }}
                animate={{
                    opacity: 1,
                    y: 0,
                    transition: { duration: 0.25, ease: 'easeOut' },
                }}
                exit={{
                    opacity: 0,
                    y: -4,
                    transition: { duration: 0.15, ease: 'easeIn' },
                }}
                className="w-full"
            >
                {children}
            </motion.div>
        </AnimatePresence>
    );
};
