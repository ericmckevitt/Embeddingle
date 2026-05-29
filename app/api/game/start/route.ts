import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { MAX_ATTEMPTS, randomDebugTargetWord, scoreGuessWords, scoreGuessWordsForTarget, todayDateKey } from "@/lib/daily-game";
import { decodeProgress, progressCookieName } from "@/lib/progress-cookie";
import { getVocabStore } from "@/lib/vocab";

const DEBUG_TARGET_COOKIE = "embeddingle_debug_target";

export async function POST() {
  try {
    const { words } = getVocabStore();
    const dateKey = todayDateKey();
    const debugMode = process.env.DEBUG_GAME === "true";
    const raw = cookies().get(progressCookieName())?.value;
    const progress = decodeProgress(raw);
    const guessWords =
      !debugMode && progress?.dateKey === dateKey
        ? progress.guesses.slice(0, MAX_ATTEMPTS)
        : [];
    const debugTarget = debugMode ? randomDebugTargetWord() : null;
    const attempts = debugTarget
      ? scoreGuessWordsForTarget(guessWords, debugTarget, dateKey)
      : scoreGuessWords(guessWords, dateKey);
    const bestScore = attempts.reduce((best, guess) => Math.max(best, guess.score), 0);
    const gameOver = attempts.length >= MAX_ATTEMPTS || attempts.some((guess) => guess.isExact);

    const response = NextResponse.json({
      attempts,
      vocabSize: words.length,
      maxAttempts: MAX_ATTEMPTS,
      bestScore,
      gameOver,
      dateKey
    });

    if (debugMode) {
      response.cookies.set({
        name: progressCookieName(),
        value: "",
        path: "/",
        maxAge: 0
      });
      response.cookies.set({
        name: DEBUG_TARGET_COOKIE,
        value: debugTarget ?? "",
        path: "/",
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        maxAge: 60 * 60 * 24
      });
    }

    return response;
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to start game"
      },
      { status: 500 }
    );
  }
}
