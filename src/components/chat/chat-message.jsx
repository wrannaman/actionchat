"use client";

import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { FileText, File as FileIcon } from "lucide-react";
import { toast } from "sonner";
import { ToolCallDisplay, GroupedToolCallDisplay } from "./tool-call-display";
import { ConfirmationPrompt } from "./confirmation-prompt";

// Clickable table cell that copies text content on click
function CopyableTd({ children, node, ...props }) {
  const handleCopy = async (e) => {
    const text = e.currentTarget.textContent?.trim();
    if (text) {
      await navigator.clipboard.writeText(text);
      toast.success("Copied!");
    }
  };

  return (
    <td {...props} onClick={handleCopy} className="cursor-pointer hover:bg-white/10 transition-colors">
      {children}
    </td>
  );
}

// Custom markdown components with click-to-copy on table cells
const markdownComponents = {
  td: CopyableTd,
};

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
  const { role, attachments } = message;
  const parts = normalizeParts(message);

  if (role === "user") {
    return <UserMessage parts={parts} attachments={attachments} />;
  }

  if (role === "assistant") {
    return (
      <AssistantMessage
        parts={parts}
        storedToolCalls={message.toolCalls}
        onApprove={onApprove}
        onReject={onReject}
      />
    );
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

function UserMessage({ parts, attachments }) {
  const text = parts
    ?.filter((p) => p.type === "text")
    .map((p) => p.text)
    .join("");

  // Check if this is a routine execution - show it nicely instead of raw prompt
  const routineMatch = text?.match(/^Run the "([^"]+)" routine:\n\n([\s\S]*?)(?:\n\nAdditional context: ([\s\S]*))?$/);
  if (routineMatch) {
    const [, routineName, , context] = routineMatch;
    return (
      <div className="space-y-1">
        <div className="flex items-center gap-2">
          <span className="text-black/60 text-sm">Running</span>
          <code className="bg-black/20 px-1.5 py-0.5 rounded text-sm font-mono">/{routineName}</code>
        </div>
        {context && (
          <p className="text-sm opacity-90">{context}</p>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {/* Attachments */}
      {attachments?.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {attachments.map((att, i) => {
            const isImage = att.contentType?.startsWith("image/");
            const isPdf = att.contentType === "application/pdf";

            if (isImage && att.url) {
              return (
                <div key={i} className="relative">
                  <img
                    src={att.url}
                    alt={att.name || "Attached image"}
                    className="max-w-[200px] max-h-[150px] rounded-lg object-cover border border-black/20"
                  />
                  {att.name && (
                    <div className="text-xs text-black/60 mt-1 truncate max-w-[200px]">
                      {att.name}
                    </div>
                  )}
                </div>
              );
            }

            return (
              <div
                key={i}
                className="flex items-center gap-2 px-3 py-2 bg-black/10 rounded-lg text-sm"
              >
                {isPdf ? (
                  <FileText className="w-4 h-4 text-black/60" />
                ) : (
                  <FileIcon className="w-4 h-4 text-black/60" />
                )}
                <span className="text-black/80 max-w-[150px] truncate">
                  {att.name || "Attachment"}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {/* Text content */}
      {text && <p className="whitespace-pre-wrap">{text}</p>}
    </div>
  );
}

function AssistantMessage({ parts, storedToolCalls, onApprove, onReject }) {
  if (!parts || parts.length === 0) return null;

  // Check if we have live tool parts (from streaming) or need to use stored data
  const hasLiveToolParts = parts.some(p =>
    (p.type?.startsWith('tool-') || p.type === 'dynamic-tool')
  );

  // If we have stored tool calls but no live tool parts, render from stored data
  if (!hasLiveToolParts && storedToolCalls?.length) {
    return <StoredToolCallsMessage parts={parts} storedToolCalls={storedToolCalls} />;
  }

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

  // Group consecutive tool calls with same toolName into batches (only if 2+ calls)
  const groupedParts = [];
  let currentToolGroup = null;

  // Helper to flush current group
  const flushGroup = () => {
    if (!currentToolGroup) return;
    // Only create a group if there are 2+ parts, otherwise push as single part
    if (currentToolGroup.parts.length >= 2) {
      groupedParts.push(currentToolGroup);
    } else {
      // Single part - push it directly (not as group)
      groupedParts.push(currentToolGroup.parts[0]);
    }
    currentToolGroup = null;
  };

  for (const part of dedupedParts) {
    const isToolPart = part.type?.startsWith("tool-") || part.type === "dynamic-tool";
    const toolName = part.toolName || part.type?.replace("tool-", "");
    const hasOutput = part.state === "output-available";

    // Check if we should group this with the previous tool calls
    if (isToolPart && hasOutput && currentToolGroup && currentToolGroup.toolName === toolName) {
      // Add to existing group
      currentToolGroup.parts.push(part);
    } else {
      // Flush current group if exists
      flushGroup();

      if (isToolPart && hasOutput) {
        // Start new potential group
        currentToolGroup = { type: "tool-group", toolName, parts: [part] };
      } else {
        // Non-groupable part
        groupedParts.push(part);
      }
    }
  }
  // Flush final group
  flushGroup();

  // Check if we have any text content
  const hasText = dedupedParts.some(p => p.type === 'text' && p.text?.trim());
  const hasToolResults = dedupedParts.some(p =>
    (p.type?.startsWith('tool-') || p.type === 'dynamic-tool') &&
    p.state === 'output-available'
  );

  // Separate text parts from tool parts
  const textParts = groupedParts.filter(p => p.type === 'text' && p.text?.trim());
  const toolParts = groupedParts.filter(p => 
    p.type === 'tool-group' || 
    p.type?.startsWith('tool-') || 
    p.type === 'dynamic-tool'
  );
  const otherParts = groupedParts.filter(p => 
    p.type !== 'text' && 
    p.type !== 'tool-group' && 
    !p.type?.startsWith('tool-') && 
    p.type !== 'dynamic-tool'
  );

  return (
    <div className="w-full space-y-2">
      {/* Other parts (like reasoning) */}
      {otherParts.map((part, i) => (
        <AssistantPart
          key={part.toolCallId || part.id || `other-${i}-${part.type}`}
          part={part}
          onApprove={onApprove}
          onReject={onReject}
        />
      ))}

      {/* Tool calls - always shown expanded */}
      {toolParts.map((part, i) => {
        if (part.type === "tool-group") {
          return (
            <GroupedToolCallDisplay
              key={`group-${i}-${part.toolName}`}
              toolName={part.toolName}
              parts={part.parts}
            />
          );
        }
        return (
          <AssistantPart
            key={part.toolCallId || part.id || `tool-${i}-${part.type}`}
            part={part}
            onApprove={onApprove}
            onReject={onReject}
          />
        );
      })}

      {/* Text content - show prominently */}
      {textParts.map((part, i) => (
        <AssistantPart
          key={`text-${i}`}
          part={part}
          onApprove={onApprove}
          onReject={onReject}
        />
      ))}

      {/* Show a subtle message if there's only tool output and no explanation */}
      {!hasText && hasToolResults && (
        <p className="text-white/30 text-xs italic mt-2">
          ↑ API response above
        </p>
      )}
    </div>
  );
}

// Render messages with stored tool calls (from database after page refresh)
function StoredToolCallsMessage({ parts, storedToolCalls }) {

  // Get any text content from parts
  const textContent = parts
    .filter(p => p.type === 'text')
    .map(p => p.text)
    .join('')
    .trim();

  // Check if text is just a summary we generated (starts with "Called:")
  const isAutoSummary = textContent.startsWith('Called:');

  // Filter to only tool calls with results for display
  // We check that result exists and has a body (even if body is empty/null, we want to show it)
  const displayableToolCalls = storedToolCalls.filter(tc => tc.result && 'body' in tc.result);


  return (
    <div className="w-full space-y-2">
      {/* Render stored tool calls as rich displays */}
      {displayableToolCalls.map((tc, i) => {
        // Reconstruct the _actionchat format from stored data
        const output = tc.result ? {
          _actionchat: {
            response_body: tc.result.body,
            response_status: tc.result.status,
            method: tc.result.method || 'GET',
            url: tc.result.url,
            tool_name: tc.result.tool_name || tc.tool_name,
            tool_id: tc.result.tool_id,
            source_id: tc.result.source_id,
            duration_ms: tc.result.duration_ms,
          }
        } : null;

        return (
          <ToolCallDisplay
            key={tc.id || `stored-${i}`}
            toolName={tc.tool_name}
            input={tc.arguments}
            output={output}
            state={output ? "output-available" : "completed"}
            toolId={tc.result?.tool_id}
            sourceId={tc.result?.source_id}
          />
        );
      })}
      {/* Show text content if it's not just our auto-generated summary */}
      {textContent && !isAutoSummary && (
        <div className="prose prose-invert prose-sm max-w-none">
          <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>{textContent}</ReactMarkdown>
        </div>
      )}
      {/* Show hint for historical tool results */}
      {displayableToolCalls.length > 0 && (
        <p className="text-white/30 text-xs italic mt-2">
          ↑ API response above
        </p>
      )}
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
        <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>{part.text}</ReactMarkdown>
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
    // Pass toolId and sourceId from output metadata for pagination support
    const actionMeta = part.output?._actionchat;
    return (
      <ToolCallDisplay
        toolName={toolName}
        input={part.input}
        output={part.output}
        state={part.state}
        toolId={actionMeta?.tool_id}
        sourceId={actionMeta?.source_id}
      />
    );
  }

  // Step start markers
  if (part.type === "step-start") {
    return null; // Hide step boundaries
  }

  return null;
}
