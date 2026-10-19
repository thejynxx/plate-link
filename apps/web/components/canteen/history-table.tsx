"use client"

import { useState } from "react"
import Link from "next/link"
import { keepPreviousData, useQuery } from "@tanstack/react-query"
import { format } from "date-fns"
import { ChevronLeft, ChevronRight, History } from "lucide-react"
import { createClient } from "@/lib/supabase/client"
import { HISTORY_PAGE_SIZE, canteenKeys, fetchHistory } from "@/lib/queries/canteen"
import { useSession } from "@/components/layout/session-context"
import { FoodTypeMark } from "@/components/listings/food-type-dot"
import { ListingStatusBadge } from "@/components/listings/status-badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { EmptyState } from "@/components/ui/empty-state"
import { ErrorState } from "@/components/ui/error-state"
import { Skeleton } from "@/components/ui/skeleton"

export function HistoryTable() {
  const { profile } = useSession()
  const supabase = createClient()
  const [page, setPage] = useState(0)

  const q = useQuery({
    queryKey: canteenKeys.history(page),
    queryFn: () => fetchHistory(supabase, profile.id, page),
    placeholderData: keepPreviousData,
  })

  if (q.isError) return <ErrorState error={q.error} onRetry={() => q.refetch()} />
  if (q.data && q.data.total === 0) {
    return <EmptyState icon={History} title="No listings yet" description="Your posted listings will show up here." />
  }

  const pages = q.data ? Math.max(1, Math.ceil(q.data.total / HISTORY_PAGE_SIZE)) : 1

  return (
    <Card className="overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b bg-muted/40 text-left text-xs text-muted-foreground">
            <tr>
              <th className="px-4 py-3 font-medium">Listing</th>
              <th className="px-4 py-3 font-medium">Portions</th>
              <th className="px-4 py-3 font-medium">Status</th>
              <th className="hidden px-4 py-3 font-medium md:table-cell">Posted</th>
              <th className="hidden px-4 py-3 font-medium md:table-cell">Delivered</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {q.isPending
              ? Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i}>
                    {Array.from({ length: 5 }).map((__, j) => (
                      <td key={j} className={j > 2 ? "hidden px-4 py-3.5 md:table-cell" : "px-4 py-3.5"}>
                        <Skeleton className="h-4 w-full max-w-32" />
                      </td>
                    ))}
                  </tr>
                ))
              : q.data.rows.map((l) => {
                  const delivered = l.orders.find((o) => o.delivered_at)?.delivered_at
                  return (
                    <tr key={l.id} className="transition-colors hover:bg-muted/40">
                      <td className="px-4 py-3">
                        <Link href={`/canteen/listings/${l.id}`} className="flex items-center gap-2 font-medium hover:text-primary">
                          <FoodTypeMark type={l.food_type} />
                          <span className="line-clamp-1">{l.title}</span>
                        </Link>
                      </td>
                      <td className="px-4 py-3 tabular-nums">{l.quantity}</td>
                      <td className="px-4 py-3">
                        <ListingStatusBadge status={l.status} />
                      </td>
                      <td className="hidden px-4 py-3 text-muted-foreground md:table-cell">{format(new Date(l.created_at), "d MMM yyyy, h:mm a")}</td>
                      <td className="hidden px-4 py-3 text-muted-foreground md:table-cell">
                        {delivered ? format(new Date(delivered), "d MMM, h:mm a") : "—"}
                      </td>
                    </tr>
                  )
                })}
          </tbody>
        </table>
      </div>
      <div className="flex items-center justify-between border-t px-4 py-3 text-sm">
        <span className="text-muted-foreground">
          Page {page + 1} of {pages}
        </span>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" disabled={page === 0 || q.isFetching} onClick={() => setPage((p) => p - 1)}>
            <ChevronLeft /> Prev
          </Button>
          <Button variant="outline" size="sm" disabled={page + 1 >= pages || q.isFetching} onClick={() => setPage((p) => p + 1)}>
            Next <ChevronRight />
          </Button>
        </div>
      </div>
    </Card>
  )
}
