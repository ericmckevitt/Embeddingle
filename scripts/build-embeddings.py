#!/usr/bin/env python3
"""Build embeddings.jsonl from a vocabulary file.

Usage:
  python scripts/build-embeddings.py
  python scripts/build-embeddings.py --vocab data/vocab.txt --out data/embeddings.jsonl
"""

from __future__ import annotations

import argparse
import hashlib
import json
from datetime import datetime, timezone
from pathlib import Path


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--vocab", default="data/vocab.txt")
    parser.add_argument("--out", default="data/embeddings.jsonl")
    parser.add_argument("--meta", default="data/embeddings.meta.json")
    parser.add_argument(
        "--model", default="sentence-transformers/all-MiniLM-L6-v2"
    )
    parser.add_argument("--batch-size", type=int, default=256)
    return parser.parse_args()


def main() -> None:
    args = parse_args()

    try:
        from sentence_transformers import SentenceTransformer
    except ImportError as exc:
        raise SystemExit(
            "Install dependencies first: pip install sentence-transformers"
        ) from exc

    vocab_path = Path(args.vocab)
    out_path = Path(args.out)
    meta_path = Path(args.meta)

    words = [
        line.strip().lower()
        for line in vocab_path.read_text(encoding="utf-8").splitlines()
        if line.strip()
    ]

    unique_words = list(dict.fromkeys(words))
    if len(unique_words) != len(words):
        print(f"Removed {len(words) - len(unique_words)} duplicate entries from vocab")
        words = unique_words

    model = SentenceTransformer(args.model)
    vectors = model.encode(
        words,
        normalize_embeddings=True,
        batch_size=args.batch_size,
        show_progress_bar=True,
    )

    out_path.parent.mkdir(parents=True, exist_ok=True)
    with out_path.open("w", encoding="utf-8") as handle:
        for word, vec in zip(words, vectors):
            payload = {"word": word, "embedding": [float(x) for x in vec]}
            handle.write(json.dumps(payload) + "\n")

    vocab_hash = hashlib.sha256(
        "\n".join(words).encode("utf-8")
    ).hexdigest()
    metadata = {
        "generated_at_utc": datetime.now(timezone.utc).isoformat(),
        "model": args.model,
        "rows": len(words),
        "dimensions": int(vectors.shape[1]),
        "normalized": True,
        "vocab_path": str(vocab_path),
        "vocab_sha256": vocab_hash,
        "batch_size": args.batch_size,
    }
    meta_path.parent.mkdir(parents=True, exist_ok=True)
    meta_path.write_text(json.dumps(metadata, indent=2) + "\n", encoding="utf-8")

    print(f"Wrote {len(words)} rows to {out_path}")
    print(f"Wrote metadata to {meta_path}")


if __name__ == "__main__":
    main()
