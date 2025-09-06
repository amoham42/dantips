import {
  ActionBarPrimitive,
  BranchPickerPrimitive,
  ComposerPrimitive,
  ErrorPrimitive,
  MessagePrimitive,
  ThreadPrimitive,
} from "@assistant-ui/react";

import {
  ArrowDownIcon,
  ArrowUpIcon,
  CheckIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  CopyIcon,
  PencilIcon,
  RefreshCwIcon,
  Square,
} from "lucide-react";
import type { FC } from "react";
import { useEffect, useMemo } from "react";

import {
  ComposerAddAttachment,
  ComposerAttachments,
  UserMessageAttachments,
} from "@/components/assistant-ui/attachment";

import { MarkdownText } from "@/components/assistant-ui/markdown-text";
import { ToolFallback } from "@/components/assistant-ui/tool-fallback";
import { TooltipIconButton } from "@/components/assistant-ui/tooltip-icon-button";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { LazyMotion, MotionConfig, domAnimation } from "motion/react";
import * as m from "motion/react-m";
import { MicActionButton } from "@/components/mic-actions";
import useWebRTCAudioSession from "@/hooks/use-webrtc";
import { tools } from "@/lib/tools";
import { useToolsFunctions } from "@/hooks/use-tools";
import Transcriber from "@/components/transcriber";
import { useThread } from "@assistant-ui/react";

export const Thread: FC = () => {
  const threadId = useThread((t) => t.threadId);
  const {
    isSessionActive,
    handleStartStopClick,
    registerFunction,
    conversation,
    micSessions,
  } = useWebRTCAudioSession('alloy', tools, { threadId });

  const toolsFunctions = useToolsFunctions();

  useEffect(() => {
    Object.entries(toolsFunctions).forEach(([name, func]) => {
      const functionNames: Record<string, string> = {
        timeFunction: 'getCurrentTime',
        scrapeWebsite: 'scrapeWebsite',
        searchMedicalLiterature: 'searchMedicalLiterature',
      };
      if (functionNames[name]) {
        registerFunction(functionNames[name], func as (...args: unknown[]) => Promise<unknown> | unknown);
      }
    });
  }, [registerFunction, toolsFunctions]);

  return (
    <LazyMotion features={domAnimation}>
      <MotionConfig reducedMotion="user">
        <ThreadPrimitive.Root
          className="aui-root * border-border outline-ring/50 aui-thread-root @container flex h-full flex-col bg-background"
          style={{
            ["--thread-max-width" as string]: "44rem",
          }}
        >
          <ThreadPrimitive.Viewport className="aui-thread-viewport relative flex flex-1 flex-col overflow-x-auto overflow-y-scroll px-4">
            <ThreadWelcome />

            <InterleavedMessages
              micSessions={micSessions}
              components={{
                UserMessage: UserMessage,
                EditComposer: EditComposer,
                AssistantMessage: AssistantMessage,
              }}
            />
            {isSessionActive && (
              <div className="relative mx-auto w-full max-w-[var(--thread-max-width)] mb-10 border border-blue-700 rounded-lg">
                <div className="relative flex justify-center items-center aspect-video w-full">
                  <span className="absolute top-12 w-[calc(100%-70%)] h-[calc(100%-70%)]"></span>
                  <div className="size-full mx-auto">
                    <Transcriber conversation={conversation} />
                  </div>
                </div>
              </div>
            )}
            <ThreadPrimitive.If empty={false}>
              <div className="min-h-8 flex-grow" />
            </ThreadPrimitive.If>
            <div className="aui-thread-viewport-spacer min-h-8 grow" />
            <ThreadScrollToBottom />
            <Composer
              isSessionActive={isSessionActive}
              handleStartStopClick={handleStartStopClick}
            />
          </ThreadPrimitive.Viewport>
        </ThreadPrimitive.Root>
      </MotionConfig>
    </LazyMotion>
  );
};

const ThreadScrollToBottom: FC = () => {
  return (
    <ThreadPrimitive.ScrollToBottom asChild>
      <TooltipIconButton
        tooltip="Scroll to bottom"
        variant="outline"
        className="aui-thread-scroll-to-bottom absolute -top-12 z-10 self-center rounded-full p-4 disabled:invisible dark:bg-background dark:hover:bg-accent"
      >
        <ArrowDownIcon />
      </TooltipIconButton>
    </ThreadPrimitive.ScrollToBottom>
  );
};

