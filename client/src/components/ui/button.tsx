import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap text-sm font-black focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0 select-none" +
  " rounded-[1.25rem] transition-all duration-100",
  {
    variants: {
      variant: {
        default:
          "border-4 border-foreground bg-primary text-primary-foreground shadow-brutal active:translate-x-[3px] active:translate-y-[3px] active:shadow-none",
        destructive:
          "border-4 border-foreground bg-destructive text-destructive-foreground shadow-brutal active:translate-x-[3px] active:translate-y-[3px] active:shadow-none",
        outline:
          "border-4 border-foreground bg-card shadow-brutal active:translate-x-[3px] active:translate-y-[3px] active:shadow-none",
        secondary: "border-4 border-foreground bg-secondary text-secondary-foreground shadow-brutal active:translate-x-[3px] active:translate-y-[3px] active:shadow-none",
        ghost: "border-4 border-foreground bg-transparent hover:bg-muted shadow-brutal-sm active:translate-x-[2px] active:translate-y-[2px] active:shadow-none",
      },
      size: {
        default: "min-h-11 px-5 py-2.5",
        sm: "min-h-9 px-4 text-xs",
        lg: "min-h-12 px-8 text-base",
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
