#!/usr/bin/env python3
"""Compare a target word and guess word using local embeddings.

Outputs:
- cosine similarity
- rank of guess among all words vs target (1 = exact closest)
- display score in current game scale (cosine-based, nonlinear)

Usage:
  python scripts/compare-words.py --target petrochemical --guess dessert
"""

from __future__ import annotations

import argparse
import json
import math
from pathlib import Path


def cosine(a: list[float], b: list[float]) -> float:
    dot = sum(x * y for x, y in zip(a, b))
    na = math.sqrt(sum(x * x for x in a))
    nb = math.sqrt(sum(y * y for y in b))
    if na == 0 or nb == 0:
        return 0.0
    return dot / (na * nb)


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--target", required=True)
    parser.add_argument("--guess", required=True)
    parser.add_argument("--data", default="data/embeddings.jsonl")
    return parser.parse_args()


def display_score(similarity: float) -> float:
    clamped = max(0.0, min(1.0, similarity))
    return (1 / (1 + math.exp(-10 * (clamped - 0.3)))) * 100


def main() -> None:
    args = parse_args()
    rows = []
    for line in Path(args.data).read_text(encoding="utf-8").splitlines():
        if line.strip():
            rows.append(json.loads(line))

    vectors = {row["word"].lower(): row["embedding"] for row in rows}
    target = args.target.lower().strip()
    guess = args.guess.lower().strip()

    if target not in vectors:
        raise SystemExit(f"Target '{target}' not found in embeddings data")
    if guess not in vectors:
        raise SystemExit(f"Guess '{guess}' not found in embeddings data")

    target_vec = vectors[target]
    guess_vec = vectors[guess]
    similarity = cosine(target_vec, guess_vec)

    scored = []
    for word, vec in vectors.items():
        scored.append((word, cosine(target_vec, vec)))
    scored.sort(key=lambda item: item[1], reverse=True)

    rank = 1
    for index, (word, _) in enumerate(scored, start=1):
        if word == guess:
            rank = index
            break

    total = len(scored)
    score = display_score(similarity)

    print(f"target:      {target}")
    print(f"guess:       {guess}")
    print(f"similarity:  {similarity:.6f}")
    print(f"score:       {score:.3f}")
    print(f"rank:        #{rank} of {total}")


if __name__ == "__main__":
    main()