const ThreadWelcome: FC = () => {
  return (
    <ThreadPrimitive.Empty>
      <div className="aui-thread-welcome-root mx-auto mb-16 flex w-full max-w-[var(--thread-max-width)] flex-grow flex-col">
        <div className="aui-thread-welcome-center flex w-full flex-grow flex-col items-center justify-center">
          <div className="aui-thread-welcome-message flex size-full flex-col justify-center px-8 md:mt-20">
            <m.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              className="aui-thread-welcome-message-motion-1 text-2xl font-semibold"
            >
              Hello there!
            </m.div>
            <m.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 10 }}
              transition={{ delay: 0.1 }}
              className="aui-thread-welcome-message-motion-2 text-2xl text-muted-foreground/65"
            >
              How can I help you today?
            </m.div>
          </div>
        </div>
      </div>
    </ThreadPrimitive.Empty>
  );
};

const ThreadWelcomeSuggestions: FC = () => {
  return (
    <div className="aui-thread-welcome-suggestions grid w-full gap-2 @md:grid-cols-2">
      {[
        {
          title: "What's the weather",
          label: "in San Francisco?",
          action: "What's the weather in San Francisco?",
        },
        {
          title: "Help me write an essay",
          label: `about AI chat applications`,
          action: `Help me write an essay about AI chat applications`,
        },
      ].map((suggestedAction, index) => (
        <m.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 20 }}
          transition={{ delay: 0.05 * index }}
          key={`suggested-action-${suggestedAction.title}-${index}`}
          className="aui-thread-welcome-suggestion-display [&:nth-child(n+3)]:hidden @md:[&:nth-child(n+3)]:block"
        >
          <ThreadPrimitive.Suggestion
            prompt={suggestedAction.action}
            method="replace"
            autoSend
            asChild
          >
            <Button
              variant="ghost"
              className="aui-thread-welcome-suggestion h-auto w-full flex-1 flex-wrap items-start justify-start gap-1 rounded-3xl border px-5 py-4 text-left text-sm @md:flex-col dark:hover:bg-accent/60"
              aria-label={suggestedAction.action}
            >
              <span className="aui-thread-welcome-suggestion-text-1 font-medium">
                {suggestedAction.title}
              </span>
              <span className="aui-thread-welcome-suggestion-text-2 text-muted-foreground">
                {suggestedAction.label}
              </span>
            </Button>
          </ThreadPrimitive.Suggestion>
        </m.div>
      ))}
    </div>
  );
};

type ComposerProps = {
  isSessionActive: boolean;
  handleStartStopClick: () => void;
};

const Composer: FC<ComposerProps> = ({ isSessionActive, handleStartStopClick }) => {

  return (
    <div className="aui-composer-wrapper sticky bottom-0 mx-auto flex w-full max-w-[var(--thread-max-width)] flex-col gap-4 overflow-visible rounded-t-3xl bg-background pb-4 md:pb-6">
      <ThreadScrollToBottom />
      <ThreadPrimitive.Empty>
        <ThreadWelcomeSuggestions />
      </ThreadPrimitive.Empty>
      <ComposerPrimitive.Root className="aui-composer-root relative flex w-full flex-col rounded-3xl border border-border bg-muted px-1 pt-2 shadow-[0_9px_9px_0px_rgba(0,0,0,0.01),0_2px_5px_0px_rgba(0,0,0,0.06)] dark:border-muted-foreground/15">
        <ComposerAttachments />
        <ComposerPrimitive.Input
          placeholder="Send a message..."
          className="aui-composer-input mb-1 max-h-32 min-h-16 w-full resize-none bg-transparent px-3.5 pt-1.5 pb-3 text-base outline-none placeholder:text-muted-foreground focus:outline-primary"
          rows={1}
          autoFocus
          aria-label="Message input"
        />
        <ComposerAction
          isSessionActive={isSessionActive}
          handleStartStopClick={handleStartStopClick}
        />
      </ComposerPrimitive.Root>
    </div>
  );
};

type ComposerActionProps = {
  isSessionActive: boolean;
  handleStartStopClick: () => void;
};

