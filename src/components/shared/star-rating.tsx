"use client";

import { useState } from "react";
import { Star } from "lucide-react";
import { motion } from "motion/react";
import { cn } from "@/lib/utils";

type StarRatingProps = {
  value: number;
  onChange: (value: number) => void;
  label: string;
  disabled?: boolean;
  size?: "sm" | "md";
};

export function StarRating({
  value,
  onChange,
  label,
  disabled = false,
  size = "md",
}: StarRatingProps) {
  const [hoverValue, setHoverValue] = useState(0);
  const activeValue = hoverValue || value;
  const iconSize = size === "sm" ? "size-5" : "size-7";

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium text-foreground">{label}</p>
      <div
        className="flex items-center gap-1"
        role="radiogroup"
        aria-label={label}
        onMouseLeave={() => setHoverValue(0)}
      >
        {Array.from({ length: 5 }, (_, index) => {
          const starValue = index + 1;
          const filled = starValue <= activeValue;
          return (
            <motion.button
              key={starValue}
              type="button"
              role="radio"
              aria-checked={value === starValue}
              aria-label={`${starValue} star${starValue === 1 ? "" : "s"}`}
              disabled={disabled}
              className={cn(
                "rounded-md p-0.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-60",
                filled ? "text-amber-500" : "text-muted-foreground/40",
              )}
              whileHover={disabled ? undefined : { scale: 1.08 }}
              whileTap={disabled ? undefined : { scale: 0.95 }}
              onMouseEnter={() => {
                if (!disabled) setHoverValue(starValue);
              }}
              onFocus={() => {
                if (!disabled) setHoverValue(starValue);
              }}
              onBlur={() => setHoverValue(0)}
              onClick={() => onChange(starValue)}
            >
              <Star className={cn(iconSize, filled ? "fill-current" : "fill-transparent")} />
            </motion.button>
          );
        })}
        <span className="ml-2 text-sm text-muted-foreground">
          {activeValue > 0 ? `${activeValue}/5` : "Hover to rate"}
        </span>
      </div>
    </div>
  );
}

export function StarRatingDisplay({
  value,
  size = "sm",
}: {
  value: number | null;
  size?: "sm" | "md";
}) {
  if (value == null) {
    return <span className="text-sm text-muted-foreground">No response</span>;
  }
  const iconSize = size === "sm" ? "size-4" : "size-5";
  return (
    <div className="inline-flex items-center gap-0.5" aria-label={`${value} out of 5 stars`}>
      {Array.from({ length: 5 }, (_, index) => {
        const filled = index + 1 <= value;
        return (
          <Star
            key={index}
            className={cn(
              iconSize,
              filled ? "fill-amber-500 text-amber-500" : "fill-transparent text-muted-foreground/30",
            )}
          />
        );
      })}
    </div>
  );
}
