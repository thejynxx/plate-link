"use client"

import Link from "next/link"
import { useRouter } from "next/navigation"
import { useForm, useWatch } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { AnimatePresence, motion } from "framer-motion"
import { Bike, Building2, HandHeart, Smartphone } from "lucide-react"
import { toast } from "sonner"
import { registerSchema, type RegisterInput, type UserRole } from "@platelink/shared"
import { createClient } from "@/lib/supabase/client"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { FloatingInput } from "@/components/ui/input"

const ROLE_OPTIONS: { value: UserRole; title: string; body: string; icon: typeof Building2 }[] = [
  { value: "canteen", title: "Canteen", body: "I have surplus food", icon: Building2 },
  { value: "user", title: "NGO / shelter", body: "I want to receive food", icon: HandHeart },
  { value: "driver", title: "Driver", body: "I can deliver", icon: Bike },
]

const NAME_LABEL: Record<UserRole, string> = {
  canteen: "Your name",
  user: "Organisation name",
  driver: "Full name",
}

export function RegisterForm() {
  const router = useRouter()
  const {
    register,
    handleSubmit,
    control,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<RegisterInput>({
    resolver: zodResolver(registerSchema),
    defaultValues: { role: "canteen" },
  })
  const role = useWatch({ control, name: "role" })

  async function onSubmit({ email, password, ...profile }: RegisterInput) {
    const supabase = createClient()
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: profile, emailRedirectTo: `${window.location.origin}/auth/callback` },
    })
    if (error) {
      toast.error(error.message === "Failed to fetch" ? "Can't reach the server. Check your internet connection." : error.message)
      return
    }
    if (!data.session) {
      toast.success("Check your inbox to confirm your email, then log in.")
      router.replace("/login")
      return
    }
    toast.success("Account created")
    router.replace("/dashboard")
    router.refresh()
  }

  const err = (msg?: string) => (msg ? <p className="text-xs font-semibold text-destructive">{msg}</p> : null)

  return (
    <div className="w-full max-w-lg">
      <h1 className="text-[2.2rem] leading-tight font-bold tracking-tight">Join Plate-Link</h1>
      <p className="mt-2 text-muted-foreground">Pick how you&apos;ll use it. This can&apos;t be changed later.</p>

      <form onSubmit={handleSubmit(onSubmit)} className="mt-8 grid gap-5" noValidate>
        <div role="radiogroup" aria-label="Account type" className="grid gap-3 sm:grid-cols-3">
          {ROLE_OPTIONS.map(({ value, title, body, icon: Icon }) => (
            <button
              key={value}
              type="button"
              role="radio"
              aria-checked={role === value}
              onClick={() => setValue("role", value, { shouldValidate: true })}
              className="chip flex items-center gap-3 rounded-xl p-3.5 text-left sm:flex-col sm:items-start sm:gap-2"
            >
              <Icon className="size-5 shrink-0" />
              <span>
                <span className="block text-sm font-bold">{title}</span>
                <span className={cn("block text-xs", role === value ? "text-gunmetal/80" : "text-muted-foreground")}>{body}</span>
              </span>
            </button>
          ))}
        </div>

        <AnimatePresence initial={false}>
          {role === "driver" && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden"
            >
              <div className="flex gap-3 rounded-xl bg-secondary p-3.5 text-sm text-secondary-foreground">
                <Smartphone className="mt-0.5 size-4 shrink-0" />
                <p>Drivers work from the Plate-Link Android app. Create your account here, then log in on the app.</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="grid gap-1.5">
            <FloatingInput id="name" label={NAME_LABEL[role]} autoComplete="name" aria-invalid={!!errors.name} {...register("name")} />
            {err(errors.name?.message)}
          </div>
          <div className="grid gap-1.5">
            <FloatingInput id="phone" label="Phone, e.g. +91 98765 43210" type="tel" autoComplete="tel" aria-invalid={!!errors.phone} {...register("phone")} />
            {err(errors.phone?.message)}
          </div>
        </div>
        <div className="grid gap-1.5">
          <FloatingInput id="email" label="Email" type="email" autoComplete="email" aria-invalid={!!errors.email} {...register("email")} />
          {err(errors.email?.message)}
        </div>
        <div className="grid gap-1.5">
          <FloatingInput id="password" label="Password (8+ characters)" type="password" autoComplete="new-password" aria-invalid={!!errors.password} {...register("password")} />
          {err(errors.password?.message)}
        </div>
        <Button type="submit" size="lg" className="mt-1 w-full" loading={isSubmitting}>
          Create account
        </Button>
      </form>
      <p className="mt-8 text-sm text-muted-foreground">
        Already registered?{" "}
        <Link href="/login" className="font-semibold text-link hover:underline">
          Log in
        </Link>
      </p>
    </div>
  )
}
