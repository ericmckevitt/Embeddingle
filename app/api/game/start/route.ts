import { NextResponse } from "next/server";
import { MAX_ATTEMPTS, createSession } from "@/lib/session";
import { getVocabStore } from "@/lib/vocab";

export async function POST() {
  try {
    const session = createSession();
    const { words } = getVocabStore();
    return NextResponse.json({
      sessionId: session.id,
      attempts: [],
      vocabSize: words.length,
      maxAttempts: MAX_ATTEMPTS
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
