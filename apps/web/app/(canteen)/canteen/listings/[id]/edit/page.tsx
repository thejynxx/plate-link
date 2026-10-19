import type { Metadata } from "next"
import { notFound, redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { PageHeader } from "@/components/layout/page-header"
import { ListingForm } from "@/components/listings/listing-form"

export const metadata: Metadata = { title: "Edit listing" }

export default async function EditListingPage({ params }: PageProps<"/canteen/listings/[id]/edit">) {
  const { id } = await params
  const supabase = await createClient()
  const { data: listing } = await supabase.from("food_listings").select("*").eq("id", id).maybeSingle()
  if (!listing) notFound()
  if (listing.status !== "available") redirect(`/canteen/listings/${id}`)

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="Edit listing" description="You can edit until an NGO claims it." />
      <ListingForm listing={listing} />
    </div>
  )
}
