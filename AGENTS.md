# Plate-Link — rules for AI coding agents (Antigravity, Claude, Cursor…)

Read this before changing anything.

## What this is
Real-time canteen food-surplus redistribution. Three roles: **canteen** (donor, web),
**driver** (Android app), **user** (NGO/recipient, web + Android). Extras: chat between all three, a dish-name autocomplete, and an ML prep planner that tells canteens how much to cook.

## Layout
- `apps/web` — Next.js 16 App Router, React 19, Tailwind v4, shadcn-style components in `components/ui`, Framer Motion, TanStack Query.
- `apps/mobile` — Expo app (Phase 3+, not created yet).
- `packages/shared` — `@platelink/shared`: DB types, zod schemas, constants, order state machine, geo helpers. Both apps import from here.
- `supabase/migrations/0001_init.sql` + `0002_chat.sql` — **the schema is the source of truth.**
- `ml/` — Python training for the prep planner model (LightGBM → `packages/shared/src/prep-model/model.json`).

## Hard rules
1. **Never edit existing migration files or invent tables/columns.** If a feature truly needs a schema change, write a NEW migration file `supabase/migrations/000N_<name>.sql` and say so explicitly.
2. A user's role comes from `public.users.role`, **never** from `user_metadata`.
3. Listing/order status changes after a claim go through RPCs only: `claim_listing`, `accept_order`, `mark_picked_up`, `mark_delivered`, `release_order`, `cancel_order`. Never `update orders` from the client (RLS blocks it anyway).
4. Types: import `Database`, `Tables<>`, `Enums<>` from `@platelink/shared`. Never hand-write table types. After a schema change, regenerate: `SUPABASE_PROJECT_REF=<ref> pnpm db:types`.
5. Server code: `createClient()` from `@/lib/supabase/server`, and `supabase.auth.getUser()` / `getClaims()` — never trust `getSession()` on the server. Browser code: `createClient()` from `@/lib/supabase/client` (singleton).
6. Next.js 16: the middleware file is **`proxy.ts`** (not middleware.ts). `cacheComponents` is intentionally **off**. `params` / `searchParams` / `cookies()` are async — `await` them. Read `node_modules/next/dist/docs/` when unsure; APIs differ from older Next versions.
7. Maps are **free/OSM only**: MapLibre via `react-map-gl/maplibre` + OpenFreeMap tiles (`MAP_STYLE_LIGHT/DARK` in shared constants), Photon for geocoding (`lib/photon.ts`), OpenRouteService for routes (server-side key). **No Google Maps APIs.** Turn-by-turn = `navigationUrl()` deep link.
8. Storage uploads go to `<bucket>/<auth.uid()>/...` — the first folder must be the user id or RLS rejects it.
9. Forms: react-hook-form + `zodResolver`; schemas live in `packages/shared/src/schemas`. Use `useWatch`, not `watch()`.
10. UI / design system — palette Gunmetal #32373B, Iron Grey #4A5859, Almond Silk #F4D6CC, Honey Bronze #F4B860, Blushed Brick #C83E4D.
    - Tokens live in `packages/shared/src/design-tokens.ts` (mobile uses these) and are mirrored as CSS variables in `apps/web/app/globals.css`. Use token classes (`bg-primary`, `bg-chrome`, `bg-honey`, `text-muted-foreground`, `text-link`…), never raw hex in components.
    - Fonts: Bricolage Grotesque (`font-display`, headings + big numbers, local file in `app/fonts`) and Geist (body).
    - Interactive pieces: `Button` variants are tactile 3-D "press" buttons; inputs use `.input-well` (honey focus ring + lift); `FloatingInput` for auth; `.chip` for choice buttons (`role="radio" aria-checked`); `Switch`; listings render as `.ticket` (kitchen order ticket with notches + `.ticket-perf`).
    - Dark Gunmetal chrome (sidebar, stat board, planner result) is the structural colour. Primary actions are Blushed Brick; Honey marks "available"/highlights.
    - Copy: sentence case, no ALL-CAPS labels, no "·"-joined meta strings, no "→" in buttons.
    - Every data view needs a skeleton, an empty state and an error state. Must work at 375px and in dark mode; respect prefers-reduced-motion.
11. Realtime: use `hooks/use-realtime-invalidate.ts` to invalidate TanStack Query keys on `postgres_changes` (it gives every hook instance a unique channel name — Supabase reuses channels by name, so never call `supabase.channel(sameName)` twice).
12. Chat: tables `conversations`, `conversation_participants`, `messages`. Order threads are created by a trigger when food is claimed; the driver is added when they accept. Use RPCs `open_order_chat`, `open_listing_chat` (NGO/driver asking about a listing), `my_conversations` (inbox with unread counts), `mark_conversation_read`. UI: `components/chat/*`, `hooks/use-unread.ts`.
13. Dish names: `suggestDishes()` / `findDish()` in `packages/shared/src/dishes.ts` (catalog + fuzzy matching). Use `DishAutocomplete` anywhere a dish name is typed.
14. Prep planner: `planPrep()` from `@platelink/shared/prep-model` — runs fully client-side. Don't edit `model.json` by hand; retrain with `ml/train_prep_model.py`.
15. Home: each role lands on `/canteen/home` or `/app/home` (`ROLE_HOME`), rendered by `components/home/role-home.tsx` — landing-style hero with the user's own tickets (`TicketStack`/`MiniTicket`) and three role tools. The sidebar logo and "Home" item open it.
16. Never delete or rename existing files in a change set unless asked — the owner updates by copying the folder over the old one, so stale files would stay behind.

## Commands
```bash
pnpm install          # from repo root
pnpm dev              # runs apps/web on :3000
pnpm --filter @platelink/web typecheck
pnpm --filter @platelink/web lint
pnpm --filter @platelink/web build
```
Always finish a task with typecheck + lint passing.
