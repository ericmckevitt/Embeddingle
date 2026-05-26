import { randomUUID } from "node:crypto";
import { buildSimilarityDistribution, cosineSimilarity, percentileFromRank, rankFromDistribution } from "@/lib/similarity";
import { GuessResult, Session } from "@/lib/types";
import { getVector, randomTargetWord } from "@/lib/vocab";

const SESSION_TTL_MS = 1000 * 60 * 60 * 6;

declare global {
  var __embeddingleSessions: Map<string, Session> | undefined;
}

const sessions = globalThis.__embeddingleSessions ?? new Map<string, Session>();
globalThis.__embeddingleSessions = sessions;

function cleanupSessions(): void {
  const now = Date.now();
  for (const [id, session] of sessions.entries()) {
    if (now - session.createdAt > SESSION_TTL_MS) {
      sessions.delete(id);
    }
  }
}

export function createSession(): Session {
  cleanupSessions();

  const targetWord = randomTargetWord();
  const targetVector = getVector(targetWord);
  if (!targetVector) {
    throw new Error("Target vector missing");
  }

  const session: Session = {
    id: randomUUID(),
    targetWord,
    targetVector,
    sortedSimilarities: buildSimilarityDistribution(targetVector),
    guesses: [],
    createdAt: Date.now()
  };

  sessions.set(session.id, session);

  if (process.env.DEBUG_GAME === "true") {
    console.log(`[DEBUG_GAME] session=${session.id} target=${session.targetWord}`);
  }

  return session;
}

export function getSession(sessionId: string): Session | undefined {
  cleanupSessions();
  return sessions.get(sessionId);
}

export function scoreGuess(session: Session, guessWord: string): GuessResult {
  const guessVector = getVector(guessWord);
  if (!guessVector) {
    throw new Error("Guess not in vocabulary");
  }

  const similarity = cosineSimilarity(session.targetVector, guessVector);
  const rank = rankFromDistribution(session.sortedSimilarities, similarity);
  const score = percentileFromRank(rank, session.sortedSimilarities.length);
  const isExact = guessWord === session.targetWord;

  const result: GuessResult = {
    guess: guessWord,
    score,
    rank,
    isExact,
    attemptsUsed: session.guesses.length + 1
  };

  session.guesses.push(result);
  return result;
}
