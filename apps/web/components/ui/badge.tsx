import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const badgeVariants = cva(
  "inline-flex w-fit shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold leading-none [&>svg]:size-3",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground",
        honey: "bg-honey text-gunmetal",
        silk: "bg-silk text-[#8f2a36] dark:bg-[#4a3a37] dark:text-silk",
        iron: "bg-iron text-white",
        gunmetal: "bg-gunmetal text-silk dark:bg-silk dark:text-gunmetal",
        muted: "bg-muted text-muted-foreground ring-1 ring-border ring-inset",
        outline: "text-foreground ring-1 ring-border-strong ring-inset",
        destructive: "bg-muted text-destructive ring-1 ring-destructive/40 ring-inset",
        // legacy names used across Phase-1 code
        secondary: "bg-secondary text-secondary-foreground",
        success: "bg-honey text-gunmetal",
        warning: "bg-silk text-[#8f2a36] dark:bg-[#4a3a37] dark:text-silk",
        info: "bg-iron text-white",
      },
    },
    defaultVariants: { variant: "default" },
  }
)

function Badge({ className, variant, ...props }: React.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return <span data-slot="badge" className={cn(badgeVariants({ variant }), className)} {...props} />
}

export { Badge, badgeVariants }
