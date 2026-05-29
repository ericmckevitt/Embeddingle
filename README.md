# Embeddingle (PoC)

Proof of concept for embedding-based semantic guessing game, inspired by Wordle.

## Quick start

1. Install dependencies:

```bash
npm install
```

2. Run dev server:

```bash
npm run dev
```

3. Open http://localhost:3000

## Daily puzzle behavior

The hidden word is deterministic per UTC day, so all users see the same target each day.

For production, set these environment variables:

```bash
DAILY_SEED_SECRET=replace-with-random-secret
COOKIE_SIGNING_SECRET=replace-with-random-secret
SUPABASE_URL=https://your-project-ref.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-secret
```

## Offline embedding generation

Create a Python environment and install dependencies:

```bash
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

Build a cleaned 5k vocabulary:

```bash
python scripts/build-vocab.py --size 5000 --out data/vocab.txt --strict-nouns
```

This writes a build report to `data/vocab.report.txt`.

```bash
python scripts/build-embeddings.py --vocab data/vocab.txt --out data/embeddings.jsonl
```

This also writes metadata to `data/embeddings.meta.json`.

## Scoring sanity check

```bash
python scripts/eval-scoring.py --target laptop
```
