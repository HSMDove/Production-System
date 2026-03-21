import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-[16px] border-[3px] border-border text-sm font-black tracking-[-0.03em] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring/30 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 transition-[transform,box-shadow,background-color,border-color,color] duration-100",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground shadow-[0_5px_0_0_rgba(0,0,0,0.88)] hover:-translate-y-px active:translate-y-[3px] active:shadow-[0_1px_0_0_rgba(0,0,0,0.88)]",
        destructive:
          "bg-destructive text-destructive-foreground shadow-[0_5px_0_0_rgba(0,0,0,0.88)] hover:-translate-y-px active:translate-y-[3px] active:shadow-[0_1px_0_0_rgba(0,0,0,0.88)]",
        outline:
          "bg-card text-foreground shadow-[0_5px_0_0_rgba(0,0,0,0.88)] hover:-translate-y-px active:translate-y-[3px] active:shadow-[0_1px_0_0_rgba(0,0,0,0.88)]",
        secondary:
          "bg-secondary text-secondary-foreground shadow-[0_5px_0_0_rgba(0,0,0,0.88)] hover:-translate-y-px active:translate-y-[3px] active:shadow-[0_1px_0_0_rgba(0,0,0,0.88)]",
        ghost:
          "border-transparent bg-transparent text-foreground shadow-none hover:bg-muted/70 active:bg-muted",
      },
      size: {
        default: "min-h-11 px-4 py-2.5",
        sm: "min-h-10 px-3.5 text-sm",
        lg: "min-h-12 px-7 text-base",
        icon: "h-11 w-11",
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
