import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap text-sm font-bold focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0" +
  " rounded-xl transition-all duration-100",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground border-[3px] border-foreground/80 shadow-[0_4px_0_0_hsl(var(--foreground)/0.7)] active:translate-y-[3px] active:shadow-[0_1px_0_0_hsl(var(--foreground)/0.7)]",
        destructive:
          "bg-destructive text-destructive-foreground border-[3px] border-foreground/60 shadow-[0_4px_0_0_hsl(var(--foreground)/0.5)] active:translate-y-[3px] active:shadow-[0_1px_0_0_hsl(var(--foreground)/0.5)]",
        outline:
          "border-[2px] border-foreground/30 shadow-[0_3px_0_0_hsl(var(--foreground)/0.15)] active:translate-y-[2px] active:shadow-[0_1px_0_0_hsl(var(--foreground)/0.15)] hover-elevate",
        secondary: "bg-secondary text-secondary-foreground border-[3px] border-foreground/60 shadow-[0_4px_0_0_hsl(var(--foreground)/0.5)] active:translate-y-[3px] active:shadow-[0_1px_0_0_hsl(var(--foreground)/0.5)]",
        ghost: "border border-transparent hover-elevate active-elevate-2",
      },
      size: {
        default: "min-h-9 px-4 py-2",
        sm: "min-h-8 px-3 text-xs",
        lg: "min-h-10 px-8",
        icon: "h-9 w-9",
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
