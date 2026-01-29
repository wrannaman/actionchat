"use client";

import { useEffect } from "react";

export default function GlobalError({ error, reset }) {
  useEffect(() => {
    console.error("Global error:", error);
  }, [error]);

  return (
    <html>
      <body style={{ backgroundColor: "#0a0a0f", color: "white", fontFamily: "system-ui, sans-serif" }}>
        <div style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "24px",
          textAlign: "center"
        }}>
          <div style={{ maxWidth: "400px" }}>
            <div style={{
              width: "64px",
              height: "64px",
              borderRadius: "50%",
              backgroundColor: "rgba(239, 68, 68, 0.1)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 24px"
            }}>
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: "#f87171" }}>
                <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/>
                <line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/>
              </svg>
            </div>
            <h1 style={{ fontSize: "24px", fontWeight: "bold", marginBottom: "8px" }}>
              Critical Error
            </h1>
            <p style={{ color: "rgba(255,255,255,0.4)", marginBottom: "24px" }}>
              The application encountered a critical error. Please refresh the page.
            </p>
            <button
              onClick={reset}
              style={{
                backgroundColor: "#3b82f6",
                color: "white",
                padding: "12px 24px",
                borderRadius: "8px",
                border: "none",
                cursor: "pointer",
                fontWeight: "bold"
              }}
            >
              Refresh Page
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
