import type { Metadata } from "next"
import { PageHeader } from "@/components/layout/page-header"
import { ListingForm } from "@/components/listings/listing-form"

export const metadata: Metadata = { title: "New listing" }

export default function NewListingPage() {
  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="Post surplus food" description="Takes under a minute. NGOs nearby see it the moment you publish." />
      <ListingForm />
    </div>
  )
}
