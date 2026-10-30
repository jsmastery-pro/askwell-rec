"use client";

import { APP_NAME, MESSAGE_MAX_LENGTH, type MessageRole, type WidgetConfig } from "@askwell/shared";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Button, Input } from "../ui";
import { cn } from "../ui/cn";
import { friendlyError, sendMessage } from "./chat-client";
import { hostBridge } from "./host-bridge";
import { getVisitorId } from "./visitor-id";

type ChatMessage = { id: string; role: MessageRole; body: string };

export type EmbedPanelProps = {
  publicKey: string;
  config: Pick<WidgetConfig, "headerText" | "showBadge">;
};

// Show the character count once the visitor is close to the limit.
const COUNTER_FROM = Math.floor(MESSAGE_MAX_LENGTH * 0.8);

/** The chat panel inside the widget's iframe. Every message renders as text, never HTML (§9). */
export function EmbedPanel({ publicKey, config }: EmbedPanelProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [typing, setTyping] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const conversationId = useRef<string | undefined>(undefined);
  const unread = useRef(0);
  const list = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Focus means the visitor is looking at the panel: nothing is unread.
    const onFocus = () => {
      if (unread.current === 0) return;
      unread.current = 0;
      hostBridge?.send({ type: "askwell:unread", count: 0 });
    };
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, []);

  useEffect(() => {
    list.current?.scrollTo?.({ top: list.current.scrollHeight });
  }, [messages, typing, notice]);

  const close = () => {
    unread.current = 0;
    hostBridge?.send({ type: "askwell:close" });
  };

  const message = draft.trim();
  const canSend = !typing && message.length > 0 && message.length <= MESSAGE_MAX_LENGTH;

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!canSend) return;
    setDraft("");
    setNotice(null);
    setMessages((current) => [
      ...current,
      { id: crypto.randomUUID(), role: "visitor", body: message },
    ]);
    setTyping(true);
    try {
      const response = await sendMessage({
        key: publicKey,
        visitorId: getVisitorId(),
        conversationId: conversationId.current,
        message,
      });
      conversationId.current = response.conversationId;
      setMessages((current) => [
        ...current,
        { id: crypto.randomUUID(), role: "bot", body: response.reply },
      ]);
      // A reply that lands while the panel isn't focused counts as unread on the button.
      if (!document.hasFocus()) {
        unread.current += 1;
        hostBridge?.send({ type: "askwell:unread", count: unread.current });
      }
    } catch (error) {
      setNotice(friendlyError(error));
    } finally {
      setTyping(false);
    }
  }

  return (
    <div
      data-theme="light"
      className="flex h-dvh flex-col bg-surface-raised text-fg"
      onKeyDown={(event) => {
        if (event.key === "Escape") close();
      }}
    >
      <header className="flex items-center gap-3 border-b border-line bg-glass px-4 py-3 backdrop-blur-glass">
        <h1 className="min-w-0 flex-1 truncate text-sm font-semibold">{config.headerText}</h1>
        <button
          type="button"
          onClick={close}
          aria-label="Close chat"
          className="inline-flex size-8 items-center justify-center rounded-md text-fg-muted hover:bg-fg/10 hover:text-fg focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus"
        >
          <svg aria-hidden="true" viewBox="0 0 16 16" className="size-4" fill="none">
            <path
              d="M4 4l8 8M12 4l-8 8"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
        </button>
      </header>

      <div
        ref={list}
        role="log"
        aria-live="polite"
        aria-label="Messages"
        className="flex flex-1 flex-col gap-2 overflow-y-auto px-4 py-4"
      >
        {messages.length === 0 && !typing ? (
          <p className="m-auto max-w-60 text-center text-sm text-fg-muted">
            Ask a question and we&apos;ll reply here.
          </p>
        ) : null}
        {messages.map((item) => (
          <p
            key={item.id}
            data-role={item.role}
            className={cn(
              "max-w-[85%] rounded-lg px-3 py-2 text-sm break-words whitespace-pre-wrap",
              item.role === "visitor"
                ? "self-end bg-fg text-surface-raised"
                : "self-start border border-line bg-glass",
            )}
          >
            {item.body}
          </p>
        ))}
        {typing ? (
          <div
            role="status"
            aria-label="Typing"
            className="flex gap-1 self-start rounded-lg border border-line bg-glass px-3 py-3"
          >
            {[0, 150, 300].map((delay) => (
              <span
                key={delay}
                aria-hidden="true"
                style={{ animationDelay: `${delay}ms` }}
                className="size-1.5 animate-pulse rounded-full bg-fg-muted motion-reduce:animate-none"
              />
            ))}
          </div>
        ) : null}
        {notice ? (
          <p role="alert" className="self-center text-center text-xs text-danger-fg">
            {notice}
          </p>
        ) : null}
      </div>

      <form onSubmit={onSubmit} className="border-t border-line px-3 py-3">
        <div className="flex items-center gap-2">
          <Input
            aria-label="Message"
            placeholder="Type a message"
            value={draft}
            maxLength={MESSAGE_MAX_LENGTH}
            onChange={(event) => setDraft(event.target.value.slice(0, MESSAGE_MAX_LENGTH))}
            autoComplete="off"
          />
          <Button type="submit" disabled={!canSend} aria-label="Send" className="shrink-0 px-3">
            <svg aria-hidden="true" viewBox="0 0 16 16" className="size-4" fill="none">
              <path
                d="M2.5 8h10M8.5 4l4 4-4 4"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </Button>
        </div>
        <div className="mt-2 flex min-h-4 items-center justify-between text-[11px] text-fg-muted">
          {config.showBadge ? (
            <a href="/" target="_blank" rel="noopener noreferrer" className="hover:text-fg">
              Powered by {APP_NAME}
            </a>
          ) : (
            <span />
          )}
          {draft.length >= COUNTER_FROM ? (
            <span aria-live="polite">
              {draft.length}/{MESSAGE_MAX_LENGTH}
            </span>
          ) : null}
        </div>
      </form>
    </div>
  );
}
