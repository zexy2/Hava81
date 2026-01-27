/**
 * Motion Components - Animated wrappers for common components
 * Uses Framer Motion for professional animations
 */

import React from 'react';
import { motion, type Variants, type MotionProps } from 'framer-motion';

// Animation variants for staggered children
export const staggerContainer: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.1,
    },
  },
};

export const fadeInUp: Variants = {
  hidden: { 
    opacity: 0, 
    y: 20,
  },
  visible: { 
    opacity: 1, 
    y: 0,
    transition: {
      type: 'spring',
      damping: 20,
      stiffness: 300,
    },
  },
};

export const fadeInScale: Variants = {
  hidden: { 
    opacity: 0, 
    scale: 0.95,
  },
  visible: { 
    opacity: 1, 
    scale: 1,
    transition: {
      type: 'spring',
      damping: 25,
      stiffness: 300,
    },
  },
};

export const slideInFromRight: Variants = {
  hidden: { 
    opacity: 0, 
    x: 50,
  },
  visible: { 
    opacity: 1, 
    x: 0,
    transition: {
      type: 'spring',
      damping: 25,
      stiffness: 300,
    },
  },
};

export const slideInFromLeft: Variants = {
  hidden: { 
    opacity: 0, 
    x: -50,
  },
  visible: { 
    opacity: 1, 
    x: 0,
    transition: {
      type: 'spring',
      damping: 25,
      stiffness: 300,
    },
  },
};

// Pulse animation for loading states
export const pulse: Variants = {
  initial: { scale: 1 },
  animate: {
    scale: [1, 1.05, 1],
    transition: {
      duration: 2,
      repeat: Infinity,
      ease: 'easeInOut',
    },
  },
};

// Card hover effect
export const cardHover = {
  rest: {
    scale: 1,
    y: 0,
    boxShadow: '0 4px 20px rgba(0, 0, 0, 0.1)',
  },
  hover: {
    scale: 1.02,
    y: -5,
    boxShadow: '0 20px 40px rgba(0, 0, 0, 0.2)',
    transition: {
      type: 'spring' as const,
      damping: 20,
      stiffness: 400,
    },
  },
  tap: {
    scale: 0.98,
  },
} as const;

// Motion Card Component
interface MotionCardProps extends MotionProps {
  children: React.ReactNode;
  className?: string;
  delay?: number;
}

export const MotionCard: React.FC<MotionCardProps> = ({ 
  children, 
  className = '', 
  delay = 0,
  ...props 
}) => {
  return (
    <motion.div
      className={className}
      initial="rest"
      whileHover="hover"
      whileTap="tap"
      variants={cardHover}
      transition={{ delay }}
      {...props}
    >
      {children}
    </motion.div>
  );
};

// Motion List Container
interface MotionListProps {
  children: React.ReactNode;
  className?: string;
}

export const MotionList: React.FC<MotionListProps> = ({ children, className = '' }) => {
  return (
    <motion.div
      className={className}
      variants={staggerContainer}
      initial="hidden"
      animate="visible"
    >
      {children}
    </motion.div>
  );
};

// Motion List Item
interface MotionItemProps extends MotionProps {
  children: React.ReactNode;
  className?: string;
}

export const MotionItem: React.FC<MotionItemProps> = ({ 
  children, 
  className = '',
  ...props 
}) => {
  return (
    <motion.div
      className={className}
      variants={fadeInUp}
      {...props}
    >
      {children}
    </motion.div>
  );
};

// Number counter animation
interface AnimatedNumberProps {
  value: number;
  duration?: number;
  className?: string;
}

export const AnimatedNumber: React.FC<AnimatedNumberProps> = ({ 
  value, 
  duration = 1,
  className = '',
}) => {
  return (
    <motion.span
      className={className}
      initial={{ opacity: 0, scale: 0.5 }}
      animate={{ opacity: 1, scale: 1 }}
      key={value}
      transition={{
        type: 'spring',
        damping: 15,
        stiffness: 200,
      }}
    >
      {value}
    </motion.span>
  );
};

// Page transition wrapper
interface PageTransitionProps {
  children: React.ReactNode;
}

export const PageTransition: React.FC<PageTransitionProps> = ({ children }) => {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -20 }}
      transition={{
        type: 'spring',
        damping: 20,
        stiffness: 200,
      }}
    >
      {children}
    </motion.div>
  );
};

const motionVariants = {
  staggerContainer,
  fadeInUp,
  fadeInScale,
  slideInFromRight,
  slideInFromLeft,
  pulse,
  cardHover,
};

export default motionVariants;
