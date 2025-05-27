import React, { useState, useRef, useEffect } from "react";

interface FieldInfoTooltipProps {
  description: string;
}

const FieldInfoTooltip: React.FC<FieldInfoTooltipProps> = ({ description }) => {
  const [showTooltip, setShowTooltip] = useState(false);
  const tooltipRef = useRef<HTMLDivElement>(null);
  const linkRef = useRef<HTMLSpanElement>(null);
  const containerRef = useRef<HTMLSpanElement>(null);

  // Handle click outside to close tooltip
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        tooltipRef.current &&
        !tooltipRef.current.contains(event.target as Node) &&
        linkRef.current &&
        !linkRef.current.contains(event.target as Node)
      ) {
        setShowTooltip(false);
      }
    };

    if (showTooltip) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showTooltip]);

  // Position tooltip when it becomes visible
  useEffect(() => {
    if (showTooltip && tooltipRef.current && linkRef.current) {
      const linkRect = linkRef.current.getBoundingClientRect();
      
      tooltipRef.current.style.left = `${linkRect.right + 10}px`;
      tooltipRef.current.style.top = `${linkRect.top - 5}px`;
    }
  }, [showTooltip]);

  const toggleTooltip = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setShowTooltip(!showTooltip);
  };

  return (
    <span ref={containerRef} style={{ position: "relative" }}>
      <span
        ref={linkRef}
        onClick={toggleTooltip}
        style={{
          display: "inline-block",
          marginLeft: "5px",
          color: "#0066cc",
          cursor: "pointer",
          fontSize: "12px",
        }}
      >
        info
      </span>
      
      {showTooltip && (
        <div
          ref={tooltipRef}
          style={{
            position: "fixed",
            backgroundColor: "#fff",
            border: "1px solid #ddd",
            borderRadius: "4px",
            padding: "10px",
            boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
            zIndex: 1000,
            width: "250px",
            fontSize: "12px",
            color: "#333",
          }}
        >
          {description}
        </div>
      )}
    </span>
  );
};

export default FieldInfoTooltip;