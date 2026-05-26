#!/usr/bin/env python3
"""Build a noun-focused vocabulary list from common English words.

Usage:
  python scripts/build-vocab.py --size 5000 --out data/vocab.txt
"""

from __future__ import annotations

import argparse
import re
from pathlib import Path


BLOCKLIST = {
    "fuck",
    "fucking",
    "shit",
    "bitch",
    "bastard",
    "asshole",
    "nigger",
    "nigga",
    "cunt",
    "whore",
    "slut",
    "porn",
    "pornography",
    "sex",
    "sexy",
}

STOPWORDS = {
    "the",
    "a",
    "an",
    "and",
    "or",
    "but",
    "if",
    "then",
    "than",
    "to",
    "of",
    "in",
    "on",
    "at",
    "for",
    "by",
    "from",
    "with",
    "without",
    "as",
    "is",
    "are",
    "was",
    "were",
    "be",
    "been",
    "being",
    "do",
    "does",
    "did",
    "doing",
    "have",
    "has",
    "had",
    "having",
    "i",
    "you",
    "he",
    "she",
    "it",
    "we",
    "they",
    "me",
    "him",
    "her",
    "them",
    "my",
    "your",
    "his",
    "their",
    "our",
    "this",
    "that",
    "these",
    "those",
    "who",
    "what",
    "when",
    "where",
    "why",
    "how",
    "not",
    "no",
    "yes",
    "can",
    "could",
    "would",
    "should",
    "may",
    "might",
    "must",
    "will",
    "shall",
    "also",
    "very",
    "just",
    "only",
    "even",
    "too",
    "so",
    "its",
    "someone",
    "anyone",
    "everyone",
    "everything",
    "nothing",
    "something",
    "while",
}

PROPER_NOUN_LIKE = {
    "january",
    "february",
    "march",
    "april",
    "may",
    "june",
    "july",
    "august",
    "september",
    "october",
    "november",
    "december",
}


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--size", type=int, default=5000)
    parser.add_argument("--out", default="data/vocab.txt")
    parser.add_argument("--extra-pool", type=int, default=120000)
    parser.add_argument("--strict-nouns", action="store_true", default=True)
    parser.add_argument("--allow-plurals", action="store_true", default=False)
    parser.add_argument("--report", default="data/vocab.report.txt")
    return parser.parse_args()


def has_noun_only_senses(word: str, wn: object) -> bool:
    synsets = wn.synsets(word)
    if not synsets:
        return False

    noun_count = sum(1 for synset in synsets if synset.pos() == "n")
    if noun_count == 0:
        return False

    common_noun_count = sum(
        1
        for synset in synsets
        if synset.pos() == "n"
        and not synset.instance_hypernyms()
        and word in synset.lemma_names()
    )
    if common_noun_count == 0:
        return False

    has_instance_sense = any(
        synset.pos() == "n" and synset.instance_hypernyms() for synset in synsets
    )
    if has_instance_sense:
        return False

    non_noun_count = len(synsets) - noun_count
    return non_noun_count == 0


def has_any_noun_sense(word: str, wn: object) -> bool:
    return any(synset.pos() == "n" for synset in wn.synsets(word))


def main() -> None:
    args = parse_args()
    try:
        from wordfreq import top_n_list
    except ImportError as exc:
        raise SystemExit("Install dependencies first: pip install wordfreq") from exc

    try:
        import nltk
        from nltk.corpus import wordnet as wn
    except ImportError as exc:
        raise SystemExit("Install dependencies first: pip install nltk") from exc

    try:
        wn.synsets("dog")
    except LookupError:
        nltk.download("wordnet", quiet=True)
        wn.synsets("dog")

    pattern = re.compile(r"^[a-z]{3,14}$")
    candidates = top_n_list("en", args.extra_pool)

    cleaned: list[str] = []
    seen: set[str] = set()
    removed_counts = {
        "duplicate": 0,
        "pattern": 0,
        "stop_or_block": 0,
        "suffix": 0,
        "plural": 0,
        "not_noun": 0,
    }

    for raw_word in candidates:
        word = raw_word.lower().strip()
        if word in seen:
            removed_counts["duplicate"] += 1
            continue
        if not pattern.fullmatch(word):
            removed_counts["pattern"] += 1
            continue
        if word in STOPWORDS or word in BLOCKLIST:
            removed_counts["stop_or_block"] += 1
            continue
        if word in PROPER_NOUN_LIKE:
            removed_counts["stop_or_block"] += 1
            continue
        if word.endswith("ly") or word.endswith("ing") or word.endswith("ed"):
            removed_counts["suffix"] += 1
            continue
        if not args.allow_plurals and word.endswith("s") and len(word) >= 4:
            removed_counts["plural"] += 1
            continue

        is_noun = (
            has_noun_only_senses(word, wn)
            if args.strict_nouns
            else has_any_noun_sense(word, wn)
        )
        if not is_noun:
            removed_counts["not_noun"] += 1
            continue

        cleaned.append(word)
        seen.add(word)
        if len(cleaned) >= args.size:
            break

    if len(cleaned) < args.size:
        raise SystemExit(
            f"Could only produce {len(cleaned)} words. Increase --extra-pool."
        )

    out_path = Path(args.out)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text("\n".join(cleaned) + "\n", encoding="utf-8")

    report_lines = [
        f"size={len(cleaned)}",
        f"strict_nouns={args.strict_nouns}",
        f"allow_plurals={args.allow_plurals}",
        f"extra_pool={args.extra_pool}",
        "removed_counts:",
    ]
    report_lines.extend(
        [f"  {reason}: {count}" for reason, count in removed_counts.items()]
    )
    report_lines.append("preview:")
    report_lines.extend([f"  {word}" for word in cleaned[:100]])
    report_path = Path(args.report)
    report_path.parent.mkdir(parents=True, exist_ok=True)
    report_path.write_text("\n".join(report_lines) + "\n", encoding="utf-8")

    print(f"Wrote {len(cleaned)} words to {out_path}")
    print(f"Wrote report to {report_path}")


if __name__ == "__main__":
    main()
