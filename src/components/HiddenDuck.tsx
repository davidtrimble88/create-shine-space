import { useState, useRef } from "react";

/**
 * HiddenDuck — a tiny easter egg.
 *
 * Renders a 🦆 emoji tucked into the page (small, low opacity, no pointer
 * affordance). Clicking it makes the duck pop large and dance for ~4s,
 * then it returns to its hidden state.
 *
 * Default placement: bottom-left footer area. Override with `className`.
 */
const HiddenDuck = ({ className = "" }: { className?: string }) => {
  const [dancing, setDancing] = useState(false);
  const timeoutRef = useRef<number | null>(null);

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    if (dancing) return;
    setDancing(true);
    if (timeoutRef.current) window.clearTimeout(timeoutRef.current);
    timeoutRef.current = window.setTimeout(() => setDancing(false), 4000);
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label="🦆"
      title=""
      className={`fixed bottom-3 left-3 z-[60] select-none bg-transparent border-0 p-0 leading-none cursor-default ${
        dancing
          ? "text-6xl opacity-100 animate-duck-dance"
          : "text-xs opacity-20 hover:opacity-40 transition-opacity"
      } ${className}`}
      style={{ transformOrigin: "center" }}
    >
      🦆
    </button>
  );
};

export default HiddenDuck;
