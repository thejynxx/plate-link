import { OrderTracking } from "@/components/recipient/order-tracking"

export default async function RecipientOrderTrackingPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  return <OrderTracking id={id} />
}
