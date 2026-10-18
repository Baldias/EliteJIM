import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Play } from 'lucide-react';
import { useStore } from '../store/useStore';
import './GlobalWorkoutBanner.css';

function GlobalWorkoutBanner() {
  const navigate = useNavigate();
  const location = useLocation();

  const activeWorkout = useStore(state => state.activeWorkout);

  const [sessionTimeStr, setSessionTimeStr] = useState('00:00');

  // Session timer
  useEffect(() => {
    if (!activeWorkout) return;
    const interval = setInterval(() => {
      const diff = Math.floor((Date.now() - activeWorkout.startTime) / 1000);
      const m = String(Math.floor(diff / 60)).padStart(2, '0');
      const s = String(diff % 60).padStart(2, '0');
      setSessionTimeStr(`${m}:${s}`);
    }, 1000);
    return () => clearInterval(interval);
  }, [activeWorkout]);

  // Only show if there is an active workout and we are NOT on the workout page
  if (!activeWorkout || location.pathname === '/workout') {
    return null;
  }

  return (
    <div className="global-workout-banner" onClick={() => navigate('/workout')}>
      <div className="global-banner-content">
        <div className="global-banner-info">
          <Play size={14} className="global-banner-icon blink" />
          <span className="global-banner-time">{sessionTimeStr}</span>
        </div>
      </div>
    </div>
  );
}

export default GlobalWorkoutBanner;
