import type { Metadata } from "next"
import { HistoryTable } from "@/components/canteen/history-table"
import { PageHeader } from "@/components/layout/page-header"

export const metadata: Metadata = { title: "History" }

export default function HistoryPage() {
  return (
    <>
      <PageHeader title="History" description="Every listing you've posted, newest first." />
      <HistoryTable />
    </>
  )
}
