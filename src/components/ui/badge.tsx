import { cn } from "@/lib/utils"

interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: "normal" | "suspicious" | "scam" | "default"
}

export function Badge({ variant = "default", className, ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold font-data",
        variant === "normal" && "badge-normal",
        variant === "suspicious" && "badge-suspicious",
        variant === "scam" && "badge-scam",
        variant === "default" && "bg-secondary text-secondary-foreground",
        className
      )}
      {...props}
    />
  )
}