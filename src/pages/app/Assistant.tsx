"use client";

import { AssistantRuntimeProvider, CompositeAttachmentAdapter, SimpleImageAttachmentAdapter, SimpleTextAttachmentAdapter, ThreadListPrimitive } from "@assistant-ui/react";
import { AssistantChatTransport, useChatRuntime } from "@assistant-ui/react-ai-sdk";
import { Thread } from "@/components/assistant-ui/thread";
import { makeShortTitle, setStoredTitle } from "@/lib/thread-titles";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { AppSidebar } from "@/components/app-sidebar";
import { Separator } from "@/components/ui/separator";
import { Button } from "@/components/ui/button";
import { Searchbar } from "@/components/ui/searchbar";
import { PlusIcon, SearchIcon } from "lucide-react";
import { useState } from "react";
import { VisionImageAdapter } from "@/components/assistant-ui/custom_attachments/VisionImageAdapter";
import { PDFAttachmentAdapter } from "@/components/assistant-ui/custom_attachments/PDFAttachmentAdapter";


const attachmentsAdapter = new CompositeAttachmentAdapter([
  new VisionImageAdapter(),
  new SimpleImageAttachmentAdapter(),
  new SimpleTextAttachmentAdapter(),
  new PDFAttachmentAdapter(),
]);

// Define types for message parts
interface MessageTextPart {
  type: "text";
  text: string;
}

interface Message {
  parts?: MessageTextPart[];
  [key: string]: unknown;
}

export function Assistant() {
  const [searchOpen, setSearchOpen] = useState(false);
  
  // Use a simpler approach without circular reference
  let runtimeInstance: ReturnType<typeof useChatRuntime> | null = null;
  
  const runtime = useChatRuntime({
    transport: new AssistantChatTransport({
      api: "/api/chat",
      headers: (): Record<string, string> => {
        try {
          const threadId: string | undefined = runtimeInstance?.threads?.mainItem?.getState()?.id;
          return threadId ? { "x-thread-id": threadId } : {};
        } catch {
          return {};
        }
      },
    }),
    adapters: {
      attachments: attachmentsAdapter,
    },
   
    onFinish: ({ message, isAbort, isDisconnect, isError }) => {
      if (isAbort || isDisconnect || isError) return;

      const parts: MessageTextPart[] = (message as unknown as Message)?.parts ?? [];
      const fullText = parts
        .filter((p): p is MessageTextPart => p && p.type === "text" && typeof p.text === "string")
        .map((p) => p.text)
        .join(" ")
        .trim();

      if (!fullText) return;

      const title = makeShortTitle(fullText, 48);

      const threadItem = runtime.threads.mainItem;
      threadItem.initialize()
        .then(() => threadItem.rename(title))
        .catch(() => {})
        .finally(async () => {
          const threadId = threadItem.getState().id;
          if (threadId) setStoredTitle(threadId, title);
          
          // Index assistant reply into RAG (per-thread and contributes to global)
          if (threadId && fullText) {
            try {
              await fetch("/api/rag", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  threadId,
                  items: [{ role: "assistant", text: fullText }],
                }),
              });
            } catch {}
          }
        });
    },
  });
  
  // Set the runtime instance for header access
  runtimeInstance = runtime;

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <SidebarProvider>
        <div className="flex h-dvh w-full pr-0.5">
          <AppSidebar />
          <SidebarInset>
            <header className="flex h-12 shrink-0 items-center gap-2 border-b px-2">
              <SidebarTrigger />
              <Separator orientation="vertical" className="h-4" />  
              <Button 
                className="size-7" 
                variant="ghost" 
                size="icon"
                onClick={() => setSearchOpen(true)}
              >
                <SearchIcon className="size-4" />                
              </Button>
              <Separator orientation="vertical" className="h-4" />        
              <ThreadListPrimitive.New asChild>
                <Button className="size-7" variant="ghost" size="icon">
                  <PlusIcon className="size-4" />                
                </Button>
              </ThreadListPrimitive.New>
              <Separator orientation="vertical" className="h-4" />     

            </header>
            <div className="flex-1 overflow-hidden">
              <Thread />
            </div>
          </SidebarInset>
        </div>
        <Searchbar open={searchOpen} onOpenChange={setSearchOpen} />
      </SidebarProvider>
    </AssistantRuntimeProvider>
  );
}