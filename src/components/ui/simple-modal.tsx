import React, { useEffect } from "react";
import { X } from "lucide-react";

interface SimpleModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}

export function SimpleModal({ open, onClose, title, children, footer }: SimpleModalProps) {
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, onClose]);

  if (!open) return null;

  console.log("[SimpleModal] Rendering:", title);

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 9990 }}>
      {/* Overlay */}
      <div
        onClick={onClose}
        style={{
          position: "absolute",
          inset: 0,
          backgroundColor: "rgba(0,0,0,0.6)",
        }}
      />
      {/* Content */}
      <div
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          width: "calc(100% - 2rem)",
          maxWidth: "28rem",
          maxHeight: "85vh",
          overflowY: "auto",
          backgroundColor: "hsl(230, 15%, 28%)",
          color: "hsl(210, 40%, 98%)",
          borderRadius: "0.5rem",
          padding: "1.5rem",
          zIndex: 9995,
          border: "1px solid rgba(255,255,255,0.1)",
        }}
      >
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
          <h2 style={{ fontSize: "1.125rem", fontWeight: 600, margin: 0 }}>{title}</h2>
          <button
            onClick={onClose}
            style={{
              background: "none",
              border: "none",
              color: "inherit",
              cursor: "pointer",
              opacity: 0.7,
              padding: "4px",
            }}
          >
            <X style={{ width: 16, height: 16 }} />
          </button>
        </div>
        {/* Body */}
        {children}
        {/* Footer */}
        {footer && (
          <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem", marginTop: "1rem" }}>
            {footer}
          </div>
        )}
      </div>
    </div>
  );
}
