import { useMemo, useState } from 'react';
import GameCard from '../components/GameCard';
import { games } from '../data/games';

const filters = ['Alle', ...new Set(games.map((game) => game.genre))];

export default function GamesPage() {
  const [activeGenre, setActiveGenre] = useState('Alle');

  const visibleGames = useMemo(() => {
    if (activeGenre === 'Alle') {
      return games;
    }

    return games.filter((game) => game.genre === activeGenre);
  }, [activeGenre]);

  return (
    <section className="stack">
      <header className="section-header">
        <h2>Game-Lobby</h2>
        <p>Filtere deine Spiele nach Genre und behalte den Status im Blick.</p>
      </header>

      <div className="filter-row">
        {filters.map((filter) => (
          <button
            key={filter}
            className={`btn-filter ${activeGenre === filter ? 'active' : ''}`}
            onClick={() => setActiveGenre(filter)}
            type="button"
          >
            {filter}
          </button>
        ))}
      </div>

      <div className="cards-grid">
        {visibleGames.map((game) => (
          <GameCard key={game.id} game={game} />
        ))}
      </div>
    </section>
  );
}
