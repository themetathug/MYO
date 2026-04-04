'use client';

import { motion, AnimatePresence } from 'framer-motion';
import { usePathname } from 'next/navigation';
import { ReactNode } from 'react';

interface PageTransitionProps {
  children: ReactNode;
}

export function PageTransition({ children }: PageTransitionProps) {
  const pathname = usePathname();

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={pathname}
        initial={{ opacity: 0, scale: 0.95, rotateY: -10 }}
        animate={{ opacity: 1, scale: 1, rotateY: 0 }}
        exit={{ opacity: 0, scale: 1.05, rotateY: 10 }}
        transition={{ 
          duration: 0.5, 
          ease: [0.43, 0.13, 0.23, 0.96] 
        }}
        style={{ transformStyle: 'preserve-3d' }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
}

