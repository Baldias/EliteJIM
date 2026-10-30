import React, { useEffect } from 'react';
import { useWorkoutAutoFinish } from './hooks/useWorkoutAutoFinish';
import { hasCurrentThemeChoice } from './utils/theme';
import { BrowserRouter, Routes, Route, NavLink, useLocation } from 'react-router-dom';
import { Home as HomeIcon, TrendingUp, User, Dna, Utensils } from 'lucide-react';
import { initPersistentStorage } from './utils/backup';
import Home from './pages/home/Home';
import Workout from './pages/workout/Workout';
import ProgressOverload from './pages/progress/ProgressOverload';
import Science from './pages/science/Science';
import Profile from './pages/profile/Profile';
import Settings from './pages/settings/Settings';
import Exercises from './pages/settings/Exercises';
import TemplateBuilder from './pages/workout/TemplateBuilder';
import WorkoutRecap from './pages/workout/WorkoutRecap';
import MuscleLevels from './pages/profile/MuscleLevels';
import History from './pages/profile/History';
import EditWorkout from './pages/profile/EditWorkout';
import Activity from './pages/activity/Activity';
import Monitoring from './pages/monitoring/Monitoring';
import MyMeals from './pages/monitoring/MyMeals';
import ReloadPrompt from './components/ReloadPrompt';
import ReleaseNotes from './components/ReleaseNotes';
import { RELEASE_NOTES_VERSION } from './utils/releaseNotes';
import ScienceWeekPrompt from './components/ScienceWeekPrompt';
import GlobalWorkoutBanner from './components/GlobalWorkoutBanner';
import DemoBanner from './components/DemoBanner';
import { useStore } from './store/useStore';
import { ThemeOnboarding } from './components/ThemePicker';
import OptionalFeature from './components/OptionalFeature';
import { SpeedInsights } from '@vercel/speed-insights/react';
import './App.css';
import { tr } from './i18n';

function Navigation() {
  const location = useLocation();
  // Hide bottom nav on active workout session, template builder, settings, recap, history, levels, and activity
  if (['/workout', '/build', '/settings', '/recap', '/levels', '/settings/exercises', '/settings/pasti', '/history', '/activity'].includes(location.pathname) || location.pathname.startsWith('/edit-workout')) return null;

  return (
    <nav className="bottom-nav">
        <NavLink to="/science" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
          <Dna size={24} />
          <span>{tr("Scienza")}</span>
        </NavLink>
      <NavLink to="/diario" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
        <Utensils size={24} />
        <span>{tr("Diario")}</span>
      </NavLink>
      <NavLink to="/" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`} end>
        <HomeIcon size={24} />
        <span>Home</span>
      </NavLink>
      <NavLink to="/progress" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
        <TrendingUp size={24} />
        <span>{tr("Progressi")}</span>
      </NavLink>
      <NavLink to="/profile" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
        <User size={24} />
        <span>{tr("Profilo")}</span>
      </NavLink>
    </nav>
  );
}

function AppContent() {
  useWorkoutAutoFinish();
  const themeChosen = useStore(hasCurrentThemeChoice);
  const releaseNotesSeen = useStore(state => state.releaseNotesSeen);
  const dismissReleaseNotes = useStore(state => state.dismissReleaseNotes);
  useEffect(() => {
    initPersistentStorage();
  }, []);

  if (!themeChosen) return <><DemoBanner /><ThemeOnboarding /></>;
  if (releaseNotesSeen !== RELEASE_NOTES_VERSION) return <><DemoBanner /><div className="ej-page release-background"><div className="ej-glow" aria-hidden="true" /></div><ReleaseNotes previousVersion={releaseNotesSeen} onClose={() => dismissReleaseNotes(RELEASE_NOTES_VERSION)} /></>;

  return (
    <BrowserRouter>
      <div className="app-container">
        <DemoBanner />
        <ReloadPrompt />
        <GlobalWorkoutBanner />
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/workout" element={<Workout />} />
          <Route path="/progress" element={<ProgressOverload />} />
          <Route path="/science" element={<OptionalFeature key="science" feature="science"><Science /></OptionalFeature>} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/settings/exercises" element={<Exercises />} />
          <Route path="/build" element={<TemplateBuilder />} />
          <Route path="/recap" element={<WorkoutRecap />} />
          <Route path="/levels" element={<MuscleLevels />} />
          <Route path="/history" element={<History />} />
          <Route path="/edit-workout/:workoutId" element={<EditWorkout />} />
          <Route path="/activity" element={<Activity />} />
          <Route path="/diario" element={<OptionalFeature key="diary" feature="diary"><Monitoring /></OptionalFeature>} />
          <Route path="/settings/pasti" element={<OptionalFeature key="meals" feature="diary"><MyMeals /></OptionalFeature>} />
        </Routes>
        <Navigation />
        <ScienceWeekPrompt />
        <SpeedInsights />
      </div>
    </BrowserRouter>
  );
}

// Remount the whole UI when the language changes, so every label is rendered again.
function App() {
  const language = useStore(state => state.language);
  return <AppContent key={language ?? 'auto'} />;
}

export default App;
