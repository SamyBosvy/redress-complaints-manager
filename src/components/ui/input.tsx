import * as React from "react";

import { cn } from "@/lib/utils";
import { FieldContext } from '@/lib/field-context';

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => {
    const field = React.useContext(FieldContext);
    return (
      <input
        type={type}
        className={cn(
          "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
          className,
        )}
        ref={ref}
        id={props['aria-label'] ? undefined : field}
        aria-labelledby={field && !props['aria-label'] ? `${field}-label` : undefined}
        {...props}
      />
    );
  },
);
Input.displayName = "Input";

export { Input };
