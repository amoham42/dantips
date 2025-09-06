import { embed } from "ai";
import { openai } from "@ai-sdk/openai";
import { randomUUID } from "crypto";

type RAGDoc = {
  id: string;
  threadId?: string;
  role?: "user" | "assistant";
  text: string;
  embedding: number[];
  createdAt: number;
};

const EMBEDDING_MODEL = openai.embedding("text-embedding-3-small");

// In-memory index (per server instance)
const INDEX: RAGDoc[] = [];

function cosine(a: number[], b: number[]) {
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  return dot / (Math.sqrt(na) * Math.sqrt(nb) + 1e-8);
}

export async function upsertRAGItems(params: {
  threadId?: string;
  items: Array<{ id?: string; role?: "user" | "assistant"; text: string }>;
}) {
  try {
    const texts = params.items.map((i) => i.text).filter(text => text.trim().length > 0);
    if (texts.length === 0) {
      console.log("RAG: No valid texts to index");
      return { count: 0 };
    }

    console.log(`RAG: Indexing ${texts.length} messages for thread ${params.threadId || 'global'}`);

    // Use batch embedding for efficiency
    const embeddings = await Promise.all(
      texts.map(async (text) => {
        const result = await embed({
          model: EMBEDDING_MODEL,
          value: text,
        });
        return result.embedding;
      })
    );

    const now = Date.now();
    let addedCount = 0;
    
    embeddings.forEach((vec, i) => {
      const item = params.items[i];
      if (item.text.trim().length > 0) {
        INDEX.push({
          id: item.id || randomUUID(),
          threadId: params.threadId,
          role: item.role,
          text: item.text,
          embedding: vec,
          createdAt: now,
        });
        addedCount++;
      }
    });

    console.log(`RAG: Successfully indexed ${addedCount} messages. Total index size: ${INDEX.length}`);
    return { count: addedCount };
  } catch (error) {
    console.error("RAG: Error in upsertRAGItems:", error);
    throw error;
  }
}

export async function searchRAG(params: {
  query: string;
  threadId?: string; // omit for global
  topK?: number;
}) {
  try {
    console.log(`RAG: Searching for "${params.query}" in ${params.threadId ? 'thread ' + params.threadId : 'global context'}`);
    
    const result = await embed({
      model: EMBEDDING_MODEL,
      value: params.query,
    });
    const q = result.embedding;
    const pool = params.threadId
      ? INDEX.filter((d) => d.threadId === params.threadId)
      : INDEX;

    console.log(`RAG: Search pool size: ${pool.length} documents`);

    if (pool.length === 0) {
      console.log("RAG: No documents found in search pool");
      return { results: [] };
    }

    const ranked = pool
      .map((d) => ({ doc: d, score: cosine(q, d.embedding) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, Math.max(1, params.topK ?? 5))
      .map(({ doc, score }) => ({
        id: doc.id,
        threadId: doc.threadId,
        role: doc.role,
        text: doc.text,
        score,
      }));

    console.log(`RAG: Found ${ranked.length} results with scores:`, ranked.map(r => `${r.score.toFixed(3)}`).join(', '));
    return { results: ranked };
  } catch (error) {
    console.error("RAG: Error in searchRAG:", error);
    throw error;
  }
}