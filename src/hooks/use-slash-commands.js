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
 * Supports both tools (API endpoints) and routines (saved prompts).
 *
 * @param {object} options
 * @param {string} options.agentId - Agent ID to fetch tools for
 */
export function useSlashCommands({ agentId } = {}) {
  const [tools, setTools] = useState([]);
  const [routines, setRoutines] = useState([]);
  const [loadingTools, setLoadingTools] = useState(false);
  const [error, setError] = useState(null);

  // Autocomplete state
  const [showAutocomplete, setShowAutocomplete] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [selectedTool, setSelectedTool] = useState(null);

  // Fetch tools and routines on mount
  useEffect(() => {
    if (!agentId) return;

    const fetchData = async () => {
      setLoadingTools(true);
      try {
        // Fetch tools and routines in parallel
        const [toolsRes, routinesRes] = await Promise.all([
          fetch(`/api/workspace/tools?agent_id=${agentId}`),
          fetch('/api/routines'),
        ]);

        if (toolsRes.ok) {
          const data = await toolsRes.json();
          setTools(data.tools || []);
        }

        if (routinesRes.ok) {
          const data = await routinesRes.json();
          // Convert routines to a tool-like format for autocomplete
          const routineItems = (data.routines || []).map(r => ({
            ...r,
            _isRoutine: true,
            name: r.name,
            description: r.description || r.prompt?.slice(0, 100),
            method: 'ROUTINE',
          }));
          setRoutines(routineItems);
        }
      } catch (err) {
        console.error("[useSlashCommands] Error fetching:", err);
        setError(err.message);
      } finally {
        setLoadingTools(false);
      }
    };

    fetchData();
  }, [agentId]);

  // Combined items for autocomplete (routines first, then tools)
  const allItems = [...routines, ...tools];

  // Handle input change - update autocomplete
  const handleInputChange = useCallback((input) => {
    if (isSlashCommand(input)) {
      // Get suggestions from both routines and tools
      const matches = getAutocompleteSuggestions(input, allItems, 8);
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
  }, [allItems]);

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

  // Select a tool or routine from autocomplete
  const selectTool = useCallback((item) => {
    setSelectedTool(item);
    setShowAutocomplete(false);

    // If it's a routine, return the prompt directly
    if (item._isRoutine) {
      // Track usage
      fetch(`/api/routines/${item.id}`, { method: 'POST' }).catch(() => {});
      return { type: 'routine', prompt: item.prompt, name: item.name };
    }

    // For tools, return the slash command format
    return {
      type: 'tool',
      command: `/${item.name.replace(/\([^)]*\)/g, "").trim().toLowerCase().replace(/\s+/g, "-")} `
    };
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
    routines,
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
