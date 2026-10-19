"use client"

import { useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { Menu, type LucideIcon } from "lucide-react"
import { cn } from "@/lib/utils"
import { Logo } from "@/components/brand/logo"
import { ThemeToggle } from "@/components/theme-toggle"
import { UserMenu } from "@/components/layout/user-menu"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetDescription, SheetTitle, SheetTrigger } from "@/components/ui/sheet"

export type NavItem = { href: string; label: string; icon: LucideIcon; exact?: boolean; badge?: number }

function NavLinks({ items, onNavigate }: { items: NavItem[]; onNavigate?: () => void }) {
  const pathname = usePathname()
  return (
    <nav className="grid gap-1">
      {items.map(({ href, label, icon: Icon, exact, badge }) => {
        const active = exact ? pathname === href : pathname === href || pathname.startsWith(`${href}/`)
        return (
          <Link
            key={href}
            href={href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={cn(
              "group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
              active ? "bg-white/10 text-chrome-foreground" : "text-chrome-muted hover:bg-white/5 hover:text-chrome-foreground"
            )}
          >
            <span
              aria-hidden
              className={cn(
                "absolute top-2 bottom-2 left-0 w-1 rounded-r-full bg-honey transition-transform",
                active ? "scale-y-100" : "scale-y-0"
              )}
            />
            <Icon className={cn("size-[18px]", active && "text-honey")} />
            <span className="flex-1">{label}</span>
            {!!badge && (
              <span className="min-w-5 rounded-full bg-primary px-1.5 py-0.5 text-center text-[11px] font-bold text-white tabular-nums">
                {badge > 99 ? "99+" : badge}
              </span>
            )}
          </Link>
        )
      })}
    </nav>
  )
}

export function AppShell({
  nav,
  home,
  subtitle,
  children,
}: {
  nav: NavItem[]
  home: string
  subtitle?: string
  children: React.ReactNode
}) {
  const [open, setOpen] = useState(false)
  const totalBadge = nav.reduce((n, i) => n + (i.badge ?? 0), 0)

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[264px_1fr] lg:bg-[linear-gradient(to_right,var(--chrome)_264px,transparent_264px)]">
      <aside className="sticky top-0 hidden h-screen flex-col overflow-hidden bg-chrome p-4 lg:flex">
        <Logo href={home} tone="chrome" className="px-2 py-1.5" />
        {subtitle && <p className="mt-2 truncate px-2 text-xs text-chrome-muted">{subtitle}</p>}
        <div className="mt-8">
          <NavLinks items={nav} />
        </div>
        <svg aria-hidden viewBox="0 0 200 200" className="mt-auto -mb-16 -ml-16 size-56 opacity-60">
          <circle cx="100" cy="100" r="90" fill="#F4D6CC" opacity="0.06" />
          <circle cx="100" cy="100" r="62" fill="none" stroke="#F4B860" strokeWidth="1.5" opacity="0.35" />
          <circle cx="100" cy="100" r="40" fill="none" stroke="#C83E4D" strokeWidth="6" opacity="0.5" />
        </svg>
      </aside>

      <div className="flex min-w-0 flex-col">
        <header className="sticky top-0 z-30 flex h-16 items-center gap-2 border-b bg-background/85 px-4 backdrop-blur sm:px-6">
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="relative lg:hidden" aria-label="Open menu">
                <Menu />
                {totalBadge > 0 && <span className="absolute top-1.5 right-1.5 size-2.5 rounded-full bg-primary ring-2 ring-background" />}
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="border-0 bg-chrome p-4">
              <SheetTitle className="sr-only">Navigation</SheetTitle>
              <SheetDescription className="sr-only">Main navigation</SheetDescription>
              <Logo href={home} tone="chrome" className="px-2 py-1.5" />
              {subtitle && <p className="-mt-2 truncate px-2 text-xs text-chrome-muted">{subtitle}</p>}
              <NavLinks items={nav} onNavigate={() => setOpen(false)} />
            </SheetContent>
          </Sheet>
          <Logo href={home} className="lg:hidden" />
          <div className="ml-auto flex items-center gap-1">
            <ThemeToggle />
            <UserMenu />
          </div>
        </header>
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6 sm:py-9">{children}</main>
      </div>
    </div>
  )
}
