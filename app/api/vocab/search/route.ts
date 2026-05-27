import { NextRequest, NextResponse } from "next/server";
import { searchVocabulary } from "@/lib/vocab-search";

type SearchRequest = {
  query?: string;
  limit?: number;
};

export async function POST(request: NextRequest) {
  let payload: SearchRequest;
  try {
    payload = (await request.json()) as SearchRequest;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const query = payload.query?.trim() ?? "";
  const limit = typeof payload.limit === "number" ? payload.limit : 12;

  const suggestions = searchVocabulary(query, limit);
  return NextResponse.json({ suggestions });
}
