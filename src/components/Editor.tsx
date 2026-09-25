"use client";
import { useEffect, useRef, useState } from "react";

export interface EditorProps {
  initialCode: string;
  code?: string | null;
  highlight?: { startLine: number; endLine: number } | null;
  onChange: (code: string) => void;
}

export default function Editor({ initialCode, code, highlight, onChange }: EditorProps) {
  const [value, setValue] = useState(initialCode);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (code !== undefined && code !== null && code !== value) {
      setValue(code);
    }
  }, [code]);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    setValue(val);
    onChange(val);
  };

  const lines = value.split("\n");

  return (
    <div style={{ position: "relative", height: "100%", minHeight: "350px", display: "flex", fontFamily: "monospace", fontSize: "14px", lineHeight: "20px" }}>
      <div style={{ width: "48px", background: "rgba(0,0,0,0.05)", borderRight: "1px solid rgba(0,0,0,0.1)", textAlign: "right", paddingRight: "8px", userSelect: "none", color: "#888" }}>
        {lines.map((_, idx) => {
          const lineNum = idx + 1;
          const isHighlighted = highlight && lineNum >= highlight.startLine && lineNum <= highlight.endLine;
          return (
            <div
              key={idx}
              style={{
                height: "20px",
                background: isHighlighted ? "#fef08a" : "transparent",
                color: isHighlighted ? "#854d0e" : "inherit",
                fontWeight: isHighlighted ? "bold" : "normal"
              }}
            >
              {lineNum}
            </div>
          );
        })}
      </div>

      <div style={{ position: "relative", flex: 1, height: "100%" }}>
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, bottom: 0, pointerEvents: "none" }}>
          {lines.map((_, idx) => {
            const lineNum = idx + 1;
            const isHighlighted = highlight && lineNum >= highlight.startLine && lineNum <= highlight.endLine;
            return (
              <div
                key={idx}
                style={{
                  height: "20px",
                  background: isHighlighted ? "rgba(250, 204, 21, 0.25)" : "transparent",
                  borderLeft: isHighlighted ? "3px solid #eab308" : "none"
                }}
              />
            );
          })}
        </div>

        <textarea
          ref={textareaRef}
          value={value}
          onChange={handleChange}
          spellCheck={false}
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            background: "transparent",
            color: "inherit",
            border: "none",
            outline: "none",
            resize: "none",
            padding: "0 0 0 8px",
            fontFamily: "inherit",
            fontSize: "inherit",
            lineHeight: "20px",
            whiteSpace: "pre",
            overflow: "auto"
          }}
        />
      </div>
    </div>
  );
}