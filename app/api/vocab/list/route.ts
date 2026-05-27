import { NextResponse } from "next/server";
import { getVocabStore } from "@/lib/vocab";

export async function GET() {
  try {
    const { words } = getVocabStore();
    return NextResponse.json({ words });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Failed to load vocabulary"
      },
      { status: 500 }
    );
  }
}
