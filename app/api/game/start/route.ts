import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { MAX_ATTEMPTS, scoreGuessWords, todayDateKey } from "@/lib/daily-game";
import { decodeProgress, progressCookieName } from "@/lib/progress-cookie";
import { getVocabStore } from "@/lib/vocab";

export async function POST() {
  try {
    const { words } = getVocabStore();
    const dateKey = todayDateKey();
    const raw = cookies().get(progressCookieName())?.value;
    const progress = decodeProgress(raw);
    const guessWords = progress?.dateKey === dateKey ? progress.guesses.slice(0, MAX_ATTEMPTS) : [];
    const attempts = scoreGuessWords(guessWords, dateKey);
    const bestScore = attempts.reduce((best, guess) => Math.max(best, guess.score), 0);
    const gameOver = attempts.length >= MAX_ATTEMPTS || attempts.some((guess) => guess.isExact);

    return NextResponse.json({
      attempts,
      vocabSize: words.length,
      maxAttempts: MAX_ATTEMPTS,
      bestScore,
      gameOver,
      dateKey
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to start game"
      },
      { status: 500 }
    );
  }
}
