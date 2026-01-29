"use client";

import { useState, useEffect, useRef, useMemo, use } from "react";
import { useChat } from "@ai-sdk/react";
import {
  DefaultChatTransport,
  lastAssistantMessageIsCompleteWithApprovalResponses,
} from "ai";
import { AuthGuard } from "@/components/auth-guard";
import { ChatMessage } from "@/components/chat/chat-message";
import { ChatInput } from "@/components/chat/chat-input";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Bot, AlertCircle, KeyRound, X } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { toast } from "sonner";

/**
 * Convert DB messages to useChat UIMessage format.
 * DB: { id, role, content, tool_calls }
 * UIMessage: { id, role, parts: [{ type: "text", text }] }
 */
function dbMessagesToUI(dbMessages) {
  return dbMessages.map((msg) => {
    const parts = [];
    if (msg.content) {
      parts.push({ type: "text", text: msg.content });
    }
    return {
      id: msg.id,
      role: msg.role,
      parts,
    };
  });
}

function ChatContent({ params }) {
  const { id: agentId } = use(params);
  const searchParams = useSearchParams();
  const chatIdParam = searchParams.get("chat");

  const [agent, setAgent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [input, setInput] = useState("");
  const [userAuthToken, setUserAuthToken] = useState("");
  const [showTokenInput, setShowTokenInput] = useState(false);
  const [chatId, setChatId] = useState(chatIdParam || null);
  const [historyMessages, setHistoryMessages] = useState(null);
  const scrollRef = useRef(null);
  const bodyRef = useRef({ agentId, userAuthToken: "", chatId: chatIdParam || null });

  // Keep bodyRef up to date
  useEffect(() => {
    bodyRef.current = { agentId, userAuthToken, chatId };
  }, [agentId, userAuthToken, chatId]);

  // Load agent metadata
  useEffect(() => {
    fetchAgent();
  }, [agentId]);

  // Load existing chat messages if resuming
  useEffect(() => {
    if (chatIdParam) {
      loadChatHistory(chatIdParam);
    } else {
      setHistoryMessages([]);
    }
  }, [chatIdParam]);

  const fetchAgent = async () => {
    try {
      const res = await fetch(`/api/agents/${agentId}`);
      if (res.ok) {
        const data = await res.json();
        setAgent(data.agent);
      } else {
        toast.error("Failed to load agent");
      }
    } catch {
      toast.error("Failed to load agent");
    } finally {
      setLoading(false);
    }
  };

  const loadChatHistory = async (id) => {
    try {
      const res = await fetch(`/api/chats/${id}/messages`);
      if (res.ok) {
        const data = await res.json();
        const uiMessages = dbMessagesToUI(data.messages || []);
        setHistoryMessages(uiMessages);
      } else {
        // Chat not found — start fresh
        setHistoryMessages([]);
        setChatId(null);
      }
    } catch {
      setHistoryMessages([]);
      setChatId(null);
    }
  };

  // Stable transport — body is a function that reads latest values from ref
  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/chat",
        body: () => bodyRef.current,
      }),
    []
  );

  // Chat hook — pass initialMessages if resuming
  const {
    messages,
    status,
    sendMessage,
    addToolApprovalResponse,
    error,
    clearError,
  } = useChat({
    transport,
    initialMessages: historyMessages || [],
    sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithApprovalResponses,
    onError: (err) => {
      console.error("[Chat] Error:", err);
    },
  });

  // Auto-scroll on new messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: "smooth",
      });
    }
  }, [messages, status]);

  // Handle approval
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

  // Handle message send
  const handleSend = (e) => {
    e?.preventDefault();
    if (!input.trim() || status !== "ready") return;
    const text = input;
    setInput("");
    sendMessage({ text });
  };

  // Check if there's a pending approval
  const hasPendingApproval = messages.some((m) =>
    m.parts?.some(
      (part) =>
        (part.type === "dynamic-tool" || part.type?.startsWith("tool-")) &&
        part.state === "approval-requested"
    )
  );

  // Wait for both agent and history to load
  const isLoading = loading || historyMessages === null;

  if (isLoading) {
    return (
      <div className="h-screen flex items-center justify-center bg-[#0a0a0f]">
        <div className="text-white/30 font-mono text-sm animate-pulse">
          {loading ? "Loading agent..." : "Loading chat history..."}
        </div>
      </div>
    );
  }

  if (!agent) {
    return (
      <div className="h-screen flex items-center justify-center bg-[#0a0a0f]">
        <div className="text-center">
          <p className="text-red-400 font-mono mb-4">Agent not found</p>
          <Link href="/agents">
            <Button variant="ghost" className="text-white/50">
              ← Back to agents
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-[#0a0a0f] text-white">
      {/* Header */}
      <header className="border-b border-white/5 px-4 py-3 flex items-center justify-between shrink-0 bg-[#0a0a0f]">
        <div className="flex items-center gap-3">
          <Link
            href={`/agents/${agentId}`}
            className="text-white/30 hover:text-white/60 transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="flex items-center gap-2">
            <Bot className="h-4 w-4 text-blue-400" />
            <span className="font-bold text-sm">{agent.name}</span>
          </div>
          <span className="text-[10px] text-white/20 font-mono px-1.5 py-0.5 rounded bg-white/5">
            {agent.model_provider}/{agent.model_name}
          </span>
          {chatIdParam && (
            <span className="text-[10px] text-blue-400/40 font-mono px-1.5 py-0.5 rounded bg-blue-500/5">
              resumed
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          {/* Token input toggle */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowTokenInput(!showTokenInput)}
            className={`h-7 w-7 p-0 ${userAuthToken ? "text-green-400" : "text-white/30"} hover:text-white/60`}
            title="Set API token for target service"
          >
            <KeyRound className="h-3.5 w-3.5" />
          </Button>
        </div>
      </header>

      {/* Token input panel */}
      {showTokenInput && (
        <div className="border-b border-white/5 bg-white/[0.02] px-4 py-3 shrink-0">
          <div className="max-w-3xl mx-auto flex items-center gap-2">
            <span className="text-white/40 text-xs font-mono shrink-0">
              API Token:
            </span>
            <input
              type="password"
              value={userAuthToken}
              onChange={(e) => setUserAuthToken(e.target.value)}
              placeholder="Bearer token for target API (passthrough auth)"
              className="flex-1 bg-transparent border border-white/10 rounded px-2 py-1 text-xs font-mono text-white/80 placeholder:text-white/20 outline-none focus:border-white/20"
            />
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowTokenInput(false)}
              className="h-6 w-6 p-0 text-white/30 hover:text-white/60"
            >
              <X className="h-3 w-3" />
            </Button>
          </div>
        </div>
      )}

      {/* Messages area */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-4 py-6">
        <div className="max-w-3xl mx-auto space-y-1">
          {/* Welcome message */}
          {messages.length === 0 && (
            <div className="py-12">
              <div className="text-white/15 font-mono text-xs space-y-1">
                <div>&gt; ActionChat v0.1 — {agent.name}</div>
                <div>
                  &gt; Model: {agent.model_provider}/{agent.model_name}
                </div>
                <div>&gt; Ready for instructions.</div>
                <div className="mt-4 text-white/10">
                  Type a command. Dangerous actions require [Y/n] confirmation.
                </div>
              </div>
            </div>
          )}

          {/* Messages */}
          {messages.map((message) => (
            <ChatMessage
              key={message.id}
              message={message}
              onApprove={handleApprove}
              onReject={handleReject}
            />
          ))}

          {/* Thinking indicator */}
          {status === "submitted" && (
            <div className="py-1 font-mono text-sm text-white/30 animate-pulse">
              thinking...
            </div>
          )}

          {/* Streaming cursor */}
          {status === "streaming" && (
            <span className="inline-block w-2 h-4 bg-green-400 animate-blink ml-0.5 align-middle" />
          )}
        </div>
      </div>

      {/* Error display */}
      {error && (
        <div className="px-4 py-2 bg-red-500/10 border-t border-red-500/20 shrink-0">
          <div className="max-w-3xl mx-auto flex items-center gap-2">
            <AlertCircle className="h-3.5 w-3.5 text-red-400 shrink-0" />
            <span className="text-xs text-red-400 font-mono flex-1">
              {error.message}
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
      <ChatInput
        value={input}
        onChange={setInput}
        onSubmit={handleSend}
        disabled={status !== "ready" || hasPendingApproval}
        placeholder={
          hasPendingApproval
            ? "Confirm or reject the action above..."
            : status !== "ready"
              ? "Waiting for response..."
              : "Type a command..."
        }
      />

      {/* Footer */}
      <div className="border-t border-white/5 px-4 py-1.5 shrink-0">
        <div className="max-w-3xl mx-auto flex justify-between items-center">
          <span className="text-white/10 text-[10px] font-mono">
            ActionChat Console
          </span>
          <span className="text-white/10 text-[10px] font-mono">
            Press Enter to execute
          </span>
        </div>
      </div>
    </div>
  );
}

export default function ChatPage({ params }) {
  return (
    <AuthGuard>
      <ChatContent params={params} />
    </AuthGuard>
  );
}
