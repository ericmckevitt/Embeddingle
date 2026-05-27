import { NextRequest, NextResponse } from "next/server";
import { MAX_ATTEMPTS, getSession, scoreGuess } from "@/lib/session";
import { getVector } from "@/lib/vocab";

type GuessRequest = {
  sessionId?: string;
  guess?: string;
};

export async function POST(request: NextRequest) {
  let payload: GuessRequest;
  try {
    payload = (await request.json()) as GuessRequest;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const sessionId = payload.sessionId?.trim();
  const guess = payload.guess?.trim().toLowerCase();

  if (!sessionId || !guess) {
    return NextResponse.json({ error: "sessionId and guess are required" }, { status: 400 });
  }

  const session = getSession(sessionId);
  if (!session) {
    return NextResponse.json({ error: "Session not found or expired" }, { status: 404 });
  }

  if (!getVector(guess)) {
    return NextResponse.json(
      { error: "Guess must be in allowed vocabulary" },
      { status: 400 }
    );
  }

  if (session.guesses.length >= MAX_ATTEMPTS) {
    const bestScore = session.guesses.reduce(
      (best, attempt) => Math.max(best, attempt.score),
      0
    );
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
    const result = scoreGuess(session, guess);
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unable to score guess"
      },
      { status: 500 }
    );
  }
}
