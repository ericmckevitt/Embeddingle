#!/usr/bin/env python3
"""Quick scoring sanity checks for a chosen target word."""

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


def display_score(similarity: float) -> float:
    clamped = max(0.0, min(1.0, similarity))
    return (1 / (1 + math.exp(-10 * (clamped - 0.3)))) * 100


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--data", default="data/embeddings.jsonl")
    parser.add_argument("--target", required=True)
    parser.add_argument("--top", type=int, default=10)
    args = parser.parse_args()

    rows = []
    for line in Path(args.data).read_text().splitlines():
        if line.strip():
            rows.append(json.loads(line))

    by_word = {row["word"]: row["embedding"] for row in rows}
    target = args.target.lower()
    if target not in by_word:
        raise SystemExit(f"Target '{target}' not found in data file")

    target_vec = by_word[target]
    scored = []
    for word, vec in by_word.items():
        sim = cosine(target_vec, vec)
        scored.append((word, sim))

    scored.sort(key=lambda pair: pair[1], reverse=True)
    total = len(scored)
    print(f"Target: {target} (vocab={total})")
    for rank, (word, sim) in enumerate(scored[: args.top], start=1):
        score = display_score(sim)
        print(f"#{rank:>3} {word:<20} sim={sim:0.4f} score={score:0.1f}")


if __name__ == "__main__":
    main()
