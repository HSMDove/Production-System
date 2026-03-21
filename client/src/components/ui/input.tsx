import * as React from "react"

import { cn } from "@/lib/utils"

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => {
    // h-9 to match icon buttons and default buttons.
    return (
      <input
        type={type}
        className={cn(
          "flex h-12 w-full rounded-[16px] border-[3px] border-black/90 bg-background px-4 py-2 text-base font-bold ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground/85 shadow-[0_4px_0_0_rgba(0,0,0,0.82)] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring/20 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Input.displayName = "Input"

export { Input }
