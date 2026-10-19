import type { Metadata } from "next"
import { PageHeader } from "@/components/layout/page-header"
import { LocationBar } from "@/components/recipient/location-bar"
import { RecipientFeed } from "@/components/recipient/recipient-feed"

export const metadata: Metadata = { title: "Find food" }

export default function RecipientHome() {
  return (
    <>
      <PageHeader title="Food near you" description="Surplus from canteens within your radius, newest first." />
      <div className="mb-6">
        <LocationBar />
      </div>
      <RecipientFeed />
    </>
  )
}