const ComposerAction: FC<ComposerActionProps> = ({ isSessionActive, handleStartStopClick }) => {
  return (
    <div className="aui-composer-action-wrapper relative mx-1 mt-2 mb-2 flex items-center justify-between">
      <ComposerAddAttachment />

      <div className="flex items-center justify-between gap-2">
      <MicActionButton
        isSessionActive={isSessionActive}
        handleStartStopClick={handleStartStopClick}
      />
      <ThreadPrimitive.If running={false}>
        <ComposerPrimitive.Send asChild>
          <TooltipIconButton
            tooltip="Send message"
            side="bottom"
            type="submit"
            variant="default"
            size="icon"
            className="aui-composer-send size-[34px] rounded-full p-1"
            aria-label="Send message"
          >
            <ArrowUpIcon className="aui-composer-send-icon size-5" />
          </TooltipIconButton>
        </ComposerPrimitive.Send>
      </ThreadPrimitive.If>

      <ThreadPrimitive.If running>
        <ComposerPrimitive.Cancel asChild>
          <Button
            type="button"
            variant="default"
            size="icon"
            className="aui-composer-cancel size-[34px] rounded-full border border-muted-foreground/60 hover:bg-primary/75 dark:border-muted-foreground/90"
            aria-label="Stop generating"
          >
            <Square className="aui-composer-cancel-icon size-3.5 fill-white dark:fill-black" />
          </Button>
        </ComposerPrimitive.Cancel>
      </ThreadPrimitive.If>
      </div>
    </div>
  );
};

const MessageError: FC = () => {
  return (
    <MessagePrimitive.Error>
      <ErrorPrimitive.Root className="aui-message-error-root mt-2 rounded-md border border-destructive bg-destructive/10 p-3 text-sm text-destructive dark:bg-destructive/5 dark:text-red-200">
        <ErrorPrimitive.Message className="aui-message-error-message line-clamp-2" />
      </ErrorPrimitive.Root>
    </MessagePrimitive.Error>
  );
};

