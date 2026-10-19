import { LISTING_STATUS_LABEL, type ListingStatus } from "@platelink/shared"
import { Badge } from "@/components/ui/badge"

const VARIANT: Record<ListingStatus, React.ComponentProps<typeof Badge>["variant"]> = {
  available: "honey",
  claimed: "silk",
  picked_up: "iron",
  delivered: "gunmetal",
  expired: "muted",
  cancelled: "destructive",
}

export function ListingStatusBadge({ status }: { status: ListingStatus }) {
  return (
    <Badge variant={VARIANT[status]}>
      {status === "available" && <span className="size-1.5 animate-pulse rounded-full bg-current" />}
      {LISTING_STATUS_LABEL[status]}
    </Badge>
  )
}
