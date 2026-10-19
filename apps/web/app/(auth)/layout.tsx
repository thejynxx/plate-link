import { Logo } from "@/components/brand/logo"
import { ThemeToggle } from "@/components/theme-toggle"

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-screen lg:grid-cols-[1fr_minmax(380px,0.8fr)]">
      <div className="flex flex-col">
        <header className="flex items-center justify-between px-4 py-5 sm:px-8">
          <Logo />
          <ThemeToggle />
        </header>
        <main className="flex flex-1 items-start justify-center px-4 pt-4 pb-16 sm:items-center sm:px-8 sm:pt-0">
          {children}
        </main>
      </div>
      <aside className="relative hidden overflow-hidden bg-chrome text-chrome-foreground lg:flex lg:flex-col lg:justify-end lg:p-12">
        <svg aria-hidden viewBox="0 0 400 400" className="absolute -top-24 -right-24 size-[520px] opacity-90">
          <circle cx="200" cy="200" r="180" fill="#F4D6CC" opacity="0.08" />
          <circle cx="200" cy="200" r="132" fill="none" stroke="#F4B860" strokeWidth="2" opacity="0.5" />
          <circle cx="200" cy="200" r="92" fill="none" stroke="#C83E4D" strokeWidth="10" opacity="0.85" />
        </svg>
        <div className="relative max-w-[30ch]">
          <p className="font-display text-3xl leading-tight font-semibold">
            Thirty plates binned after lunch could be dinner at a shelter two streets away.
          </p>
          <p className="mt-5 text-sm text-chrome-muted">Plate-Link gets them there before they expire.</p>
        </div>
      </aside>
    </div>
  )
}
