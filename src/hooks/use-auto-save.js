"use client";

import { useState, useEffect, useRef, useCallback } from "react";

/**
 * Auto-save hook with debounce and status indicator.
 *
 * @param {Object} options
 * @param {Object} options.data - Current form data
 * @param {Object} options.initialData - Initial data to compare against
 * @param {Function} options.onSave - Async function to save data
 * @param {number} options.debounceMs - Debounce delay (default 800ms)
 * @param {boolean} options.enabled - Whether auto-save is enabled (default true)
 *
 * @returns {Object} { status, saveNow }
 *   - status: 'idle' | 'saving' | 'saved' | 'error'
 *   - saveNow: Function to trigger immediate save
 */
export function useAutoSave({
  data,
  initialData,
  onSave,
  debounceMs = 800,
  enabled = true,
}) {
  const [status, setStatus] = useState("idle"); // idle | saving | saved | error
  const timeoutRef = useRef(null);
  const lastSavedRef = useRef(JSON.stringify(initialData));
  const isMountedRef = useRef(true);

  // Track mounted state
  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Clear saved indicator after delay
  useEffect(() => {
    if (status === "saved") {
      const timer = setTimeout(() => {
        if (isMountedRef.current) {
          setStatus("idle");
        }
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [status]);

  // Perform save
  const doSave = useCallback(async (dataToSave) => {
    const serialized = JSON.stringify(dataToSave);

    // Skip if unchanged
    if (serialized === lastSavedRef.current) {
      return;
    }

    setStatus("saving");

    try {
      await onSave(dataToSave);
      if (isMountedRef.current) {
        lastSavedRef.current = serialized;
        setStatus("saved");
      }
    } catch (err) {
      console.error("[AutoSave] Error:", err);
      if (isMountedRef.current) {
        setStatus("error");
      }
    }
  }, [onSave]);

  // Debounced save on data change
  useEffect(() => {
    if (!enabled) return;

    // Clear existing timeout
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }

    // Set new debounced save
    timeoutRef.current = setTimeout(() => {
      doSave(data);
    }, debounceMs);

    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
    };
  }, [data, debounceMs, enabled, doSave]);

  // Immediate save (for blur events)
  const saveNow = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    doSave(data);
  }, [data, doSave]);

  return { status, saveNow };
}
