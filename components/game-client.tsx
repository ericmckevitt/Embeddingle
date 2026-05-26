"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";

type GuessResult = {
  guess: string;
  score: number;
  rank: number;
  isExact: boolean;
  attemptsUsed: number;
};

export function GameClient() {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [guess, setGuess] = useState("");
  const [history, setHistory] = useState<GuessResult[]>([]);
  const [status, setStatus] = useState("Starting game...");
  const [error, setError] = useState<string | null>(null);
  const [won, setWon] = useState(false);

  const startSession = async (): Promise<string> => {
    const res = await fetch("/api/game/start", { method: "POST" });
    if (!res.ok) {
      throw new Error("Failed to start game");
    }
    const data = (await res.json()) as { sessionId: string; vocabSize: number };
    setSessionId(data.sessionId);
    setStatus(`Game started. Vocabulary size: ${data.vocabSize}.`);
    return data.sessionId;
  };

  useEffect(() => {
    const start = async () => {
      try {
        await startSession();
      } catch (startError) {
        setError(startError instanceof Error ? startError.message : "Unknown error");
      }
    };
    void start();
  }, []);

  const attempts = useMemo(() => history.length, [history]);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!sessionId || won) {
      return;
    }
    const normalizedGuess = guess.trim().toLowerCase();
    if (!normalizedGuess) {
      return;
    }

    setError(null);

    try {
      const submitGuess = async (activeSessionId: string) => {
        const res = await fetch("/api/game/guess", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ sessionId: activeSessionId, guess: normalizedGuess })
        });
        const data = (await res.json()) as GuessResult & { error?: string };
        return { res, data };
      };

      let activeSessionId = sessionId;
      let { res, data } = await submitGuess(activeSessionId);

      if (res.status === 404) {
        activeSessionId = await startSession();
        setHistory([]);
        setWon(false);
        setStatus("Session expired during development reload. Started a new game.");
        ({ res, data } = await submitGuess(activeSessionId));
      }

      if (!res.ok) {
        setError(data.error ?? "Guess failed");
        return;
      }

      setHistory((prev) => [...prev, data]);
      setGuess("");
      if (data.isExact) {
        setWon(true);
        setStatus(`Solved in ${data.attemptsUsed} attempts.`);
      }
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Unknown error");
    }
  };

  return (
    <section>
      <p className="muted">{status}</p>
      <form onSubmit={onSubmit}>
        <input
          value={guess}
          onChange={(event) => setGuess(event.target.value)}
          placeholder="Enter a vocabulary word"
          disabled={!sessionId || won}
        />
        <button type="submit" disabled={!sessionId || won}>
          Guess
        </button>
      </form>
      {error ? <p className="error">{error}</p> : null}
      {won ? <p className="success">You found the target word.</p> : null}

      <p className="muted">Attempts: {attempts}</p>

      <table>
        <thead>
          <tr>
            <th>Guess</th>
            <th>Score</th>
            <th>Rank</th>
          </tr>
        </thead>
        <tbody>
          {history.map((item, index) => (
            <tr key={`${item.guess}-${index}`}>
              <td>{item.guess}</td>
              <td>{item.score.toFixed(1)}</td>
              <td>#{item.rank}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
