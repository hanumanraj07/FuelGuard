import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90 shadow-[0_0_20px_hsl(160_100%_45%/0.2)] hover:shadow-[0_0_30px_hsl(160_100%_45%/0.35)]",
        destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90 shadow-[0_0_20px_hsl(0_84%_60%/0.2)]",
        outline: "border border-border bg-transparent text-foreground hover:bg-accent hover:text-accent-foreground",
        secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        ghost: "text-foreground hover:bg-accent hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline",
        hero: "bg-primary text-primary-foreground font-semibold text-base px-8 py-3 rounded-lg shadow-[0_0_30px_hsl(160_100%_45%/0.3)] hover:shadow-[0_0_50px_hsl(160_100%_45%/0.5)] hover:scale-[1.02] active:scale-[0.98] transition-all duration-200",
        "hero-secondary": "bg-transparent border border-[hsl(0_0%_100%/0.15)] text-foreground hover:bg-[hsl(0_0%_100%/0.05)] hover:border-[hsl(0_0%_100%/0.25)] font-medium text-base px-8 py-3 rounded-lg transition-all duration-200",
        danger: "bg-destructive text-destructive-foreground font-semibold shadow-[0_0_20px_hsl(0_84%_60%/0.3)] hover:shadow-[0_0_30px_hsl(0_84%_60%/0.5)]",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-md px-3",
        lg: "h-11 rounded-md px-8",
        xl: "h-12 rounded-lg px-10 text-base",
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
    VariantProps<typeof buttonVariants> {}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => {
    return (
      <button
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }