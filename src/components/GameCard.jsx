export default function GameCard({ game }) {
  return (
    <article className="game-card glass-card">
      <div className="card-top">
        <span className="chip">{game.genre}</span>
        <span className={`status ${game.status.toLowerCase().replace(' ', '-')}`}>{game.status}</span>
      </div>

      <h3>{game.title}</h3>
      <p>{game.description}</p>

      <div className="meta-row">
        <span>Spieler: {game.players}</span>
        <span>Build: {game.progress}%</span>
      </div>

      <div className="progress-track" role="progressbar" aria-valuenow={game.progress} aria-valuemin="0" aria-valuemax="100">
        <div className="progress-fill" style={{ width: `${game.progress}%` }} />
      </div>
    </article>
  );
}
