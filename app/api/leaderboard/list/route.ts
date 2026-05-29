import { NextRequest, NextResponse } from "next/server";
import { listLeaderboardEntries } from "@/lib/leaderboard-store";

export async function GET(request: NextRequest) {
  const limitParam = request.nextUrl.searchParams.get("limit");
  const limit = limitParam ? Number.parseInt(limitParam, 10) : 100;

  try {
    const entries = await listLeaderboardEntries(limit);
    return NextResponse.json({ entries });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to load leaderboard"
      },
      { status: 500 }
    );
  }
}
