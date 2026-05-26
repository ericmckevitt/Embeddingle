import { getVocabStore } from "@/lib/vocab";

function dot(a: number[], b: number[]): number {
  let total = 0;
  for (let i = 0; i < a.length; i += 1) {
    total += a[i] * b[i];
  }
  return total;
}

function norm(a: number[]): number {
  return Math.sqrt(dot(a, a));
}

export function cosineSimilarity(a: number[], b: number[]): number {
  const denominator = norm(a) * norm(b);
  if (denominator === 0) {
    return 0;
  }
  return dot(a, b) / denominator;
}

export function buildSimilarityDistribution(targetVector: number[]): number[] {
  const { words, vectorsByWord } = getVocabStore();
  const sims = words.map((word) => cosineSimilarity(targetVector, vectorsByWord.get(word)!));
  sims.sort((x, y) => y - x);
  return sims;
}

export function rankFromDistribution(sortedSimilarities: number[], similarity: number): number {
  let left = 0;
  let right = sortedSimilarities.length;

  while (left < right) {
    const mid = Math.floor((left + right) / 2);
    if (sortedSimilarities[mid] > similarity) {
      left = mid + 1;
    } else {
      right = mid;
    }
  }

  return left + 1;
}

export function percentileFromRank(rank: number, total: number): number {
  if (total <= 1) {
    return 100;
  }
  const lowerCount = total - rank;
  return (lowerCount / (total - 1)) * 100;
}
