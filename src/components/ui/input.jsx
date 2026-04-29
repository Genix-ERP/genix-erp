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
      // min-w-0 is critical: native <input> has an intrinsic
      // min-content width (driven by the `size` attribute, default
      // ~20 chars) which beats w-full in a flex container. Without
      // min-w-0, an Input inside a constrained flex column refuses
      // to shrink below ~150px and pushes the whole row past its
      // parent — that's what was making the create-PO line items
      // overflow horizontally even after the product combobox
      // truncated. Setting min-w-0 here lets every Input in the
      // app shrink to whatever its flex column allows.
      className={cn(
        "flex h-9 w-full min-w-0 rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
        className
      )}
      ref={ref}
      onFocus={handleFocus}
      {...props} />)
  );
})
Input.displayName = "Input"

export { Input }
