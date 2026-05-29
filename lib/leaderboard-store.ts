type LeaderboardInsert = {
  name: string;
  date_key: string;
  target_word: string;
  best_score: number;
  best_guess: string;
  attempts_used: number;
  solved: boolean;
};

export type LeaderboardEntry = {
  id: string;
  name: string;
  date_key: string;
  target_word: string;
  best_score: number;
  best_guess: string;
  attempts_used: number;
  solved: boolean;
  created_at: string;
};

function supabaseUrl(): string {
  const value = process.env.SUPABASE_URL;
  if (!value) {
    throw new Error("SUPABASE_URL is missing");
  }
  return value;
}

function supabaseKey(): string {
  const value = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!value) {
    throw new Error("SUPABASE_SERVICE_ROLE_KEY is missing");
  }
  return value;
}

export async function insertLeaderboardEntry(payload: LeaderboardInsert): Promise<void> {
  const response = await fetch(`${supabaseUrl()}/rest/v1/leaderboard_entries`, {
    method: "POST",
    headers: {
      apikey: supabaseKey(),
      Authorization: `Bearer ${supabaseKey()}`,
      "Content-Type": "application/json",
      Prefer: "return=minimal"
    },
    body: JSON.stringify(payload),
    cache: "no-store"
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Leaderboard insert failed: ${text}`);
  }
}

export async function listLeaderboardEntries(limit = 100): Promise<LeaderboardEntry[]> {
  const bounded = Math.max(1, Math.min(500, limit));
  const url = `${supabaseUrl()}/rest/v1/leaderboard_entries?select=id,name,date_key,target_word,best_score,best_guess,attempts_used,solved,created_at&order=date_key.desc,best_score.desc,created_at.desc&limit=${bounded}`;
  const response = await fetch(url, {
    method: "GET",
    headers: {
      apikey: supabaseKey(),
      Authorization: `Bearer ${supabaseKey()}`
    },
    cache: "no-store"
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Leaderboard list failed: ${text}`);
  }

  return (await response.json()) as LeaderboardEntry[];
}
