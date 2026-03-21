import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap text-sm font-black tracking-[-0.01em] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 rounded-[16px] border-[3px] border-black transition-all duration-150 select-none",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground shadow-[6px_6px_0_0_#000] hover:-translate-x-[2px] hover:-translate-y-[2px] hover:shadow-[8px_8px_0_0_#000] active:translate-x-[3px] active:translate-y-[3px] active:shadow-[2px_2px_0_0_#000]",
        destructive:
          "bg-destructive text-destructive-foreground shadow-[6px_6px_0_0_#000] hover:-translate-x-[2px] hover:-translate-y-[2px] hover:shadow-[8px_8px_0_0_#000] active:translate-x-[3px] active:translate-y-[3px] active:shadow-[2px_2px_0_0_#000]",
        outline:
          "bg-card text-foreground shadow-[6px_6px_0_0_#000] hover:bg-secondary hover:-translate-x-[2px] hover:-translate-y-[2px] hover:shadow-[8px_8px_0_0_#000] active:translate-x-[3px] active:translate-y-[3px] active:shadow-[2px_2px_0_0_#000]",
        secondary:
          "bg-secondary text-secondary-foreground shadow-[6px_6px_0_0_#000] hover:-translate-x-[2px] hover:-translate-y-[2px] hover:shadow-[8px_8px_0_0_#000] active:translate-x-[3px] active:translate-y-[3px] active:shadow-[2px_2px_0_0_#000]",
        ghost:
          "bg-popover/95 text-foreground shadow-[4px_4px_0_0_#000] hover:bg-accent hover:-translate-x-[1px] hover:-translate-y-[1px] hover:shadow-[6px_6px_0_0_#000] active:translate-x-[2px] active:translate-y-[2px] active:shadow-[2px_2px_0_0_#000]",
      },
      size: {
        default: "min-h-11 px-5 py-2.5",
        sm: "min-h-9 rounded-[14px] px-3.5 text-xs",
        lg: "min-h-12 px-8 text-base",
        icon: "h-11 w-11 rounded-[16px]",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  },
)
Button.displayName = "Button"

export { Button, buttonVariants }
