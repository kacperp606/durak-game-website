import { Link } from 'react-router-dom';
import { games } from '../data/games';

const highlights = [
  { label: 'Games gesamt', value: games.length },
  { label: 'Aktive Spieler', value: '31.5k' },
  { label: 'Release-Rate', value: '2 / Monat' }
];

export default function HomePage() {
  return (
    <section className="page-grid">
      <div className="hero glass-card">
        <p className="eyebrow">Deine Game-Plattform</p>
        <h2>Wie bei Spieleaffe – nur mit deinen eigenen Hits</h2>
        <p>
          Präsentiere deine Spiele übersichtlich mit Home, Games und Fortschritt. Perfekt für Community,
          Updates und neue Releases.
        </p>
        <div className="cta-row">
          <Link to="/games" className="btn primary">
            Games ansehen
          </Link>
          <Link to="/fortschritt" className="btn secondary">
            Fortschritt checken
          </Link>
        </div>
      </div>

      <div className="stats-grid">
        {highlights.map((item) => (
          <article key={item.label} className="stat-card glass-card">
            <span>{item.label}</span>
            <strong>{item.value}</strong>
          </article>
        ))}
      </div>
    </section>
  );
}
