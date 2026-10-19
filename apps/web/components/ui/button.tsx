import * as React from "react"
import { Slot } from "radix-ui"
import { cva, type VariantProps } from "class-variance-authority"
import { Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"

/**
 * Tactile buttons: the solid variants sit on a darker "edge" and travel down
 * when pressed (see .btn-press in globals.css).
 */
const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-xl text-sm font-semibold outline-none disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default: "btn-press btn-shine bg-primary text-primary-foreground hover:bg-primary-hover [--edge:var(--primary-edge)]",
        accent: "btn-press btn-shine bg-accent text-accent-foreground [--edge:var(--accent-edge)]",
        dark: "btn-press bg-gunmetal text-silk [--edge:#1b1e20] dark:bg-silk dark:text-gunmetal dark:[--edge:#c9a89c]",
        destructive: "btn-press bg-destructive text-white [--edge:#7a1912]",
        outline:
          "btn-press border-2 border-border-strong bg-card text-foreground [--depth:3px] [--edge:var(--border-strong)] hover:border-foreground/40",
        secondary: "btn-press bg-secondary text-secondary-foreground [--depth:3px] [--edge:color-mix(in_oklab,var(--secondary),#000_18%)]",
        ghost: "transition-colors hover:bg-muted active:bg-border/60",
        link: "text-link underline-offset-4 hover:underline",
      },
      size: {
        default: "h-11 px-5",
        sm: "h-9 rounded-lg px-3.5 text-xs",
        lg: "h-12 px-7 text-base",
        icon: "size-10 rounded-xl",
        "icon-sm": "size-8 rounded-lg",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  }
)

type ButtonProps = React.ComponentProps<"button"> &
  VariantProps<typeof buttonVariants> & { asChild?: boolean; loading?: boolean }

function Button({ className, variant, size, asChild = false, loading = false, children, disabled, ...props }: ButtonProps) {
  const Comp = asChild ? Slot.Root : "button"
  return (
    <Comp
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      disabled={asChild ? undefined : disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {asChild ? (
        children
      ) : (
        <>
          {loading && <Loader2 className="animate-spin" />}
          {children}
        </>
      )}
    </Comp>
  )
}

export { Button, buttonVariants }
