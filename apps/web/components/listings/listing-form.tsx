"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Controller, useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { useQueryClient } from "@tanstack/react-query"
import { addHours, endOfDay, format, setHours, setMinutes } from "date-fns"
import { toast } from "sonner"
import { FOOD_TYPE_LABEL, findDish, listingSchema, type FoodType, type ListingInput, type Tables } from "@platelink/shared"
import { createClient } from "@/lib/supabase/client"
import { canteenKeys } from "@/lib/queries/canteen"
import { uploadFoodPhoto } from "@/lib/upload"
import { errorMessage } from "@/lib/utils"
import { DishAutocomplete } from "@/components/dishes/dish-autocomplete"
import { useSession } from "@/components/layout/session-context"
import { FoodTypeMark } from "@/components/listings/food-type-dot"
import { PhotoInput } from "@/components/listings/photo-input"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Field } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"

const FOOD_TYPES = Object.keys(FOOD_TYPE_LABEL) as FoodType[]
const toLocalInput = (d?: Date) => (d ? format(d, "yyyy-MM-dd'T'HH:mm") : "")
const fromLocalInput = (v: string) => (v ? new Date(v) : undefined)

function presets(now: Date) {
  const eod = setMinutes(setHours(now, 22), 0)
  return [
    { label: "+2 hours", value: addHours(now, 2) },
    { label: "+4 hours", value: addHours(now, 4) },
    { label: "Tonight 10 PM", value: eod > addHours(now, 1) ? eod : endOfDay(addHours(now, 2)) },
  ]
}

