import { ListingView } from "@/components/recipient/listing-view"

type PageProps = {
  params: Promise<{ id: string }>
}

export default async function ListingDetailPage({ params }: PageProps) {
  const { id } = await params
  return <ListingView id={id} />
}
