import React, { useState, useRef } from 'react';
import { Trash2 } from 'lucide-react';
import './SwipeToDelete.css';

export function SwipeToDelete({ children, onDelete }) {
  const [startX, setStartX] = useState(0);
  const [currentX, setCurrentX] = useState(0);
  const [isSwiping, setIsSwiping] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  
  const threshold = 70; // px to show delete button
  const confirmThreshold = 150; // px to auto-delete

  const handleTouchStart = (e) => {
    // Non intercettare il tocco su input, bottoni o menu a tendina
    if (e.target.closest('input') || e.target.closest('button') || e.target.closest('.autocomplete-dropdown')) {
      return;
    }
    setStartX(e.touches[0].clientX);
    setIsSwiping(true);
  };

  const handleTouchMove = (e) => {
    if (!isSwiping) return;
    const diff = e.touches[0].clientX - startX;
    // Only allow left swipe (negative diff)
    if (diff < 0) {
      setCurrentX(diff);
    }
  };

  const handleTouchEnd = () => {
    setIsSwiping(false);
    if (currentX < -confirmThreshold) {
      handleDelete();
    } else if (currentX < -threshold) {
      setCurrentX(-threshold);
    } else {
      setCurrentX(0);
    }
  };

  const handleDelete = () => {
    setIsDeleting(true);
    setTimeout(() => {
      onDelete();
    }, 300);
  };

  const translateX = Math.max(-200, currentX);

  return (
    <div 
      className={`swipe-container ${isDeleting ? 'deleting' : ''}`}
      style={{ overflow: (currentX !== 0 || isSwiping) ? 'hidden' : 'visible' }}
    >
      <div 
        className="swipe-action-bg"
        style={{ opacity: Math.abs(currentX) > 20 ? 1 : 0 }}
        onClick={handleDelete}
      >
        <div className="swipe-action-content">
          <Trash2 size={24} />
        </div>
      </div>
      <div 
        className="swipe-content"
        style={{ 
          transform: currentX !== 0 ? `translateX(${translateX}px)` : 'none',
          transition: isSwiping ? 'none' : 'transform 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94)',
          position: 'relative',
          zIndex: (currentX !== 0 || isSwiping) ? 2 : 'auto'
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {children}
      </div>
    </div>
  );
}
