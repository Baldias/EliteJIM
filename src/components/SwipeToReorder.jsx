import React, { useState, useRef, useEffect } from 'react';
import { ChevronUp, ChevronDown } from 'lucide-react';
import './SwipeToReorder.css';

export function SwipeToReorder({ children, onMoveUp, onMoveDown, isFirst, isLast }) {
  const [currentX, setCurrentX] = useState(0);
  const [isSwiping, setIsSwiping] = useState(false);
  
  const threshold = 80;

  const swipeContentRef = useRef(null);
  const dragInfo = useRef({ startX: 0, currentX: 0, isSwiping: false });

  useEffect(() => {
    const el = swipeContentRef.current;
    if (!el) return;

    const handleStart = (e) => {
      // Don't swipe if clicking inside input or button elements
      if (e.target.closest('input') || e.target.closest('button') || e.target.closest('.autocomplete-dropdown')) return;
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      dragInfo.current.startX = clientX;
      dragInfo.current.isSwiping = true;
      setIsSwiping(true);
    };

    const handleMove = (e) => {
      if (!dragInfo.current.isSwiping) return;
      const clientX = e.touches ? e.touches[0].clientX : e.clientX;
      const diff = clientX - dragInfo.current.startX;

      if (diff < 0) { // Swiping left
        dragInfo.current.currentX = diff;
        setCurrentX(diff);
      } else if (diff > 0 && dragInfo.current.currentX < 0) {
        // Swiping back right
        const newX = Math.min(0, dragInfo.current.currentX + diff);
        dragInfo.current.currentX = newX;
        setCurrentX(newX);
      }
    };

    const handleEnd = () => {
      if (!dragInfo.current.isSwiping) return;
      dragInfo.current.isSwiping = false;
      setIsSwiping(false);
      
      const finalX = dragInfo.current.currentX;
      if (finalX < -threshold / 2) {
        dragInfo.current.currentX = -threshold;
        setCurrentX(-threshold);
      } else {
        dragInfo.current.currentX = 0;
        setCurrentX(0);
      }
    };

    el.addEventListener('touchstart', handleStart, { passive: true });
    el.addEventListener('touchmove', handleMove, { passive: true });
    el.addEventListener('touchend', handleEnd, { passive: true });

    return () => {
      el.removeEventListener('touchstart', handleStart);
      el.removeEventListener('touchmove', handleMove);
      el.removeEventListener('touchend', handleEnd);
    };
  }, []);

  const resetSwipe = () => {
    dragInfo.current.currentX = 0;
    setCurrentX(0);
  };

  const handleMoveUpClick = (e) => {
    e.stopPropagation();
    if (!isFirst) onMoveUp?.();
    resetSwipe();
  };

  const handleMoveDownClick = (e) => {
    e.stopPropagation();
    if (!isLast) onMoveDown?.();
    resetSwipe();
  };

  const translateX = Math.max(-120, currentX);

  return (
    <div className="swipe-reorder-container">
      <div 
        className="swipe-reorder-actions"
        style={{ opacity: Math.abs(currentX) > 15 ? 1 : 0 }}
      >
        <button 
          type="button"
          onClick={handleMoveUpClick}
          disabled={isFirst}
          className="reorder-action-btn"
          title="Sposta Su"
          style={{ opacity: isFirst ? 0.3 : 1 }}
        >
          <ChevronUp size={20} />
          <span>Su</span>
        </button>
        <button 
          type="button"
          onClick={handleMoveDownClick}
          disabled={isLast}
          className="reorder-action-btn"
          title="Sposta Giù"
          style={{ opacity: isLast ? 0.3 : 1 }}
        >
          <ChevronDown size={20} />
          <span>Giù</span>
        </button>
      </div>

      <div 
        ref={swipeContentRef}
        className="swipe-reorder-content"
        style={{ 
          transform: currentX !== 0 ? `translateX(${translateX}px)` : 'none',
          transition: isSwiping ? 'none' : 'transform 0.25s cubic-bezier(0.25, 0.46, 0.45, 0.94)'
        }}
      >
        {children}
      </div>
    </div>
  );
}
