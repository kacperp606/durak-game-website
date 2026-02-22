import { games } from '../data/games';

function bucket(progress) {
  if (progress >= 80) {
    return 'Fast fertig';
  }

  if (progress >= 50) {
    return 'In Produktion';
  }

  return 'Frühe Phase';
}

export default function ProgressPage() {
  const sortedGames = [...games].sort((a, b) => b.progress - a.progress);

  return (
    <section className="stack">
      <header className="section-header">
        <h2>Fortschritt & Roadmap</h2>
        <p>Sieh sofort, welche Spiele kurz vor Release stehen und welche noch gebaut werden.</p>
      </header>

      <div className="timeline glass-card">
        {sortedGames.map((game) => (
          <div key={game.id} className="timeline-row">
            <div>
              <h3>{game.title}</h3>
              <p>{bucket(game.progress)}</p>
            </div>

            <div className="progress-inline">
              <div className="progress-track" role="progressbar" aria-valuenow={game.progress} aria-valuemin="0" aria-valuemax="100">
                <div className="progress-fill" style={{ width: `${game.progress}%` }} />
              </div>
              <strong>{game.progress}%</strong>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
