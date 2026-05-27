"use client";

import { FormEvent, KeyboardEvent, useEffect, useMemo, useState } from "react";

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
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [activeSuggestionIndex, setActiveSuggestionIndex] = useState(-1);

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

  useEffect(() => {
    if (won) {
      setSuggestions([]);
      setActiveSuggestionIndex(-1);
      return;
    }

    const normalized = guess.trim().toLowerCase();
    if (!normalized) {
      setSuggestions([]);
      setActiveSuggestionIndex(-1);
      return;
    }

    const timer = setTimeout(() => {
      const fetchSuggestions = async () => {
        try {
          const res = await fetch("/api/vocab/search", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ query: normalized, limit: 12 })
          });
          if (!res.ok) {
            return;
          }
          const data = (await res.json()) as { suggestions: string[] };
          setSuggestions(data.suggestions);
          setActiveSuggestionIndex(data.suggestions.length > 0 ? 0 : -1);
        } catch {
          setSuggestions([]);
          setActiveSuggestionIndex(-1);
        }
      };

      void fetchSuggestions();
    }, 140);

    return () => clearTimeout(timer);
  }, [guess, won]);

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
      setSuggestions([]);
      setActiveSuggestionIndex(-1);
      if (data.isExact) {
        setWon(true);
        setStatus(`Solved in ${data.attemptsUsed} attempts.`);
      }
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Unknown error");
    }
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (suggestions.length === 0) {
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveSuggestionIndex((prev) => (prev + 1) % suggestions.length);
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveSuggestionIndex((prev) => {
        if (prev <= 0) {
          return suggestions.length - 1;
        }
        return prev - 1;
      });
      return;
    }

    if (event.key === "Escape") {
      setSuggestions([]);
      setActiveSuggestionIndex(-1);
      return;
    }

    if (event.key === "Enter" && activeSuggestionIndex >= 0) {
      event.preventDefault();
      setGuess(suggestions[activeSuggestionIndex]);
      setSuggestions([]);
      setActiveSuggestionIndex(-1);
    }
  };

  const selectSuggestion = (word: string) => {
    setGuess(word);
    setSuggestions([]);
    setActiveSuggestionIndex(-1);
  };

  return (
    <section>
      <p className="muted">{status}</p>
      <form onSubmit={onSubmit}>
        <input
          value={guess}
          onChange={(event) => setGuess(event.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Enter a vocabulary word"
          disabled={!sessionId || won}
          autoComplete="off"
        />
        <button type="submit" disabled={!sessionId || won}>
          Guess
        </button>
      </form>
      {suggestions.length > 0 ? (
        <div className="suggestions" role="listbox" aria-label="Vocabulary suggestions">
          {suggestions.map((word, index) => (
            <button
              type="button"
              key={word}
              className={`suggestion-item ${index === activeSuggestionIndex ? "active" : ""}`}
              onClick={() => selectSuggestion(word)}
            >
              {word}
            </button>
          ))}
        </div>
      ) : null}
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
            <tr
              key={`${item.guess}-${index}`}
              className="score-row"
              style={{
                ["--score" as string]: `${Math.max(0, Math.min(100, item.score))}%`,
                ["--score-hue" as string]: String(
                  Math.round(
                    12 + ((Math.max(0, Math.min(100, item.score)) / 100) * (142 - 12))
                  )
                )
              }}
            >
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
