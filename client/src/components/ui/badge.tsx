import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const badgeVariants = cva(
  // Whitespace-nowrap: Badges should never wrap.
  "inline-flex items-center whitespace-nowrap rounded-full border-[3px] border-black/90 px-3 py-1 text-xs font-black transition-colors focus:outline-none focus:ring-4 focus:ring-ring/20 shadow-[3px_3px_0_0_rgba(0,0,0,0.82)]",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground",
        secondary: "bg-secondary text-secondary-foreground",
        destructive:
          "bg-destructive text-destructive-foreground",

        outline: "bg-background text-foreground",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props} />
  );
}

export { Badge, badgeVariants }
