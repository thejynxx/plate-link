import type { OrderStatus } from "./constants"

/** Linear happy path used to render timelines. */
export const ORDER_FLOW: OrderStatus[] = ["pending_driver", "driver_assigned", "on_the_way", "completed"]

/** Allowed transitions. Mirrors the RPCs in 0001_init.sql — the DB is the enforcer. */
export const ORDER_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  pending_driver: ["driver_assigned", "cancelled"],
  driver_assigned: ["on_the_way", "pending_driver", "cancelled"],
  on_the_way: ["completed"],
  completed: [],
  cancelled: [],
}

export function canTransition(from: OrderStatus, to: OrderStatus) {
  return ORDER_TRANSITIONS[from].includes(to)
}

export function flowIndex(status: OrderStatus) {
  return ORDER_FLOW.indexOf(status)
}
