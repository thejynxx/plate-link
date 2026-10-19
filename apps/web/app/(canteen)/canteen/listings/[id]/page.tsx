import type { Metadata } from "next"
import { ListingDetailView } from "@/components/canteen/listing-detail"

export const metadata: Metadata = { title: "Listing" }

export default async function ListingPage({ params }: PageProps<"/canteen/listings/[id]">) {
  const { id } = await params
  return <ListingDetailView id={id} />
}
