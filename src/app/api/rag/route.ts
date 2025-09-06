import { NextResponse } from "next/server";
import { upsertRAGItems } from "@/lib/rag";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { threadId, items } = body as {
      threadId?: string;
      items: Array<{ id?: string; role?: "user" | "assistant"; text: string }>;
    };
    
    if (!items?.length) {
      console.log("RAG API: No items provided");
      return NextResponse.json({ count: 0 });
    }

    console.log(`RAG API: Indexing ${items.length} items for thread ${threadId || 'global'}`);
    const result = await upsertRAGItems({ threadId, items });
    console.log(`RAG API: Successfully indexed ${result.count} items`);
    
    return NextResponse.json(result);
  } catch (error) {
    console.error("RAG API: Error processing request:", error);
    return NextResponse.json(
      { error: "Failed to index items", count: 0 }, 
      { status: 500 }
    );
  }
}


