import { Variants } from "framer-motion";

// ========================================
// PAGE & NAVIGATION TRANSITIONS
// ========================================

export const pageTransition: Variants = {
  initial: { opacity: 0, x: 20 },
  animate: { 
    opacity: 1, 
    x: 0,
    transition: { type: "spring", stiffness: 380, damping: 30 },
  },
  exit: { opacity: 0, x: -20, transition: { duration: 0.2 } },
};

export const modalTransition: Variants = {
  initial: { y: "100%", opacity: 0 },
  animate: { 
    y: 0, 
    opacity: 1,
    transition: { type: "spring", stiffness: 400, damping: 30 },
  },
  exit: { y: "100%", opacity: 0, transition: { duration: 0.3 } },
};

// ========================================
// FADE ANIMATIONS
// ========================================

export const fadeInUp: Variants = {
  initial: { opacity: 0, y: 20 },
  animate: { 
    opacity: 1, 
    y: 0,
    transition: { type: "spring", stiffness: 500, damping: 30 },
  },
};

export const fadeInScale: Variants = {
  initial: { opacity: 0, scale: 0.95 },
  animate: { 
    opacity: 1, 
    scale: 1,
    transition: { duration: 0.3, ease: [0.4, 0, 0.2, 1] },
  },
  exit: { opacity: 0, scale: 0.95 },
};

export const fadeIn: Variants = {
  initial: { opacity: 0 },
  animate: { opacity: 1, transition: { duration: 0.2 } },
  exit: { opacity: 0 },
};

// ========================================
// LOOP ANIMATIONS
// ========================================

export const pulse: Variants = {
  animate: {
    scale: [1, 1.05, 1],
    transition: { duration: 2, repeat: Infinity, ease: "easeInOut" },
  },
};

export const shimmer: Variants = {
  animate: {
    backgroundPosition: ["200% 0", "-200% 0"],
    transition: { duration: 1.5, repeat: Infinity, ease: "linear" },
  },
};

// ========================================
// STAGGER CONTAINERS
// ========================================

export const staggerContainer: Variants = {
  initial: {},
  animate: {
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.1,
    },
  },
};

export const staggerItem: Variants = {
  initial: { opacity: 0, y: 20 },
  animate: { 
    opacity: 1, 
    y: 0,
    transition: { type: "spring", stiffness: 500, damping: 30 },
  },
};

// ========================================
// BUTTON INTERACTIONS
// ========================================

export const tapScale = {
  whileTap: { scale: 0.95 },
  transition: { type: "spring", stiffness: 400, damping: 17 },
};

export const hoverScale = {
  whileHover: { scale: 1.02 },
  whileTap: { scale: 0.98 },
};
