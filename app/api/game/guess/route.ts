import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { MAX_ATTEMPTS, scoreGuessWords, todayDateKey } from "@/lib/daily-game";
import { decodeProgress, encodeProgress, progressCookieName } from "@/lib/progress-cookie";
import { getVector } from "@/lib/vocab";

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
  const raw = cookies().get(progressCookieName())?.value;
  const progress = decodeProgress(raw);
  const guessWords = progress?.dateKey === dateKey ? progress.guesses.slice(0, MAX_ATTEMPTS) : [];
  const attempts = scoreGuessWords(guessWords, dateKey);
  const alreadyOver = attempts.length >= MAX_ATTEMPTS || attempts.some((attempt) => attempt.isExact);

  if (alreadyOver) {
    const bestScore = attempts.reduce((best, attempt) => Math.max(best, attempt.score), 0);
    return NextResponse.json(
      {
        error: `No attempts remaining. Best score: ${bestScore.toFixed(1)}`,
        gameOver: true,
        bestScore
      },
      { status: 409 }
    );
  }

  try {
    const nextGuessWords = [...guessWords, guess].slice(0, MAX_ATTEMPTS);
    const nextAttempts = scoreGuessWords(nextGuessWords, dateKey);
    const result = nextAttempts[nextAttempts.length - 1];

    const response = NextResponse.json(result);
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
