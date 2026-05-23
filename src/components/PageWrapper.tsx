import React from 'react';
import { motion } from 'motion/react';
import { cn } from '../lib/utils';

// Standardized Spring Transition configuration for liquid-smooth layout flow
export const pageSpringTransition = {
  type: "spring" as const,
  stiffness: 280,
  damping: 28,
  mass: 0.8
};

interface PageWrapperProps {
  children: React.ReactNode;
  className?: string;
}

export function PageWrapper({ children, className }: PageWrapperProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16, filter: "blur(6px)", scale: 0.985 }}
      animate={{ opacity: 1, y: 0, filter: "blur(0px)", scale: 1 }}
      exit={{ opacity: 0, y: -16, filter: "blur(6px)", scale: 0.985 }}
      transition={pageSpringTransition}
      className={cn("w-full h-full", className)}
    >
      {children}
    </motion.div>
  );
}

export const staggerContainerVariants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.05,
      delayChildren: 0.02,
    }
  }
};

export const staggerItemVariants = {
  hidden: { opacity: 0, y: 12, filter: "blur(4px)", scale: 0.97 },
  visible: { 
    opacity: 1, 
    y: 0, 
    filter: "blur(0px)", 
    scale: 1,
    transition: {
      type: "spring" as const,
      stiffness: 260,
      damping: 24,
      mass: 0.8
    }
  }
};

interface StaggerContainerProps {
  children: React.ReactNode;
  className?: string;
}

export function StaggerContainer({ children, className }: StaggerContainerProps) {
  return (
    <motion.div
      variants={staggerContainerVariants}
      initial="hidden"
      animate="visible"
      className={className}
    >
      {children}
    </motion.div>
  );
}

interface StaggerItemProps {
  children: React.ReactNode;
  className?: string;
}

export function StaggerItem({ children, className }: StaggerItemProps) {
  return (
    <motion.div
      variants={staggerItemVariants}
      className={className}
    >
      {children}
    </motion.div>
  );
}
