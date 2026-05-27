"use client";

import { FormEvent, KeyboardEvent, useEffect, useMemo, useState } from "react";

type GuessResult = {
  guess: string;
  score: number;
  rank: number;
  isExact: boolean;
  attemptsUsed: number;
  attemptsRemaining: number;
  gameOver: boolean;
  bestScore: number;
};

type StartResponse = {
  sessionId: string;
  vocabSize: number;
  maxAttempts: number;
};

export function GameClient() {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [guess, setGuess] = useState("");
  const [history, setHistory] = useState<GuessResult[]>([]);
  const [status, setStatus] = useState("Starting game...");
  const [error, setError] = useState<string | null>(null);
  const [won, setWon] = useState(false);
  const [gameOver, setGameOver] = useState(false);
  const [maxAttempts, setMaxAttempts] = useState(6);
  const [bestScore, setBestScore] = useState(0);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [activeSuggestionIndex, setActiveSuggestionIndex] = useState(-1);
  const [copied, setCopied] = useState(false);

  const startSession = async (): Promise<string> => {
    const res = await fetch("/api/game/start", { method: "POST" });
    if (!res.ok) {
      throw new Error("Failed to start game");
    }
    const data = (await res.json()) as StartResponse;
    setSessionId(data.sessionId);
    setMaxAttempts(data.maxAttempts);
    setHistory([]);
    setBestScore(0);
    setWon(false);
    setGameOver(false);
    setCopied(false);
    setStatus(`Round started. ${data.maxAttempts} guesses available.`);
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
    if (won || gameOver) {
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
  }, [guess, won, gameOver]);

  const attempts = useMemo(() => history.length, [history]);

  const buildShareText = () => {
    const total = maxAttempts;
    const used = history.length;
    const header = `Embeddingle ${used}/${total}`;
    const best = `Best score: ${bestScore.toFixed(1)}`;
    const barWidth = 10;

    const lines = history.map((item, index) => {
      const filled = Math.max(0, Math.min(barWidth, Math.round((item.score / 100) * barWidth)));
      const bar = `${"#".repeat(filled)}${"-".repeat(barWidth - filled)}`;
      return `${index + 1}. [${bar}] ${item.score.toFixed(1)}`;
    });

    return [header, best, ...lines].join("\n");
  };

  const onCopyShare = async () => {
    const text = buildShareText();
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("Unable to copy to clipboard.");
    }
  };

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!sessionId || won || gameOver) {
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
        const data = (await res.json()) as GuessResult & {
          error?: string;
          gameOver?: boolean;
          bestScore?: number;
        };
        return { res, data };
      };

      let activeSessionId = sessionId;
      let { res, data } = await submitGuess(activeSessionId);

      if (res.status === 404) {
        activeSessionId = await startSession();
        setStatus("Round restarted.");
        ({ res, data } = await submitGuess(activeSessionId));
      }

      if (!res.ok) {
        if (res.status === 409) {
          const lockedBest = data.bestScore ?? bestScore;
          setGameOver(true);
          setBestScore(lockedBest);
          setStatus(`Round over. Best score: ${lockedBest.toFixed(1)}.`);
        }
        setError(data.error ?? "Guess failed.");
        return;
      }

      setHistory((prev) => [...prev, data]);
      setBestScore(data.bestScore);
      setGuess("");
      setSuggestions([]);
      setActiveSuggestionIndex(-1);

      if (data.isExact) {
        setWon(true);
        setGameOver(true);
        setStatus(
          `Solved in ${data.attemptsUsed} attempts. Best score: ${data.bestScore.toFixed(1)}.`
        );
      } else if (data.gameOver) {
        setGameOver(true);
        setStatus(`Round over. Best score: ${data.bestScore.toFixed(1)}.`);
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
      <form onSubmit={onSubmit}>
        <input
          value={guess}
          onChange={(event) => setGuess(event.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Enter a vocabulary word"
          disabled={!sessionId || won || gameOver}
          autoComplete="off"
        />
        <button type="submit" disabled={!sessionId || won || gameOver}>
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
      {error ? <p className="error-banner">{error}</p> : null}
      {won ? <p className="success-banner">Correct. You found the hidden word.</p> : null}

      <div className="stats-row">
        <span className="stat-chip">Attempts: {attempts}/{maxAttempts}</span>
        <span className="stat-chip">Best score: {bestScore.toFixed(1)}</span>
      </div>

      {gameOver ? (
        <div className="share-wrap">
          <button type="button" onClick={onCopyShare}>Copy share result</button>
          {copied ? <span className="muted">Copied.</span> : null}
        </div>
      ) : null}

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
                  Math.round(12 + ((Math.max(0, Math.min(100, item.score)) / 100) * (142 - 12)))
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
