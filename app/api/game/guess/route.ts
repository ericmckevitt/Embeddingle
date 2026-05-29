import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { MAX_ATTEMPTS, getRevealData, scoreGuessWords, scoreGuessWordsForTarget, todayDateKey } from "@/lib/daily-game";
import { decodeProgress, encodeProgress, progressCookieName } from "@/lib/progress-cookie";
import { getVector } from "@/lib/vocab";

const DEBUG_TARGET_COOKIE = "embeddingle_debug_target";

type GuessRequest = {
  guess?: string;
};

export async function POST(request: NextRequest) {
  let payload: GuessRequest;
  try {
    payload = (await request.json()) as GuessRequest;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const guess = payload.guess?.trim().toLowerCase();

  if (!guess) {
    return NextResponse.json({ error: "guess is required" }, { status: 400 });
  }

  if (!getVector(guess)) {
    return NextResponse.json(
      { error: "Guess must be in allowed vocabulary" },
      { status: 400 }
    );
  }

  const dateKey = todayDateKey();
  const debugMode = process.env.DEBUG_GAME === "true";
  const debugTarget = debugMode ? cookies().get(DEBUG_TARGET_COOKIE)?.value : undefined;
  const raw = cookies().get(progressCookieName())?.value;
  const progress = decodeProgress(raw);
  const guessWords = progress?.dateKey === dateKey ? progress.guesses.slice(0, MAX_ATTEMPTS) : [];
  const attempts = debugTarget
    ? scoreGuessWordsForTarget(guessWords, debugTarget, dateKey)
    : scoreGuessWords(guessWords, dateKey);
  const alreadyOver = attempts.length >= MAX_ATTEMPTS || attempts.some((attempt) => attempt.isExact);

  if (alreadyOver) {
    const bestScore = attempts.reduce((best, attempt) => Math.max(best, attempt.score), 0);
    const solved = attempts.some((attempt) => attempt.isExact);
    const reveal = !solved ? getRevealData(dateKey, debugTarget) : null;
    return NextResponse.json(
      {
        error: `No attempts remaining. Best score: ${bestScore.toFixed(1)}`,
        gameOver: true,
        bestScore,
        revealWord: reveal?.targetWord ?? null,
        topSimilarWords: reveal?.topSimilarWords ?? []
      },
      { status: 409 }
    );
  }

  try {
    const nextGuessWords = [...guessWords, guess].slice(0, MAX_ATTEMPTS);
    const nextAttempts = debugTarget
      ? scoreGuessWordsForTarget(nextGuessWords, debugTarget, dateKey)
      : scoreGuessWords(nextGuessWords, dateKey);
    const result = nextAttempts[nextAttempts.length - 1];
    const reveal = result.gameOver && !result.isExact ? getRevealData(dateKey, debugTarget) : null;

    const response = NextResponse.json({
      ...result,
      revealWord: reveal?.targetWord ?? null,
      topSimilarWords: reveal?.topSimilarWords ?? []
    });
    response.cookies.set({
      name: progressCookieName(),
      value: encodeProgress({ dateKey, guesses: nextGuessWords }),
      path: "/",
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 60 * 60 * 24 * 45
    });
    return response;
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unable to score guess"
      },
      { status: 500 }
    );
  }
}