const AssistantMessage: FC = () => {
  return (
    <MessagePrimitive.Root asChild>
      <m.div
        className="aui-assistant-message-root relative mx-auto w-full max-w-[var(--thread-max-width)] py-4 last:mb-24"
        initial={{ y: 5, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        data-role="assistant"
      >
        <div className="aui-assistant-message-content mx-2 leading-7 break-words text-foreground">
          <MessagePrimitive.Parts
            components={{
              Text: MarkdownText,
              tools: { Fallback: ToolFallback },
            }}
          />
          <MessageError />
        </div>

        <div className="aui-assistant-message-footer mt-2 ml-2 flex">
          <BranchPicker />
          <AssistantActionBar />
        </div>
      </m.div>
    </MessagePrimitive.Root>
  );
};

const AssistantActionBar: FC = () => {
  return (
    <ActionBarPrimitive.Root
      hideWhenRunning
      autohide="not-last"
      autohideFloat="single-branch"
      className="aui-assistant-action-bar-root col-start-3 row-start-2 -ml-1 flex gap-1 text-muted-foreground data-floating:absolute data-floating:rounded-md data-floating:border data-floating:bg-background data-floating:p-1 data-floating:shadow-sm"
    >
      <ActionBarPrimitive.Copy asChild>
        <TooltipIconButton tooltip="Copy">
          <MessagePrimitive.If copied>
            <CheckIcon />
          </MessagePrimitive.If>
          <MessagePrimitive.If copied={false}>
            <CopyIcon />
          </MessagePrimitive.If>
        </TooltipIconButton>
      </ActionBarPrimitive.Copy>
      <ActionBarPrimitive.Reload asChild>
        <TooltipIconButton tooltip="Refresh">
          <RefreshCwIcon />
        </TooltipIconButton>
      </ActionBarPrimitive.Reload>
    </ActionBarPrimitive.Root>
  );
};

const UserMessage: FC = () => {
  return (
    <MessagePrimitive.Root asChild>
      <m.div
        className="aui-user-message-root mx-auto grid w-full max-w-[var(--thread-max-width)] auto-rows-auto grid-cols-[minmax(72px,1fr)_auto] gap-y-2 px-2 py-4 first:mt-3 last:mb-5 [&:where(>*)]:col-start-2"
        initial={{ y: 5, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        data-role="user"
      >
        <UserMessageAttachments />

        <div className="aui-user-message-content-wrapper relative col-start-2 min-w-0">
          <div className="aui-user-message-content rounded-3xl bg-muted px-5 py-2.5 break-words text-foreground">
            <MessagePrimitive.Parts />
          </div>
          <div className="aui-user-action-bar-wrapper absolute top-1/2 left-0 -translate-x-full -translate-y-1/2 pr-2">
            <UserActionBar />
          </div>
        </div>

        <BranchPicker className="aui-user-branch-picker col-span-full col-start-1 row-start-3 -mr-1 justify-end" />
      </m.div>
    </MessagePrimitive.Root>
  );
};

const UserActionBar: FC = () => {
  return (
    <ActionBarPrimitive.Root
      hideWhenRunning
      autohide="not-last"
      className="aui-user-action-bar-root flex flex-col items-end"
    >
      <ActionBarPrimitive.Edit asChild>
        <TooltipIconButton tooltip="Edit" className="aui-user-action-edit p-4">
          <PencilIcon />
        </TooltipIconButton>
      </ActionBarPrimitive.Edit>
    </ActionBarPrimitive.Root>
  );
};

const EditComposer: FC = () => {
  return (
    <div className="aui-edit-composer-wrapper mx-auto flex w-full max-w-[var(--thread-max-width)] flex-col gap-4 px-2 first:mt-4">
      <ComposerPrimitive.Root className="aui-edit-composer-root ml-auto flex w-full max-w-7/8 flex-col rounded-xl bg-muted">
        <ComposerPrimitive.Input
          className="aui-edit-composer-input flex min-h-[60px] w-full resize-none bg-transparent p-4 text-foreground outline-none"
          autoFocus
        />

        <div className="aui-edit-composer-footer mx-3 mb-3 flex items-center justify-center gap-2 self-end">
          <ComposerPrimitive.Cancel asChild>
            <Button variant="ghost" size="sm" aria-label="Cancel edit">
              Cancel
            </Button>
          </ComposerPrimitive.Cancel>
          <ComposerPrimitive.Send asChild>
            <Button size="sm" aria-label="Update message">
              Update
            </Button>
          </ComposerPrimitive.Send>
        </div>
      </ComposerPrimitive.Root>
    </div>
  );
};

const BranchPicker: FC<BranchPickerPrimitive.Root.Props> = ({
  className,
  ...rest
}) => {
  return (
    <BranchPickerPrimitive.Root
      hideWhenSingleBranch
      className={cn("aui-branch-picker-root mr-2 -ml-2 inline-flex items-center text-xs text-muted-foreground", className)}
      {...rest}
    >
      <BranchPickerPrimitive.Previous asChild>
        <TooltipIconButton tooltip="Previous">
          <ChevronLeftIcon />
        </TooltipIconButton>
      </BranchPickerPrimitive.Previous>
      <span className="aui-branch-picker-state font-medium">
        <BranchPickerPrimitive.Number /> / <BranchPickerPrimitive.Count />
      </span>
      <BranchPickerPrimitive.Next asChild>
        <TooltipIconButton tooltip="Next">
          <ChevronRightIcon />
        </TooltipIconButton>
      </BranchPickerPrimitive.Next>
    </BranchPickerPrimitive.Root>
  );
};

type MicSessionMarkerProps = { startedAt: string; endedAt: string };

const MicSessionMarker: FC<MicSessionMarkerProps> = ({ startedAt, endedAt }) => {
  const start = new Date(startedAt);
  const end = new Date(endedAt);
  const sameDay = start.toDateString() === end.toDateString();
  const fmtTime = (d: Date) => d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
  const label = sameDay
    ? `${fmtTime(start)}–${fmtTime(end)}`
    : `${start.toLocaleString()}–${end.toLocaleString()}`;
  return (
    <div className="aui-mic-session-marker my-2 py-2">
      <div className="mx-auto max-w-[var(--thread-max-width)]">
        <div className="flex w-full items-center justify-center">
          <span className="rounded-full bg-blue-500 px-3 py-1 text-xs text-white">
            Voice session • {label}
          </span>
        </div>
      </div>
    </div>
  );
};

type InterleavedMessagesProps = {
  micSessions: { id: string; startedAt: string; endedAt: string }[];
  components: Parameters<typeof ThreadPrimitive.Messages>[0]["components"];
};

const InterleavedMessages: FC<InterleavedMessagesProps> = ({ micSessions, components }) => {
  const messages = useThread((t) => t.messages);

  const items = useMemo(() => {
    // Prepare list of message items with timestamps
    const messageItems = messages.map((m, index) => ({
      kind: "message" as const,
      createdAt: m.createdAt.getTime(),
      index,
      id: m.id,
    }));

    // Prepare mic session markers using end time as the placement time
    const sessionItems = (micSessions ?? []).map((s) => ({
      kind: "mic" as const,
      createdAt: new Date(s.endedAt).getTime(),
      id: s.id,
      startedAt: s.startedAt,
      endedAt: s.endedAt,
    }));

    // Merge and sort chronologically
    const merged = [...messageItems, ...sessionItems].sort((a, b) => a.createdAt - b.createdAt);
    return merged;
  }, [messages, micSessions]);

  return (
    <>
      {items.map((item) =>
        item.kind === "message" ? (
          <ThreadPrimitive.MessageByIndex key={`msg-${item.id}`} index={item.index} components={components} />
        ) : (
          <MicSessionMarker key={`mic-${item.id}`} startedAt={item.startedAt} endedAt={item.endedAt} />
        )
      )}
    </>
  );
};