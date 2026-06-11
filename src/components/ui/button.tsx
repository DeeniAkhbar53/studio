
import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-semibold ring-offset-background transition-all duration-200 hover:-translate-y-px active:translate-y-0 active:scale-[0.99] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/70 focus-visible:ring-offset-0 disabled:pointer-events-none disabled:opacity-50 disabled:shadow-none disabled:hover:translate-y-0",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground shadow-lg shadow-primary/20 hover:bg-primary/95 hover:shadow-xl hover:shadow-primary/25",
        destructive:
          "bg-destructive text-destructive-foreground shadow-lg shadow-destructive/15 hover:bg-destructive/90 hover:shadow-xl hover:shadow-destructive/20",
        outline:
          "border border-border/70 bg-background/45 shadow-sm backdrop-blur-md hover:bg-accent/70 hover:text-accent-foreground hover:shadow-md",
        secondary:
          "border border-border/60 bg-secondary/75 text-secondary-foreground shadow-sm backdrop-blur-md hover:bg-secondary/90 hover:shadow-md",
        ghost: "hover:bg-accent/65 hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-md px-3",
        lg: "h-11 rounded-md px-8",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
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
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }

    
