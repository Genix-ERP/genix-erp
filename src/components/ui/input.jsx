import * as React from "react"

import { cn } from "@/lib/utils"

const Input = React.forwardRef(({ className, type, onFocus, ...props }, ref) => {
  const handleFocus = (e) => {
    // Auto-select content on focus for numeric inputs so user can type immediately
    if (type === 'number' || props.inputMode === 'decimal' || props.inputMode === 'numeric') {
      e.target.select();
    }
    onFocus?.(e);
  };

  return (
    (<input
      type={type}
      className={cn(
        "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
        className
      )}
      ref={ref}
      onFocus={handleFocus}
      {...props} />)
  );
})
Input.displayName = "Input"

export { Input }
