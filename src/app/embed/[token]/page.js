"use client";

import { useState, useEffect, useRef, useMemo, use } from "react";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport } from "ai";
import { ChatMessage } from "@/components/chat/chat-message";
import { Bot, Send, AlertCircle, Loader2 } from "lucide-react";

/**
 * Public embed page — /embed/[token]
 * No authentication required. Loads widget config via embed token,
 * then renders a minimal chat interface.
 */
function EmbedContent({ params }) {
  const { token } = use(params);
  const [widget, setWidget] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [input, setInput] = useState("");
  const scrollRef = useRef(null);
  const inputRef = useRef(null);
  const bodyRef = useRef({ embedToken: token });

  // Load widget config
  useEffect(() => {
    loadWidget();
  }, [token]);

  const loadWidget = async () => {
    try {
      const res = await fetch(`/api/embed/${token}`);
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || "Widget not found");
        return;
      }
      const data = await res.json();
      setWidget(data.widget);
    } catch {
      setError("Failed to load widget");
    } finally {
      setLoading(false);
    }
  };

  // Transport for embed chat — uses a separate endpoint
  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/embed/chat",
        body: () => bodyRef.current,
      }),
    []
  );

  const {
    messages,
    status,
    sendMessage,
    addToolApprovalResponse,
    error: chatError,
    clearError,
  } = useChat({
    transport,
    onError: (err) => {
      console.error("[Embed Chat] Error:", err);
    },
  });

  // Auto-scroll
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: "smooth",
      });
    }
  }, [messages, status]);

  const handleApprove = (approvalId) => {
    addToolApprovalResponse({ id: approvalId, approved: true });
  };

  const handleReject = (approvalId) => {
    addToolApprovalResponse({
      id: approvalId,
      approved: false,
      reason: "User rejected the action",
    });
  };

  const handleSend = (e) => {
    e?.preventDefault();
    if (!input.trim() || status !== "ready") return;
    const text = input;
    setInput("");
    sendMessage({ text });
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend(e);
    }
  };

  // Theme from widget config
  const theme = widget?.theme || {};
  const accentColor = theme.accent_color || "#3b82f6";

  if (loading) {
    return (
      <div className="h-screen flex items-center justify-center bg-[#0a0a0f]">
        <Loader2 className="h-6 w-6 animate-spin text-white/30" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-screen flex items-center justify-center bg-[#0a0a0f]">
        <div className="text-center">
          <AlertCircle className="h-8 w-8 text-red-400 mx-auto mb-3" />
          <p className="text-red-400 font-mono text-sm">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-[#0a0a0f] text-white">
      {/* Header */}
      <header className="border-b border-white/5 px-4 py-3 flex items-center gap-3 shrink-0 bg-[#0a0a0f]">
        <div
          className="w-8 h-8 rounded-lg flex items-center justify-center"
          style={{ backgroundColor: `${accentColor}20` }}
        >
          <Bot className="h-4 w-4" style={{ color: accentColor }} />
        </div>
        <div>
          <span className="font-bold text-sm">
            {widget.agent_name || "Assistant"}
          </span>
          {widget.agent_description && (
            <p className="text-xs text-white/40 line-clamp-1">
              {widget.agent_description}
            </p>
          )}
        </div>
      </header>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-6">
        <div className="max-w-3xl mx-auto space-y-1">
          {messages.length === 0 && (
            <div className="py-12 text-center">
              <Bot
                className="h-10 w-10 mx-auto mb-4"
                style={{ color: `${accentColor}40` }}
              />
              <p className="text-white/30 font-mono text-sm">
                {widget.settings?.welcome_message ||
                  `Hi! I'm ${widget.agent_name || "your assistant"}. How can I help?`}
              </p>
            </div>
          )}

          {messages.map((message) => (
            <ChatMessage
              key={message.id}
              message={message}
              onApprove={handleApprove}
              onReject={handleReject}
            />
          ))}

          {status === "submitted" && (
            <div className="py-1 font-mono text-sm text-white/30 animate-pulse">
              thinking...
            </div>
          )}

          {status === "streaming" && (
            <span className="inline-block w-2 h-4 bg-blue-400 animate-blink ml-0.5 align-middle" />
          )}
        </div>
      </div>

      {/* Error */}
      {chatError && (
        <div className="px-4 py-2 bg-red-500/10 border-t border-red-500/20 shrink-0">
          <div className="max-w-3xl mx-auto flex items-center gap-2">
            <AlertCircle className="h-3.5 w-3.5 text-red-400 shrink-0" />
            <span className="text-xs text-red-400 font-mono flex-1">
              {chatError.message}
            </span>
            <button
              onClick={clearError}
              className="text-red-400/60 hover:text-red-400 text-xs"
            >
              dismiss
            </button>
          </div>
        </div>
      )}

      {/* Input */}
      <div className="border-t border-white/5 bg-[#0d0d14] px-4 py-3 shrink-0">
        <div className="max-w-3xl mx-auto flex items-center gap-2">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={status !== "ready"}
            placeholder={
              status !== "ready"
                ? "Waiting for response..."
                : "Type a message..."
            }
            className="flex-1 bg-transparent border-none outline-none font-mono text-sm text-white/80 placeholder:text-white/20 disabled:opacity-40"
            autoFocus
          />
          <button
            onClick={handleSend}
            disabled={!input.trim() || status !== "ready"}
            className="p-2 rounded-lg transition-colors disabled:opacity-30"
            style={{
              backgroundColor: input.trim() ? `${accentColor}20` : "transparent",
              color: input.trim() ? accentColor : "rgba(255,255,255,0.2)",
            }}
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Footer */}
      <div className="border-t border-white/5 px-4 py-1 shrink-0">
        <div className="max-w-3xl mx-auto text-center">
          <span className="text-white/10 text-[10px] font-mono">
            Powered by ActionChat
          </span>
        </div>
      </div>
    </div>
  );
}

export default function EmbedPage({ params }) {
  return <EmbedContent params={params} />;
}
