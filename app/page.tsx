import { GameClient } from "@/components/game-client";

export default function HomePage() {
  return (
    <main>
      <header className="hero">
        <h1>Embeddingle</h1>
        <p className="subtitle">Find the hidden word in 6 guesses.</p>
        <div className="explain">
          <p>How it works:</p>
          <ul>
            <li>Each guess receives a score from 0 to 100.</li>
            <li>Higher score means closer in meaning to the hidden word.</li>
            <li>Your final result is your best score across all 6 guesses.</li>
          </ul>
          <p className="muted">This game uses semantic similarity, not letter matching.</p>
        </div>
      </header>
      <GameClient />
    </main>
  );
}
