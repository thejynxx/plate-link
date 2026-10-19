# Plate-Link

Real-time canteen food-surplus redistribution: canteens post surplus, NGOs claim it, volunteer drivers deliver it, everyone watches it live.

**Status:**
- Phase 1 is done: auth, roles, canteen onboarding, dashboard, listings with photos, and live status.
- Also built: chat between canteens, NGOs and drivers; dish-name suggestions; the ML prep planner; and the new design system. Phases 2–5 are driven by the prompts in [`docs/ANTIGRAVITY_PROMPTS.md`](docs/ANTIGRAVITY_PROMPTS.md).

**Stack (all free tiers):** Next.js 16 · Tailwind v4 · shadcn-style UI · Framer Motion · TanStack Query · Supabase (Postgres + PostGIS, Auth, Realtime, Storage) · MapLibre + OpenFreeMap tiles · Photon geocoding · OpenRouteService routing (Phase 2) · Expo → APK (Phase 3).

---

## 1. Prerequisites
- Node.js 20+ (22 LTS recommended) and pnpm: `npm i -g pnpm`
- A free Supabase account

## 2. Supabase setup (once)
1. Create a project — region **Mumbai (ap-south-1)**.
2. **SQL Editor** → paste the whole of `supabase/migrations/0001_init.sql` → **Run**. It creates tables, RLS, RPCs, Realtime, storage buckets and the expiry cron job.
   Then open a **new query**, paste `supabase/migrations/0002_chat.sql` → **Run** (chat tables, RLS, RPCs, Realtime).
3. **Authentication → Sign In / Providers → Email**: enabled. For development turn **Confirm email OFF** (otherwise every test signup needs an inbox).
4. **Authentication → URL Configuration**: Site URL `http://localhost:3000`; add redirect URL `http://localhost:3000/auth/callback`.
5. **Project Settings → API keys**: copy the Project URL and the **publishable / anon** key.

## 3. Run it
```bash
pnpm install
cp apps/web/.env.example apps/web/.env.local   # then fill in the two values
pnpm dev                                        # http://localhost:3000
```

Optional, once your project exists — replace the hand-written types with generated ones:
```bash
pnpm exec supabase login
SUPABASE_PROJECT_REF=<your-ref> pnpm db:types
```

## 4. Try Phase 1
1. Register as **Canteen** → you land on onboarding → search an address or drop the pin → Save.
2. Dashboard → **New listing** → photo, portions, expiry preset → Publish.
3. Register a second account as **NGO / Recipient** (incognito window). Until the Phase 2 claim button exists, claim from Supabase **SQL Editor** while impersonating that recipient — keep the canteen's listing page open and watch it flip to **Claimed** live:
   ```sql
   begin;
   -- 1) pick the newest recipient while still admin, 2) then drop to their role
   select set_config('request.jwt.claims',
     json_build_object('sub', (select id from public.users where role = 'user' order by created_at desc limit 1),
                       'role', 'authenticated')::text, true);
   select set_config('role', 'authenticated', true);
   select public.claim_listing(
     (select id from public.food_listings where status = 'available' order by created_at desc limit 1),
     'Test drop-off, Chennai', 13.0827, 80.2707);
   commit;
   ```
4. Toggle dark mode; resize to phone width.

## 5. Prep planner (ML)
Canteen → **Prep planner**: enter a dish, the last 4 periods of sales, price and cost; it recommends how many portions to cook. The model is trained on 456k real weekly kitchen orders. Details and results are in [`ml/README.md`](ml/README.md).

## 6. Project layout
```
plate-link/
├── apps/web                 # Next.js app (canteen + recipient web)
│   ├── app/                 # routes: (auth), (canteen)/canteen, (recipient)/app, onboarding, dashboard
│   ├── components/          # ui/, layout/, maps/, listings/, canteen/, orders/
│   ├── hooks/               # realtime invalidation, debounce, ticking clock
│   ├── lib/                 # supabase clients, auth guards, queries, photon, upload
│   └── proxy.ts             # session refresh + signed-out redirects (Next 16 "middleware")
├── packages/shared          # DB types, zod schemas, design tokens, dish catalog, prep model, geo
├── supabase/migrations      # 0001_init.sql, 0002_chat.sql — the source of truth
├── ml/                      # prep-model training (Python)
├── docs/ANTIGRAVITY_PROMPTS.md
└── AGENTS.md                # rules every AI agent must follow in this repo
```

## 7. Deploy the web app (Vercel, free)
Import the repo on Vercel → **Root Directory: `apps/web`** → add `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` → Deploy. Then add the Vercel URL (and `<url>/auth/callback`) to Supabase → Authentication → URL Configuration.

> Free-tier Supabase projects pause after 7 days without traffic. Open the app before any demo (Phase 5 adds a keep-alive job).
