"use client";

import { useState, useEffect, useCallback } from "react";
import {
  isSlashCommand,
  extractCommandName,
  getAutocompleteSuggestions,
  parseSlashCommand,
  getParameterHints,
} from "@/lib/slash-command-parser";

/**
 * Hook to manage slash command state and autocomplete.
 * @param {object} options
 * @param {string} options.agentId - Agent ID to fetch tools for
 */
export function useSlashCommands({ agentId } = {}) {
  const [tools, setTools] = useState([]);
  const [loadingTools, setLoadingTools] = useState(false);
  const [error, setError] = useState(null);

  // Autocomplete state
  const [showAutocomplete, setShowAutocomplete] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [selectedTool, setSelectedTool] = useState(null);

  // Fetch tools on mount
  useEffect(() => {
    if (!agentId) return;

    const fetchTools = async () => {
      setLoadingTools(true);
      try {
        const res = await fetch(`/api/workspace/tools?agent_id=${agentId}`);
        if (res.ok) {
          const data = await res.json();
          setTools(data.tools || []);
        }
      } catch (err) {
        console.error("[useSlashCommands] Error fetching tools:", err);
        setError(err.message);
      } finally {
        setLoadingTools(false);
      }
    };

    fetchTools();
  }, [agentId]);

  // Handle input change - update autocomplete
  const handleInputChange = useCallback((input) => {
    if (isSlashCommand(input)) {
      const matches = getAutocompleteSuggestions(input, tools, 5);
      setSuggestions(matches);
      setShowAutocomplete(matches.length > 0);
      setSelectedIndex(0);

      // If exact match, show parameter hints
      const commandName = extractCommandName(input);
      if (commandName && matches.length > 0) {
        const exactMatch = matches.find(t =>
          t.name.toLowerCase().includes(commandName.toLowerCase())
        );
        setSelectedTool(exactMatch || null);
      }
    } else {
      setShowAutocomplete(false);
      setSuggestions([]);
      setSelectedTool(null);
    }
  }, [tools]);

  // Handle keyboard navigation
  const handleKeyDown = useCallback((e) => {
    if (!showAutocomplete) return null;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex(i => Math.min(i + 1, suggestions.length - 1));
      return "handled";
    }

    if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex(i => Math.max(i - 1, 0));
      return "handled";
    }

    if (e.key === "Tab" || e.key === "Enter") {
      if (suggestions[selectedIndex]) {
        e.preventDefault();
        return { type: "select", tool: suggestions[selectedIndex] };
      }
    }

    if (e.key === "Escape") {
      e.preventDefault();
      setShowAutocomplete(false);
      return "handled";
    }

    return null;
  }, [showAutocomplete, suggestions, selectedIndex]);

  // Select a tool from autocomplete
  const selectTool = useCallback((tool) => {
    setSelectedTool(tool);
    setShowAutocomplete(false);
    return `/${tool.name.replace(/\([^)]*\)/g, "").trim().toLowerCase().replace(/\s+/g, "-")} `;
  }, []);

  // Parse and execute a slash command
  const parseCommand = useCallback((input) => {
    return parseSlashCommand(input, tools);
  }, [tools]);

  // Close autocomplete
  const closeAutocomplete = useCallback(() => {
    setShowAutocomplete(false);
  }, []);

  return {
    tools,
    loadingTools,
    error,

    // Autocomplete
    showAutocomplete,
    suggestions,
    selectedIndex,
    selectedTool,
    handleInputChange,
    handleKeyDown,
    selectTool,
    closeAutocomplete,

    // Parsing
    parseCommand,
    isSlashCommand,
    getParameterHints,
  };
}
