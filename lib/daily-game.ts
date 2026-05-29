import { createHash } from "node:crypto";
import { buildSimilarityDistribution, cosineSimilarity, rankFromDistribution, scoreFromCosine } from "@/lib/similarity";
import { GuessResult } from "@/lib/types";
import { getVector, getVocabStore, randomTargetWord } from "@/lib/vocab";

export const MAX_ATTEMPTS = 6;

type DailyContext = {
  dateKey: string;
  targetWord: string;
  targetVector: number[];
  sortedSimilarities: number[];
};

declare global {
  var __embeddingleDailyContexts: Map<string, DailyContext> | undefined;
}

const contextCache = globalThis.__embeddingleDailyContexts ?? new Map<string, DailyContext>();
globalThis.__embeddingleDailyContexts = contextCache;

function utcDateKey(now = new Date()): string {
  return now.toISOString().slice(0, 10);
}

function dailySeedSecret(): string {
  return process.env.DAILY_SEED_SECRET ?? "embeddingle-dev-secret";
}

function pickTargetWordForDate(dateKey: string): string {
  const { words } = getVocabStore();
  const digest = createHash("sha256")
    .update(`${dateKey}:${dailySeedSecret()}`)
    .digest("hex");
  const asInt = Number.parseInt(digest.slice(0, 12), 16);
  return words[asInt % words.length];
}

export function getDailyContext(dateKey = utcDateKey(), targetOverride?: string): DailyContext {
  const cacheKey = targetOverride ? `${dateKey}:${targetOverride}` : dateKey;
  const cached = contextCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  const targetWord = targetOverride ?? pickTargetWordForDate(dateKey);
  const targetVector = getVector(targetWord);
  if (!targetVector) {
    throw new Error("Target vector missing");
  }

  const context: DailyContext = {
    dateKey,
    targetWord,
    targetVector,
    sortedSimilarities: buildSimilarityDistribution(targetVector)
  };
  contextCache.set(cacheKey, context);

  if (process.env.DEBUG_GAME === "true") {
    console.log(`[DEBUG_GAME] date=${dateKey} target=${targetWord}`);
  }

  return context;
}

export function scoreGuessWords(guessWords: string[], dateKey = utcDateKey()): GuessResult[] {
  const context = getDailyContext(dateKey);
  const results: GuessResult[] = [];
  let bestScore = 0;

  for (let i = 0; i < guessWords.length; i += 1) {
    const guessWord = guessWords[i];
    const guessVector = getVector(guessWord);
    if (!guessVector) {
      continue;
    }

    const similarity = cosineSimilarity(context.targetVector, guessVector);
    const rank = rankFromDistribution(context.sortedSimilarities, similarity);
    const score = scoreFromCosine(similarity);
    bestScore = Math.max(bestScore, score);

    const attemptsUsed = i + 1;
    const attemptsRemaining = Math.max(0, MAX_ATTEMPTS - attemptsUsed);
    const isExact = guessWord === context.targetWord;
    const gameOver = isExact || attemptsRemaining === 0;

    results.push({
      guess: guessWord,
      score,
      rank,
      isExact,
      attemptsUsed,
      attemptsRemaining,
      gameOver,
      bestScore
    });

    if (isExact) {
      break;
    }
  }

  return results;
}

export function scoreGuessWordsForTarget(
  guessWords: string[],
  targetWord: string,
  dateKey = utcDateKey()
): GuessResult[] {
  const context = getDailyContext(dateKey, targetWord);
  const results: GuessResult[] = [];
  let bestScore = 0;

  for (let i = 0; i < guessWords.length; i += 1) {
    const guessWord = guessWords[i];
    const guessVector = getVector(guessWord);
    if (!guessVector) {
      continue;
    }

    const similarity = cosineSimilarity(context.targetVector, guessVector);
    const rank = rankFromDistribution(context.sortedSimilarities, similarity);
    const score = scoreFromCosine(similarity);
    bestScore = Math.max(bestScore, score);

    const attemptsUsed = i + 1;
    const attemptsRemaining = Math.max(0, MAX_ATTEMPTS - attemptsUsed);
    const isExact = guessWord === context.targetWord;
    const gameOver = isExact || attemptsRemaining === 0;

    results.push({
      guess: guessWord,
      score,
      rank,
      isExact,
      attemptsUsed,
      attemptsRemaining,
      gameOver,
      bestScore
    });

    if (isExact) {
      break;
    }
  }

  return results;
}

export function randomDebugTargetWord(): string {
  return randomTargetWord();
}

export function todayDateKey(): string {
  return utcDateKey();
}
