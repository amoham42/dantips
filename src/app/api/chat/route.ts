import { openai } from "@ai-sdk/openai";
import { streamText, UIMessage, convertToModelMessages, tool, jsonSchema } from "ai";
import { executeMedicalSearch, medicalSearchJSONSchema, type MedicalSearchParams } from "@/lib/medical-search";
import { frontendTools } from "@assistant-ui/react-ai-sdk";
import { searchRAG, upsertRAGItems } from "@/lib/rag";

interface MessageTextContent {
  type: "text";
  text: string;
}

type MessageContent = MessageTextContent | string;

interface ExtendedUIMessage extends UIMessage {
  content?: MessageContent | MessageContent[];
}

type FrontendTools = unknown;

export const maxDuration = 30;

export async function POST(req: Request) {
  const {
    messages,
    system,
    tools,
  }: {
    messages: ExtendedUIMessage[];
    system?: string;
    tools?: FrontendTools;
  } = await req.json();
  
  // Get threadId from header
  const threadId = req.headers.get("x-thread-id");

  // Index the latest user message if available and threadId is provided
  if (threadId && messages.length > 0) {
    const latestMessage = messages[messages.length - 1];
    if (latestMessage.role === "user") {
      // Extract text content from the message
      const content = Array.isArray(latestMessage.content) 
        ? latestMessage.content 
        : [latestMessage.content];
      
      const textContent = content
        .filter((part): part is MessageTextContent | string => 
          (typeof part === "object" && part?.type === "text") || typeof part === "string"
        )
        .map((part) => typeof part === "string" ? part : part.text)
        .join(" ")
        .trim();
      
      if (textContent) {
        try {
          // Index user message in background (don't await to avoid blocking response)
          upsertRAGItems({
            threadId,
            items: [{ role: "user", text: textContent }],
          }).catch(error => {
            console.error("Failed to index user message:", error);
          });
        } catch (error) {
          console.error("Error indexing user message:", error);
        }
      }
    }
  }

  // Enhanced system prompt with RAG instructions and tool usage guidance
  const enhancedSystem = `${system || "You are a helpful AI assistant."} 

IMPORTANT: When you use any tool, you must continue the conversation after executing the tool. Always provide a comprehensive response that incorporates and explains the information you obtained from the tool. Never stop generating content immediately after tool execution - the user needs to understand what the tool results mean and how they relate to their question.

You have access to RAG (Retrieval Augmented Generation) capabilities:
- Use 'searchThreadRAG' to search within the current conversation thread for relevant context only when asked
- Use 'searchGlobalRAG' to search across all conversations for broader context only when asked
- Always cite or reference the context you retrieve when it helps answer the user's question

Tool Usage Guidelines:
- When you execute a tool, immediately follow up with analysis and explanation of the results
- Synthesize tool results with your knowledge to provide comprehensive answers
- If a tool provides data, explain what the data means and its relevance to the user's query
- Continue the conversation naturally after tool use - don't just display raw tool output

Available tools: searchThreadRAG, searchGlobalRAG, searchMedicalLiterature`;

  const result = streamText({
    model: openai("gpt-4o"),
    system: enhancedSystem,
    messages: convertToModelMessages(messages),
    tools: {
      ...(tools ? frontendTools(tools as never) : {}),

      searchThreadRAG: tool({
        description: "Search only messages from the current thread using vector similarity.",
        inputSchema: jsonSchema({
          type: "object",
          properties: {
            query: { type: "string" },
            threadId: { type: "string" },
            topK: { type: "integer", default: 5 },
          },
          required: ["query", "threadId"],
        }),
        execute: async ({ query, threadId, topK }: { query: string; threadId: string; topK?: number }) => {
          return searchRAG({ query, threadId, topK });
        },
      }),

      searchGlobalRAG: tool({
        description: "Search across all threads using vector similarity.",
        inputSchema: jsonSchema({
          type: "object",
          properties: {
            query: { type: "string" },
            topK: { type: "integer", default: 5 },
          },
          required: ["query"],
        }),
        execute: async ({ query, topK }: { query: string; topK?: number }) => {
          return searchRAG({ query, topK });
        },
      }),

      searchMedicalLiterature: tool({
        description: "Fetch relevant PubMed articles for a medical topic using NCBI Entrez E-utilities.",
        inputSchema: jsonSchema(medicalSearchJSONSchema),
        execute: async (args: MedicalSearchParams) => {
          return executeMedicalSearch(args);
        },
      }),
    },
  });

  return result.toUIMessageStreamResponse();
}


