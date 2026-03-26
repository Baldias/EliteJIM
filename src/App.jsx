import React from 'react';
import { BrowserRouter, Routes, Route, NavLink, useLocation } from 'react-router-dom';
import { Home as HomeIcon, TrendingUp, User, Dna } from 'lucide-react';
import { useStore } from './store/useStore';
import Home from './pages/Home';
import Workout from './pages/Workout';
import ProgressOverload from './pages/ProgressOverload';
import Science from './pages/Science';
import Profile from './pages/Profile';
import Settings from './pages/Settings';
import Exercises from './pages/Exercises';
import TemplateBuilder from './pages/TemplateBuilder';
import WorkoutRecap from './pages/WorkoutRecap';
import MuscleLevels from './pages/MuscleLevels';
import History from './pages/History';
import EditWorkout from './pages/EditWorkout';
import ReloadPrompt from './components/ReloadPrompt';
import GlobalWorkoutBanner from './components/GlobalWorkoutBanner';
import { SpeedInsights } from '@vercel/speed-insights/react';
import './App.css';

function Navigation() {
  const location = useLocation();
  const showScience = useStore(state => state.showScience);
  // Hide bottom nav on active workout session, template builder, settings, recap, history, and levels
  if (['/workout', '/build', '/settings', '/recap', '/levels', '/settings/exercises', '/history'].includes(location.pathname) || location.pathname.startsWith('/edit-workout')) return null;

  return (
    <nav className="bottom-nav">
      <NavLink to="/" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`} end>
        <HomeIcon size={24} />
        <span>Home</span>
      </NavLink>
      <NavLink to="/progress" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
        <TrendingUp size={24} />
        <span>Progressi</span>
      </NavLink>
      {showScience && (
        <NavLink to="/science" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
          <Dna size={24} />
          <span>Scienza</span>
        </NavLink>
      )}
      <NavLink to="/profile" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
        <User size={24} />
        <span>Profilo</span>
      </NavLink>
    </nav>
  );
}

function App() {
  return (
    <BrowserRouter>
      <div className="app-container">
        <ReloadPrompt />
        <GlobalWorkoutBanner />
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/workout" element={<Workout />} />
          <Route path="/progress" element={<ProgressOverload />} />
          <Route path="/science" element={<Science />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/settings/exercises" element={<Exercises />} />
          <Route path="/build" element={<TemplateBuilder />} />
          <Route path="/recap" element={<WorkoutRecap />} />
          <Route path="/levels" element={<MuscleLevels />} />
          <Route path="/history" element={<History />} />
          <Route path="/edit-workout/:workoutId" element={<EditWorkout />} />
        </Routes>
        <Navigation />
        <SpeedInsights />
      </div>
    </BrowserRouter>
  );
}

export default App;
