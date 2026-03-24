import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Play } from 'lucide-react';
import { useStore } from '../store/useStore';
import { requestNotificationPermission, notifyTimerComplete } from '../utils/notifications';
import './GlobalWorkoutBanner.css';

function GlobalWorkoutBanner() {
  const navigate = useNavigate();
  const location = useLocation();

  const activeWorkout = useStore(state => state.activeWorkout);
  const globalRestEndTime = useStore(state => state.globalRestEndTime);
  const clearGlobalRestTimer = useStore(state => state.clearGlobalRestTimer);

  const [sessionTimeStr, setSessionTimeStr] = useState('00:00');
  const [restTimeLeft, setRestTimeLeft] = useState(0);
  const [isResting, setIsResting] = useState(false);

  // Ask for notification permission when they start a workout
  useEffect(() => {
    if (activeWorkout) {
      requestNotificationPermission();
    }
  }, [activeWorkout]);

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

  // Rest timer sync with global store
  useEffect(() => {
    if (!globalRestEndTime) {
      setIsResting(false);
      setRestTimeLeft(0);
      return;
    }

    setIsResting(true);

    const checkTimer = () => {
      const remaining = Math.ceil((globalRestEndTime - Date.now()) / 1000);
      if (remaining <= 0) {
        setIsResting(false);
        setRestTimeLeft(0);
        clearGlobalRestTimer();
        notifyTimerComplete(); // Web Audio Beep + Push Notification
      } else {
        setRestTimeLeft(remaining);
      }
    };

    checkTimer();
    const interval = setInterval(checkTimer, 1000);
    return () => clearInterval(interval);
  }, [globalRestEndTime, clearGlobalRestTimer]);

  const formatRestTime = (seconds) => {
    const m = Math.floor(seconds / 60);
    const s = String(seconds % 60).padStart(2, '0');
    return `${m}:${s}`;
  };

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
        {isResting && (
          <div className="global-banner-rest">
            <span className="global-banner-rest-label">Rec.</span>
            <span className="global-banner-rest-time">{formatRestTime(restTimeLeft)}</span>
          </div>
        )}
      </div>
    </div>
  );
}

export default GlobalWorkoutBanner;
