'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface FlipCardProps {
  front: React.ReactNode;
  back: React.ReactNode;
  flipOnClick?: boolean;
  flipOnHover?: boolean;
  animationDuration?: number;
  className?: string;
}

export function FlipCard({ 
  front, 
  back, 
  flipOnClick = true, 
  flipOnHover = false,
  animationDuration = 0.6,
  className = '' 
}: FlipCardProps) {
  const [isFlipped, setIsFlipped] = useState(false);

  const handleClick = () => {
    if (flipOnClick) {
      setIsFlipped(!isFlipped);
    }
  };

  return (
    <motion.div
      className={`relative cursor-pointer ${className}`}
      onClick={handleClick}
      onHoverStart={() => flipOnHover && setIsFlipped(true)}
      onHoverEnd={() => flipOnHover && setIsFlipped(false)}
      style={{ perspective: 1000 }}
    >
      <motion.div
        className="relative"
        style={{ transformStyle: 'preserve-3d' }}
        animate={{
          rotateY: isFlipped ? 180 : 0,
        }}
        transition={{
          duration: animationDuration,
          ease: [0.43, 0.13, 0.23, 0.96],
        }}
      >
        {/* Front side */}
        <div
          className="absolute inset-0"
          style={{ backfaceVisibility: 'hidden', WebkitBackfaceVisibility: 'hidden' }}
        >
          <motion.div
            animate={{ opacity: isFlipped ? 0 : 1 }}
            transition={{ duration: animationDuration / 2 }}
          >
            {front}
          </motion.div>
        </div>

        {/* Back side */}
        <div
          className="absolute inset-0"
          style={{ 
            backfaceVisibility: 'hidden', 
            WebkitBackfaceVisibility: 'hidden',
            transform: 'rotateY(180deg)'
          }}
        >
          <motion.div
            animate={{ opacity: isFlipped ? 1 : 0 }}
            transition={{ duration: animationDuration / 2 }}
          >
            {back}
          </motion.div>
        </div>
      </motion.div>
    </motion.div>
  );
}

