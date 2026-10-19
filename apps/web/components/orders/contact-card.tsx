import { Phone } from "lucide-react"
import type { ContactInfo } from "@/lib/queries/canteen"
import { initials } from "@/lib/utils"
import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Button } from "@/components/ui/button"

export function ContactCard({ role, person }: { role: string; person: ContactInfo }) {
  return (
    <div className="flex items-center gap-3 rounded-lg border p-3">
      <Avatar>
        <AvatarFallback>{initials(person.name)}</AvatarFallback>
      </Avatar>
      <div className="min-w-0 flex-1">
        <p className="text-xs text-muted-foreground">{role}</p>
        <p className="truncate text-sm font-medium">{person.name}</p>
      </div>
      {person.phone && (
        <Button variant="outline" size="icon-sm" asChild>
          <a href={`tel:${person.phone.replace(/\s/g, "")}`} aria-label={`Call ${person.name}`}>
            <Phone />
          </a>
        </Button>
      )}
    </div>
  )
}
