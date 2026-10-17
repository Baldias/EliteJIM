import React, { useState, useRef, useEffect, useCallback } from 'react';
import { Trash2 } from 'lucide-react';
import './SwipeToDelete.css';

export function SwipeToDelete({ children, onDelete }) {
  const [currentX, setCurrentX] = useState(0);
  const [isSwiping, setIsSwiping] = useState(false);

  const threshold = 70; // px to show delete button
  const confirmThreshold = 150; // px to auto-delete

  const swipeContentRef = useRef(null);
  const dragInfo = useRef({ startX: 0, currentX: 0, isSwiping: false });

  // Always call the latest onDelete: the touch listeners below are registered once.
  const onDeleteRef = useRef(onDelete);
  useEffect(() => {
    onDeleteRef.current = onDelete;
  });

  const resetSwipe = useCallback(() => {
    dragInfo.current.currentX = 0;
    setCurrentX(0);
  }, []);

  // onDelete usually asks for confirmation: run it right away and slide the row back.
  // If the item really gets deleted the row unmounts; if the user cancels it stays visible.
  const requestDelete = useCallback(() => {
    onDeleteRef.current?.();
    resetSwipe();
  }, [resetSwipe]);

  useEffect(() => {
    const el = swipeContentRef.current;
    if (!el) return;

    const handleStart = (e) => {
      if (e.target.closest('.autocomplete-dropdown')) return;
      dragInfo.current.startX = e.touches[0].clientX;
      dragInfo.current.isSwiping = true;
      setIsSwiping(true);
    };

    const handleMove = (e) => {
      if (!dragInfo.current.isSwiping) return;
      const diff = e.touches[0].clientX - dragInfo.current.startX;

      if (Math.abs(diff) > 5) {
        // If horizontal movement is dominant, prevent scroll
        if (e.cancelable) e.preventDefault();

        if (diff < 0) {
          dragInfo.current.currentX = diff;
          setCurrentX(diff);
        }
      }
    };

    const handleEnd = () => {
      dragInfo.current.isSwiping = false;
      setIsSwiping(false);

      const finalX = dragInfo.current.currentX;
      if (finalX < -confirmThreshold) {
        requestDelete();
      } else if (finalX < -threshold) {
        dragInfo.current.currentX = -threshold;
        setCurrentX(-threshold);
      } else {
        resetSwipe();
      }
    };

    el.addEventListener('touchstart', handleStart, { passive: true });
    el.addEventListener('touchmove', handleMove, { passive: false });
    el.addEventListener('touchend', handleEnd, { passive: true });

    return () => {
      el.removeEventListener('touchstart', handleStart);
      el.removeEventListener('touchmove', handleMove);
      el.removeEventListener('touchend', handleEnd);
    };
  }, [requestDelete, resetSwipe]);

  const translateX = Math.max(-200, currentX);

  return (
    <div
      className="swipe-container"
      style={{ overflow: (currentX !== 0 || isSwiping) ? 'hidden' : 'visible' }}
    >
      <div
        className="swipe-action-bg"
        style={{ opacity: Math.abs(currentX) > 20 ? 1 : 0 }}
        onClick={requestDelete}
      >
        <div className="swipe-action-content">
          <Trash2 size={24} />
        </div>
      </div>
      <div
        ref={swipeContentRef}
        className="swipe-content"
        style={{
          transform: currentX !== 0 ? `translateX(${translateX}px)` : 'none',
          transition: isSwiping ? 'none' : 'transform 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94)',
          position: 'relative',
          zIndex: (currentX !== 0 || isSwiping) ? 2 : 'auto'
        }}
      >
        {children}
      </div>
    </div>
  );
}
