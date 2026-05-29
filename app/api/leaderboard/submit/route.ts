import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { MAX_ATTEMPTS, getRevealData, scoreGuessWords, scoreGuessWordsForTarget, todayDateKey } from "@/lib/daily-game";
import { decodeProgress, progressCookieName } from "@/lib/progress-cookie";
import { insertLeaderboardEntry } from "@/lib/leaderboard-store";

const DEBUG_TARGET_COOKIE = "embeddingle_debug_target";

type SubmitRequest = {
  name?: string;
};

export async function POST(request: NextRequest) {
  let payload: SubmitRequest;
  try {
    payload = (await request.json()) as SubmitRequest;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const name = payload.name?.trim();
  if (!name) {
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  }
  if (name.length > 32) {
    return NextResponse.json({ error: "name must be 32 characters or fewer" }, { status: 400 });
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

  const completed = attempts.length >= MAX_ATTEMPTS || attempts.some((attempt) => attempt.isExact);
  if (!completed) {
    return NextResponse.json({ error: "Complete today's puzzle before submitting" }, { status: 409 });
  }

  const best = attempts.reduce((acc, cur) => (cur.score > acc.score ? cur : acc), attempts[0]);
  const solved = attempts.some((attempt) => attempt.isExact);
  const reveal = getRevealData(dateKey, debugTarget);

  try {
    await insertLeaderboardEntry({
      name,
      date_key: dateKey,
      target_word: reveal.targetWord,
      best_score: best.score,
      best_guess: best.guess,
      attempts_used: attempts.length,
      solved
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to submit leaderboard entry"
      },
      { status: 500 }
    );
  }
}
