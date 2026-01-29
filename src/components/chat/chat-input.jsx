"use client";

import { useRef, useEffect } from "react";

export function ChatInput({ value, onChange, onSubmit, disabled, placeholder }) {
  const inputRef = useRef(null);

  useEffect(() => {
    if (!disabled) {
      inputRef.current?.focus();
    }
  }, [disabled]);

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      onSubmit?.(e);
    }
  };

  return (
    <div className="border-t border-white/5 bg-[#0d0d14] px-4 py-3 shrink-0">
      <div className="max-w-3xl mx-auto flex items-center gap-2">
        <span className="text-green-400 font-mono text-lg select-none shrink-0">
          ➜
        </span>
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={disabled}
          placeholder={placeholder || "Type a command..."}
          className="flex-1 bg-transparent border-none outline-none font-mono text-green-300 text-sm placeholder:text-white/20 disabled:opacity-40 disabled:cursor-not-allowed"
          autoFocus
        />
      </div>
    </div>
  );
}
