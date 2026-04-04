'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';

export function CustomCursor() {
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isHovering, setIsHovering] = useState(false);
  const [isClicking, setIsClicking] = useState(false);
  const [cursorVariant, setCursorVariant] = useState('default');

  useEffect(() => {
    const updatePosition = (e: MouseEvent) => {
      setPosition({ x: e.clientX, y: e.clientY });
    };

    const handleMouseDown = () => setIsClicking(true);
    const handleMouseUp = () => setIsClicking(false);

    const handleMouseOver = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      
      if (target.tagName === 'BUTTON' || target.closest('button')) {
        setIsHovering(true);
        setCursorVariant('button');
      } else if (target.tagName === 'A' || target.closest('a')) {
        setIsHovering(true);
        setCursorVariant('link');
      } else if (target.closest('[data-draggable]')) {
        setIsHovering(true);
        setCursorVariant('drag');
      } else {
        setIsHovering(false);
        setCursorVariant('default');
      }
    };

    window.addEventListener('mousemove', updatePosition);
    window.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('mouseup', handleMouseUp);
    window.addEventListener('mouseover', handleMouseOver);

    return () => {
      window.removeEventListener('mousemove', updatePosition);
      window.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('mouseup', handleMouseUp);
      window.removeEventListener('mouseover', handleMouseOver);
    };
  }, []);

  const variants = {
    default: {
      scale: 1,
      backgroundColor: 'rgba(255, 255, 255, 0.9)',
      border: '2px solid #000000',
    },
    button: {
      scale: 1.5,
      backgroundColor: 'rgba(0, 0, 0, 0.8)',
      border: '2px solid #ffffff',
    },
    link: {
      scale: 1.2,
      backgroundColor: 'rgba(59, 130, 246, 0.8)',
      border: '2px solid #ffffff',
    },
    drag: {
      scale: 1.3,
      backgroundColor: 'rgba(16, 185, 129, 0.8)',
      border: '2px solid #ffffff',
    }
  };

  return (
    <>
      {/* Spotlight effect */}
      <div
        className="fixed pointer-events-none z-[9997]"
        style={{
          left: position.x - 150,
          top: position.y - 150,
          width: 300,
          height: 300,
          background: `radial-gradient(circle, rgba(0,0,0,0.05) 0%, transparent 70%)`,
          borderRadius: '50%',
          transition: 'opacity 0.3s ease',
          opacity: isHovering ? 0.6 : 0.2,
        }}
      />

      {/* Main cursor */}
      <motion.div
        className="fixed top-0 left-0 pointer-events-none z-[9999] rounded-full"
        animate={{
          x: position.x - 16,
          y: position.y - 16,
          scale: isClicking ? 0.8 : variants[cursorVariant as keyof typeof variants].scale,
        }}
        transition={{ type: 'spring', stiffness: 500, damping: 28 }}
        style={{
          width: 32,
          height: 32,
          backgroundColor: variants[cursorVariant as keyof typeof variants].backgroundColor,
          border: variants[cursorVariant as keyof typeof variants].border,
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.3)',
        }}
      />

      {/* Cursor trail particles */}
      {[...Array(3)].map((_, i) => (
        <motion.div
          key={i}
          className="fixed top-0 left-0 pointer-events-none z-[9998] rounded-full bg-black/30"
          animate={{
            x: position.x - 2,
            y: position.y - 2,
          }}
          transition={{ 
            type: 'spring', 
            stiffness: 150 - i * 30, 
            damping: 15 + i * 5 
          }}
          style={{
            width: 4 - i,
            height: 4 - i,
          }}
        />
      ))}
    </>
  );
}

