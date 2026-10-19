"use client"

import { useRouter } from "next/navigation"
import { useForm, useWatch } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { toast } from "sonner"
import { canteenOnboardingSchema, type CanteenOnboardingInput } from "@platelink/shared"
import { createClient } from "@/lib/supabase/client"
import { errorMessage } from "@/lib/utils"
import { LocationPicker } from "@/components/maps/location-picker"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Field } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"

export function OnboardingForm({ userId }: { userId: string }) {
  const router = useRouter()
  const {
    register,
    control,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<CanteenOnboardingInput>({ resolver: zodResolver(canteenOnboardingSchema) })

  const [address, lat, lng] = useWatch({ control, name: ["address", "location_lat", "location_lng"] })

  async function onSubmit(values: CanteenOnboardingInput) {
    const { error } = await createClient()
      .from("canteens")
      .insert({ id: userId, ...values, pickup_instructions: values.pickup_instructions || null })
    if (error) {
      toast.error(errorMessage(error, "Couldn't save your canteen"))
      return
    }
    toast.success("You're all set — post your first listing")
    router.replace("/canteen/home")
    router.refresh()
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate>
      <Card>
        <CardContent className="grid gap-5 pt-5">
          <Field label="Canteen / organisation name" htmlFor="org_name" error={errors.org_name?.message}>
            <Input id="org_name" placeholder="e.g. VIT Chennai — Food Court A" aria-invalid={!!errors.org_name} {...register("org_name")} />
          </Field>

          <Field label="Pickup location" error={errors.address?.message ?? errors.location_lat?.message}>
            <LocationPicker
              value={lat != null && lng != null ? { lat, lng, address: address ?? "" } : null}
              onChange={(loc) => {
                setValue("location_lat", loc.lat, { shouldValidate: true })
                setValue("location_lng", loc.lng, { shouldValidate: true })
                setValue("address", loc.address, { shouldValidate: true })
              }}
            />
          </Field>

          <Field label="Address shown to drivers" htmlFor="address_text" hint="Edit to add a gate number or landmark.">
            <Input id="address_text" {...register("address")} />
          </Field>

          <Field
            label="Pickup instructions"
            htmlFor="pickup_instructions"
            error={errors.pickup_instructions?.message}
            hint="Optional — who to ask for, which counter, timings."
          >
            <Textarea id="pickup_instructions" rows={3} {...register("pickup_instructions")} />
          </Field>

          <Button type="submit" size="lg" loading={isSubmitting}>
            Save and continue
          </Button>
        </CardContent>
      </Card>
    </form>
  )
}
