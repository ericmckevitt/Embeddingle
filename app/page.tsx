import { GameClient } from "@/components/game-client";

export default function HomePage() {
  return (
    <main>
      <h1>Embeddingle</h1>
      <p className="muted">
        Guess a hidden target word. Scores represent semantic closeness on a 0-100
        percentile scale.
      </p>
      <GameClient />
    </main>
  );
}
