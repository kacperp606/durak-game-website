import { NavLink, Route, Routes } from 'react-router-dom';
import HomePage from './pages/HomePage';
import GamesPage from './pages/GamesPage';
import ProgressPage from './pages/ProgressPage';

const links = [
  { to: '/', label: 'Home' },
  { to: '/games', label: 'Games' },
  { to: '/fortschritt', label: 'Fortschritt' }
];

export default function App() {
  return (
    <div className="app-shell">
      <header className="site-header glass-card">
        <div>
          <p className="eyebrow">Creator Arcade</p>
          <h1>ArcadeLab</h1>
          <p className="subtitle">Deine selbst erstellten Games in einer stylischen Spielewelt.</p>
        </div>

        <nav className="nav-tabs" aria-label="Hauptnavigation">
          {links.map((link) => (
            <NavLink
              key={link.to}
              to={link.to}
              end={link.to === '/'}
              className={({ isActive }) => `tab ${isActive ? 'active' : ''}`}
            >
              {link.label}
            </NavLink>
          ))}
        </nav>
      </header>

      <main>
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/games" element={<GamesPage />} />
          <Route path="/fortschritt" element={<ProgressPage />} />
        </Routes>
      </main>
    </div>
  );
}
