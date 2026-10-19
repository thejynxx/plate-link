"use client"

import Link from "next/link"
import { useRouter, useSearchParams } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { toast } from "sonner"
import { loginSchema, type LoginInput } from "@platelink/shared"
import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { FloatingInput } from "@/components/ui/input"

export function LoginForm() {
  const router = useRouter()
  const params = useSearchParams()
  const next = params.get("next")
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginInput>({ resolver: zodResolver(loginSchema) })

  async function onSubmit(values: LoginInput) {
    const { error } = await createClient().auth.signInWithPassword(values)
    if (error) {
      toast.error(
        error.message === "Invalid login credentials"
          ? "Wrong email or password"
          : error.message === "Failed to fetch"
            ? "Can't reach the server. Check your internet connection."
            : error.message
      )
      return
    }
    const target = next && next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard"
    router.replace(target)
    router.refresh()
  }

  return (
    <div className="w-full max-w-sm">
      <h1 className="text-[2.2rem] leading-tight font-bold tracking-tight">Welcome back</h1>
      <p className="mt-2 text-muted-foreground">Log in to post, claim or deliver food.</p>
      <form onSubmit={handleSubmit(onSubmit)} className="mt-8 grid gap-4" noValidate>
        <div className="grid gap-1.5">
          <FloatingInput id="email" label="Email" type="email" autoComplete="email" aria-invalid={!!errors.email} {...register("email")} />
          {errors.email && <p className="text-xs font-semibold text-destructive">{errors.email.message}</p>}
        </div>
        <div className="grid gap-1.5">
          <FloatingInput
            id="password"
            label="Password"
            type="password"
            autoComplete="current-password"
            aria-invalid={!!errors.password}
            {...register("password")}
          />
          {errors.password && <p className="text-xs font-semibold text-destructive">{errors.password.message}</p>}
        </div>
        <Button type="submit" size="lg" className="mt-2 w-full" loading={isSubmitting}>
          Log in
        </Button>
      </form>
      <p className="mt-8 text-sm text-muted-foreground">
        New to Plate-Link?{" "}
        <Link href="/register" className="font-semibold text-link hover:underline">
          Create an account
        </Link>
      </p>
    </div>
  )
}
