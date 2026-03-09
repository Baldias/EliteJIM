import React from 'react';
import { BrowserRouter, Routes, Route, NavLink, useLocation } from 'react-router-dom';
import { Home as HomeIcon, History as HistoryIcon, User } from 'lucide-react';
import Home from './pages/Home';
import Workout from './pages/Workout';
import History from './pages/History';
import Profile from './pages/Profile';
import TemplateBuilder from './pages/TemplateBuilder';
import ReloadPrompt from './components/ReloadPrompt';
import './App.css';

function Navigation() {
  const location = useLocation();
  // Hide bottom nav on active workout session and template builder
  if (location.pathname === '/workout' || location.pathname === '/build') return null;

  return (
    <nav className="bottom-nav">
      <NavLink to="/" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`} end>
        <HomeIcon size={24} />
        <span>Home</span>
      </NavLink>
      <NavLink to="/history" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
        <HistoryIcon size={24} />
        <span>Storico</span>
      </NavLink>
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
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/workout" element={<Workout />} />
          <Route path="/history" element={<History />} />
          <Route path="/profile" element={<Profile />} />
          <Route path="/build" element={<TemplateBuilder />} />
        </Routes>
        <Navigation />
      </div>
    </BrowserRouter>
  );
}

export default App;