/** Create a listing, or edit one while it's still `available` (RLS enforces that too). */
export function ListingForm({ listing }: { listing?: Tables<"food_listings"> }) {
  const router = useRouter()
  const queryClient = useQueryClient()
  const { profile } = useSession()
  const [photo, setPhoto] = useState<File | null>(null)
  // once the person picks a type themselves, stop auto-filling it from the dish name
  const [touchedType, setTouchedType] = useState(Boolean(listing))
  const editing = Boolean(listing)

  const {
    register,
    control,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(listingSchema),
    defaultValues: listing
      ? {
          title: listing.title,
          description: listing.description ?? "",
          food_type: listing.food_type,
          quantity: listing.quantity,
          prepared_at: listing.prepared_at ? new Date(listing.prepared_at) : undefined,
          expires_at: new Date(listing.expires_at),
        }
      : { food_type: "veg" as const, expires_at: addHours(new Date(), 3) },
  })

  async function onSubmit(values: ListingInput) {
    const supabase = createClient()
    try {
      const photo_url = photo ? await uploadFoodPhoto(supabase, profile.id, photo) : listing?.photo_url ?? null
      const payload = {
        title: values.title,
        description: values.description || null,
        food_type: values.food_type,
        quantity: values.quantity,
        prepared_at: values.prepared_at?.toISOString() ?? null,
        expires_at: values.expires_at.toISOString(),
        photo_url,
      }

      if (listing) {
        const { error } = await supabase.from("food_listings").update(payload).eq("id", listing.id).select("id").single()
        if (error) throw error.code === "PGRST116" ? new Error("This listing was already claimed and can't be edited") : error
        toast.success("Listing updated")
        await queryClient.invalidateQueries({ queryKey: canteenKeys.all })
        router.push(`/canteen/listings/${listing.id}`)
      } else {
        // location_lat/lng are copied from the canteen by a DB trigger
        const { data, error } = await supabase
          .from("food_listings")
          .insert({ ...payload, canteen_id: profile.id })
          .select("id")
          .single()
        if (error) throw error
        toast.success("Listing is live")
        await queryClient.invalidateQueries({ queryKey: canteenKeys.all })
        router.push(`/canteen/listings/${data.id}`)
      }
    } catch (err) {
      toast.error(errorMessage(err, "Couldn't save the listing"))
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate>
      <Card>
        <CardContent className="grid gap-6 pt-5 sm:pt-6">
          <PhotoInput value={photo} onChange={setPhoto} existingUrl={listing?.photo_url} />

          <Controller
            control={control}
            name="title"
            render={({ field }) => (
              <Field
                label="What's the food?"
                htmlFor="title"
                error={errors.title?.message}
                hint="Start typing: we suggest dishes you've listed before, what's listed nearby, and common canteen dishes."
              >
                <DishAutocomplete
                  id="title"
                  placeholder="e.g. Veg biryani"
                  aria-invalid={!!errors.title}
                  value={field.value ?? ""}
                  onChange={(v) => {
                    field.onChange(v)
                    const match = findDish(v)
                    if (match && !touchedType) setValue("food_type", match.foodType)
                  }}
                  onPick={(sug) => {
                    if (sug.dish && !touchedType) setValue("food_type", sug.dish.foodType, { shouldValidate: true })
                  }}
                  onBlur={field.onBlur}
                />
              </Field>
            )}
          />

          <Controller
            control={control}
            name="food_type"
            render={({ field }) => (
              <Field label="Type" error={errors.food_type?.message}>
                <div role="radiogroup" aria-label="Food type" className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {FOOD_TYPES.map((t) => (
                    <button
                      key={t}
                      type="button"
                      role="radio"
                      aria-checked={field.value === t}
                      onClick={() => {
                        setTouchedType(true)
                        field.onChange(t)
                      }}
                      className="chip flex h-11 items-center justify-center gap-2 rounded-xl text-sm font-semibold"
                    >
                      <FoodTypeMark type={t} />
                      {FOOD_TYPE_LABEL[t]}
                    </button>
                  ))}
                </div>
              </Field>
            )}
          />

          <div className="grid gap-5 sm:grid-cols-2">
            <Field label="Portions" htmlFor="quantity" error={errors.quantity?.message} hint="Roughly how many people it feeds">
              <Input
                id="quantity"
                type="number"
                inputMode="numeric"
                min={1}
                aria-invalid={!!errors.quantity}
                {...register("quantity", { valueAsNumber: true })}
              />
            </Field>
            <Controller
              control={control}
              name="prepared_at"
              render={({ field }) => (
                <Field label="Prepared at" htmlFor="prepared_at" error={errors.prepared_at?.message} hint="Optional">
                  <Input
                    id="prepared_at"
                    type="datetime-local"
                    value={toLocalInput(field.value as Date | undefined)}
                    onChange={(e) => field.onChange(fromLocalInput(e.target.value))}
                  />
                </Field>
              )}
            />
          </div>

          <Controller
            control={control}
            name="expires_at"
            render={({ field }) => (
              <Field label="Safe to eat until" htmlFor="expires_at" error={errors.expires_at?.message}>
                <div className="flex flex-wrap gap-2">
                  {presets(new Date()).map((p) => (
                    <button
                      key={p.label}
                      type="button"
                      className="chip h-9 rounded-lg px-3.5 text-xs font-semibold"
                      onClick={() => setValue("expires_at", p.value, { shouldValidate: true })}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
                <Input
                  id="expires_at"
                  type="datetime-local"
                  aria-invalid={!!errors.expires_at}
                  value={toLocalInput(field.value as Date | undefined)}
                  onChange={(e) => field.onChange(fromLocalInput(e.target.value))}
                />
              </Field>
            )}
          />

          <Field label="Notes for the NGO" htmlFor="description" error={errors.description?.message} hint="Optional — allergens, packaging, containers to bring.">
            <Textarea id="description" rows={3} {...register("description")} />
          </Field>

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="ghost" onClick={() => router.back()}>
              Cancel
            </Button>
            <Button type="submit" size="lg" loading={isSubmitting}>
              {editing ? "Save changes" : "Publish listing"}
            </Button>
          </div>
        </CardContent>
      </Card>
    </form>
  )
}
