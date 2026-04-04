'use client';

import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { motion } from 'framer-motion';
import { ReactNode } from 'react';

interface DraggableWidgetProps {
  id: string;
  children: ReactNode;
}

export function DraggableWidget({ id, children }: DraggableWidgetProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 1000 : 1,
  };

  return (
    <motion.div
      ref={setNodeRef}
      style={style}
      {...attributes}
      {...listeners}
      className="touch-none cursor-grab active:cursor-grabbing"
      whileDrag={{ 
        scale: 1.05,
        rotateZ: 2,
        boxShadow: '0 30px 100px rgba(0,0,0,0.3)',
      }}
    >
      {children}
    </motion.div>
  );
}

