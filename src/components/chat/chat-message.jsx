"use client";

import ReactMarkdown from "react-markdown";
import { ToolCallDisplay } from "./tool-call-display";
import { ConfirmationPrompt } from "./confirmation-prompt";

export function ChatMessage({ message, onApprove, onReject }) {
  const { role, parts } = message;

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

  return (
    <div className="py-1 font-mono text-sm">
      <span className="text-green-500 select-none">&gt; </span>
      <span className="text-green-300">{text}</span>
    </div>
  );
}

function AssistantMessage({ parts, onApprove, onReject }) {
  if (!parts || parts.length === 0) return null;

  return (
    <div className="py-1">
      {parts.map((part, i) => (
        <AssistantPart
          key={`${i}-${part.type}`}
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
      <div className="font-mono text-sm text-white/80 prose prose-invert prose-sm max-w-none prose-p:my-1 prose-ul:my-1 prose-li:my-0 prose-code:text-cyan-400 prose-pre:bg-white/5 prose-pre:border prose-pre:border-white/10">
        <ReactMarkdown>{part.text}</ReactMarkdown>
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
