"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { ToolCallDisplay } from "./tool-call-display";
import { ConfirmationPrompt } from "./confirmation-prompt";

// Normalize message to always have parts array
function normalizeParts(message) {
  // If already has parts, use them
  if (message.parts && message.parts.length > 0) {
    return message.parts;
  }
  // Convert content string to parts array
  if (typeof message.content === 'string' && message.content) {
    return [{ type: 'text', text: message.content }];
  }
  // Fallback
  return [];
}

export function ChatMessage({ message, onApprove, onReject }) {
  const { role } = message;
  const parts = normalizeParts(message);

  // Debug: log message structure to understand tool call duplication
  if (role === "assistant" && parts.some(p => p.type?.startsWith("tool-"))) {
    console.log("[ChatMessage] Assistant with tools:", {
      id: message.id,
      partsCount: parts.length,
      toolParts: parts.filter(p => p.type?.startsWith("tool-")).map(p => ({
        type: p.type,
        toolCallId: p.toolCallId,
        toolName: p.toolName,
        state: p.state,
      })),
    });
  }

  if (role === "user") {
    return <UserMessage parts={parts} />;
  }

  if (role === "assistant") {
    return <AssistantMessage parts={parts} onApprove={onApprove} onReject={onReject} />;
  }

  // System messages
  return (
    <div className="text-white/20 font-mono text-xs italic py-1">
      {parts?.map((part, i) =>
        part.type === "text" ? <span key={i}>{part.text}</span> : null
      )}
    </div>
  );
}

function UserMessage({ parts }) {
  const text = parts
    ?.filter((p) => p.type === "text")
    .map((p) => p.text)
    .join("");

  if (!text) return null;

  return <p className="whitespace-pre-wrap">{text}</p>;
}

function AssistantMessage({ parts, onApprove, onReject }) {
  if (!parts || parts.length === 0) return null;

  // Dedupe tool calls by toolCallId to prevent duplicates from multi-step accumulation
  const seenToolCallIds = new Set();
  const dedupedParts = parts.filter((part) => {
    // Non-tool parts always pass through
    if (!part.type?.startsWith("tool-") && part.type !== "dynamic-tool") {
      return true;
    }

    // Tool parts - dedupe by toolCallId
    const toolCallId = part.toolCallId || part.id;
    if (toolCallId && seenToolCallIds.has(toolCallId)) {
      return false; // Skip duplicate
    }
    if (toolCallId) {
      seenToolCallIds.add(toolCallId);
    }
    return true;
  });

  return (
    <div className="space-y-2">
      {dedupedParts.map((part, i) => (
        <AssistantPart
          key={part.toolCallId || part.id || `${i}-${part.type}`}
          part={part}
          onApprove={onApprove}
          onReject={onReject}
        />
      ))}
    </div>
  );
}

function AssistantPart({ part, onApprove, onReject }) {
  // Text content
  if (part.type === "text") {
    if (!part.text) return null;
    return (
      <div className="prose prose-invert prose-sm max-w-none
        prose-p:my-1 prose-p:leading-relaxed
        prose-ul:my-2 prose-ol:my-2 prose-li:my-0.5
        prose-code:text-cyan-400 prose-code:bg-white/10 prose-code:px-1 prose-code:py-0.5 prose-code:rounded prose-code:text-xs
        prose-pre:bg-black/30 prose-pre:border prose-pre:border-white/10 prose-pre:rounded-lg prose-pre:my-2
        prose-table:border-collapse prose-table:w-full prose-table:my-3
        prose-th:border prose-th:border-white/20 prose-th:bg-white/10 prose-th:px-3 prose-th:py-2 prose-th:text-left prose-th:font-semibold
        prose-td:border prose-td:border-white/10 prose-td:px-3 prose-td:py-2
        prose-headings:text-white prose-headings:font-semibold
        prose-h1:text-lg prose-h2:text-base prose-h3:text-sm
        prose-a:text-blue-400 prose-a:no-underline hover:prose-a:underline
        prose-strong:text-white prose-strong:font-semibold
        prose-blockquote:border-l-2 prose-blockquote:border-white/20 prose-blockquote:pl-4 prose-blockquote:italic prose-blockquote:text-white/60
      ">
        <ReactMarkdown remarkPlugins={[remarkGfm]}>{part.text}</ReactMarkdown>
      </div>
    );
  }

  // Reasoning
  if (part.type === "reasoning") {
    return (
      <div className="font-mono text-xs text-white/30 italic border-l-2 border-white/10 pl-2 my-1">
        {part.text}
      </div>
    );
  }

  // Tool invocations (dynamic tools from our OpenAPI converter)
  if (part.type === "dynamic-tool" || part.type?.startsWith("tool-")) {
    const toolName = part.toolName || part.type?.replace("tool-", "") || "unknown";

    // Approval requested — show [Y/n] confirmation
    if (part.state === "approval-requested") {
      return (
        <ConfirmationPrompt
          toolName={toolName}
          input={part.input}
          approvalId={part.approval?.id}
          onApprove={onApprove}
          onReject={onReject}
          responded={false}
        />
      );
    }

    // Approval responded — show confirmed/rejected status
    if (part.state === "approval-responded") {
      return (
        <ConfirmationPrompt
          toolName={toolName}
          input={part.input}
          approvalId={part.approval?.id}
          responded={true}
          approved={part.approval?.approved}
        />
      );
    }

    // Regular tool call display (input-streaming, input-available, output-available, output-error)
    return (
      <ToolCallDisplay
        toolName={toolName}
        input={part.input}
        output={part.output}
        state={part.state}
      />
    );
  }

  // Step start markers
  if (part.type === "step-start") {
    return null; // Hide step boundaries
  }

  return null;
}
