# Antigravity prompts — Plate-Link

How to use this file:
- Open the `plate-link` folder in Antigravity. The agent should read `AGENTS.md` automatically; Prompt 0 makes sure.
- Paste **one prompt at a time**. Review the diff, run the check listed under it, then move on.
- If the agent wants to edit `0001_init.sql` or add tables, reject it unless the prompt says to.
- Phase 1, chat, dish suggestions, the prep planner and the new design system are already built. Start at Prompt 0, then Phase 2.
- Every prompt below must use the design system in AGENTS.md rule 10 (palette, tactile buttons, `.input-well`, `.chip`, `.ticket`, Bricolage headings). If something looks generic or emerald/green, it's wrong.

---

## Prompt 0 — orient the agent (paste first, every new session)

```
Read AGENTS.md, README.md, supabase/migrations/0001_init.sql and packages/shared/src fully before doing anything.
Then skim apps/web/app, apps/web/components and apps/web/lib so you know the existing patterns
(AppShell, SessionProvider/useSession, useRealtimeInvalidate, Field, EmptyState/ErrorState, skeletons,
lib/queries/*, BaseMap/LocationPicker/PlaceAutocomplete, DishAutocomplete, ListingCard (.ticket), StatBoard,
Button variants, FloatingInput, Switch, .chip, components/chat/*, PrepPlanner). Reuse them — do not create parallel versions.
Reply with a 10-line summary of the architecture and the rules you must follow. Do not write code yet.
```

---

## PHASE 2 — Recipient web: find, claim, track

### 2.1 Routes API proxy (OpenRouteService)
```
Add a server route apps/web/app/api/routes/route.ts (POST).
Input JSON: { coordinates: [lng,lat][] } with 2–4 points. Validate with a zod schema in packages/shared/src/schemas/route.ts.
Require a signed-in user (server Supabase client, auth.getUser) — return 401 otherwise.
Call OpenRouteService directions: POST https://api.openrouteservice.org/v2/directions/driving-car/geojson
with header Authorization: process.env.ORS_API_KEY (server-only env var; add it to apps/web/.env.example).
Return { geometry: GeoJSON LineString, distance_m, duration_s }. Cache identical requests in-memory for 60 s.
On ORS failure return 502 with a readable message; the UI must fall back to a straight line.
Add a client helper lib/routes.ts: fetchRoute(points) used by the UI.
```
Check: `curl -X POST localhost:3000/api/routes` while logged out → 401. Get a free key at openrouteservice.org.

### 2.2 Recipient location + radius
```
In the recipient area (/app), create a hook hooks/use-recipient-location.ts:
- Tries navigator.geolocation once; falls back to DEFAULT_CENTER.
- Lets the user override by searching (reuse PlaceAutocomplete) — store the chosen point + label in localStorage
  key "pl:recipient-location" (wrap in try/catch).
- Exposes { point, label, setPoint, radiusKm, setRadiusKm } with radius options 2, 5, 10, 20 km (default 5).
Build a compact LocationBar component at the top of /app showing "Showing food within X km of <label>" with
a "Change" popover (autocomplete + radius chips + "Use my location").
```

### 2.3 Feed ⇄ Map view
```
Replace the Phase-1 placeholder in app/(recipient)/app/page.tsx with a client component RecipientFeed.
Data: supabase.rpc('nearby_listings', { p_lat, p_lng, p_radius_m }) via TanStack Query
(add lib/queries/recipient.ts with recipientKeys + fetchers, same style as lib/queries/canteen.ts).
Realtime: useRealtimeInvalidate on food_listings (no filter) → invalidate recipientKeys.nearby.
UI:
- Segmented toggle Feed | Map (remember choice in localStorage). On lg screens show both side by side.
- Feed: responsive grid of KOT tickets — make a RecipientListingCard that reuses the `.ticket` markup of ListingCard
  (photo, FoodTypeMark, big Bricolage portion count, ExpiryCountdown) plus canteen name and distance via formatDistance.
  Sort by distance; `.chip` filters for food type.
- Map: BaseMap with a Pin marker per listing and a "you" dot; clicking a pin opens a maplibre Popup with
  the card summary and a "View" button. Fit bounds to results on load.
- Skeletons for both views, EmptyState ("No food within 5 km right now — widen the radius"), ErrorState.
Card click → /app/listings/[id].
```

### 2.4 Listing detail + Claim
```
Create /app/listings/[id] (recipient). Fetch the listing + canteen (org_name, address, pickup_instructions,
location) — RLS allows it while available. Show photo, details, a small BaseMap with the canteen pin and distance.
"Claim this food" opens a Dialog:
- Drop-off location: reuse LocationPicker, prefilled from use-recipient-location.
- Optional notes (max 500 chars).
- Confirm calls supabase.rpc('claim_listing', {...}).
Map errors from the RPC to friendly toasts: P0001 "Someone just claimed this", 42501 "Only NGO accounts can claim".
On success: toast + router.push(`/app/orders/${order.id}`).
Also add an "Ask the canteen" button (variant="outline") that calls rpc('open_listing_chat', { p_listing_id }) via
openListingChat() in lib/queries/chat.ts and routes to `/app/messages/${conversationId}`.
If the listing is no longer available (realtime update while viewing), disable the button and show a banner.
```

### 2.5 My claims
```
Create /app/orders: list the recipient's orders (orders where user_id = me, newest first) joined with the listing
title/photo/quantity and canteen name. Tabs: Active (pending_driver, driver_assigned, on_the_way) | Past.
Each row shows ORDER_STATUS_LABEL as a Badge and links to /app/orders/[id].
Active orders in pending_driver or driver_assigned show "Cancel claim" → rpc('cancel_order') with a confirm Dialog.
Realtime: useRealtimeInvalidate on orders filter user_id=eq.<me>. Skeleton/empty/error states.
```

### 2.6 Live tracking page
```
Create /app/orders/[id] — the live tracking screen.
Data: the order, its listing, canteen (pickup point), order_events, driver contact (users row — RLS allows once
assigned) and driver_locations row for order.driver_id.
Realtime: subscribe to orders (id=eq.<id>), order_events (order_id=eq.<id>) and driver_locations
(driver_id=eq.<driver_id>) — when a driver_locations UPDATE arrives, update the marker position directly in
React state (do NOT refetch every ping); throttle re-routing to once per 30 s.
Map (BaseMap, full width, ~60vh):
- Canteen pin, drop-off pin, and a driver marker (a car/scooter icon in a circle) that animates smoothly between
  positions (requestAnimationFrame lerp over 1 s) and rotates by heading when present.
- Route line via fetchRoute(): driver→canteen while driver_assigned, driver→drop-off while on_the_way;
  draw with a GeoJSON Source + line Layer in var(--primary). Fallback: straight dashed line.
- Keep all three points in view (fitBounds with padding) unless the user has panned manually.
Side panel / bottom sheet on mobile: ETA ("Arriving in ~12 min" from the route duration), StatusTimeline
(reuse buildSteps), DriverCard with call button, "Last updated Xs ago" (warn if > 2 min stale).
Completed → celebratory state (Framer Motion check), Cancelled → muted state.
Add a "Message" button (variant="dark") that calls openOrderChat(order.id) and routes to `/app/messages/${id}`.
```
Check (until the driver app exists): impersonate a driver in the SQL editor like the README's claim snippet,
call `accept_order`, then `insert into driver_locations ... on conflict (driver_id) do update` a few times with
changing coordinates — the marker should move live.

### 2.7 Phase 2 review
```
Review everything added in Phase 2 against AGENTS.md. Run typecheck, lint and build and fix all issues.
Check 375px layouts and dark mode on every new page. List anything you were unsure about.
```

---

## PHASE 3 — Android app (Expo) — driver flow

### 3.1 Scaffold the Expo app
```
Create apps/mobile as an Expo app with Expo Router and TypeScript (npx create-expo-app@latest mobile --template default),
named @platelink/mobile, package id com.platelink.app. It must work inside this pnpm monorepo (.npmrc already has
node-linker=hoisted); configure metro.config.js for the monorepo (watchFolders = repo root, resolve
@platelink/shared). Add "@platelink/shared": "workspace:*".
Install with npx expo install: expo-location expo-task-manager expo-image-picker expo-image-manipulator expo-image
@react-native-async-storage/async-storage react-native-url-polyfill expo-secure-store expo-dev-client expo-haptics
@maplibre/maplibre-react-native, and pnpm add @supabase/supabase-js @tanstack/react-query nativewind tailwindcss
react-hook-form @hookform/resolvers zod lucide-react-native react-native-svg date-fns.
SAME UI AS THE WEB: build the NativeWind theme from packages/shared/src/design-tokens.ts (colors light/dark,
radii, typeScale) — do not invent colours. Fonts: npx expo install @expo-google-fonts/bricolage-grotesque
@expo-google-fonts/geist expo-font; Bricolage for headings/numbers, Geist for body.
Build mobile equivalents of the web primitives in apps/mobile/components/ui:
- PressButton: Pressable on a darker "edge" View; the face translates down 4px while pressed (Reanimated
  withTiming 40ms) + expo-haptics light impact. Variants default (brick), accent (honey), dark, outline.
- WellInput: 2px border, primary border + honey glow ring when focused; FloatingLabelInput for auth.
- Chip (radio), Switch (pill with sliding knob), Badge (status colours from design-tokens statusColors).
- TicketCard: listing as a kitchen order ticket (rounded card, half-circle notches cut at the perforation using
  two small circles in the canvas colour, dashed perforation line, big Bricolage portion count).
- Dark Gunmetal header/tab bar (chrome colour) like the web sidebar.
app.config.ts: add the @maplibre/maplibre-react-native plugin, expo-location plugin with background location
permission strings, Android permissions ACCESS_FINE_LOCATION, ACCESS_BACKGROUND_LOCATION, FOREGROUND_SERVICE,
FOREGROUND_SERVICE_LOCATION, CAMERA. Env via EXPO_PUBLIC_SUPABASE_URL / EXPO_PUBLIC_SUPABASE_ANON_KEY (.env.example).
Explain how to run a dev build on my Android phone (npx expo run:android or a local APK) — Expo Go will NOT work
because of MapLibre and background location.
```

### 3.2 Supabase + auth on mobile
```
apps/mobile/lib/supabase.ts: createClient<Database> with AsyncStorage session storage, autoRefreshToken,
persistSession, detectSessionInUrl false, and AppState listener calling startAutoRefresh/stopAutoRefresh.
Screens (auth) login + register mirroring the web (same zod schemas from @platelink/shared; role picker
Driver | NGO only — canteens use the web). Root _layout.tsx: auth gate that reads public.users.role and routes to
(driver) or (recipient) groups; canteen accounts see a "Use the web dashboard" screen with sign out.
```

### 3.3 Driver: available pickups map
```
(driver)/index.tsx — full-screen MapLibre map (OpenFreeMap style, dark style in dark mode) centred on the
driver's location (expo-location foreground permission). Data: rpc('available_pickups', { p_lat, p_lng, p_radius_m })
refetched on pull/refresh button and via realtime on orders (status changes). Pins at pickup points; tapping one
opens a bottom sheet: title, portions, canteen name + address, drop-off address, pickup→drop-off distance,
expiry countdown, and "Accept delivery" → rpc('accept_order'). Handle P0001 errors ("already taken" /
"finish your current delivery first"). Online/offline toggle updates drivers.is_online. List view toggle.
```

### 3.4 Driver: background location broadcasting
```
lib/location-task.ts: define a TaskManager background task "pl-driver-location" that upserts
driver_locations { driver_id, current_lat, current_lng, heading, speed_mps, last_updated: now }.
Start it (Location.startLocationUpdatesAsync, accuracy Balanced, timeInterval 5000, distanceInterval 15,
foregroundService notification "Plate-Link is sharing your location for an active delivery") ONLY while the
driver has an order in driver_assigned/on_the_way; stop it when the order completes/cancels/releases or on sign-out.
The task must create its own Supabase client from AsyncStorage (it runs outside React). Request background
permission with a clear explanation screen first.
```

### 3.5 Driver: active delivery screen
```
(driver)/active.tsx — the current order (driver_id = me, status driver_assigned|on_the_way).
Map with driver dot, canteen pin, drop-off pin and the route line (call the web app's /api/routes with the
user's access token in Authorization: Bearer — update the web route to accept either cookie session or bearer
token; or call ORS through a Supabase Edge Function if you prefer — say which and why).
Big primary actions:
- "Navigate" → Linking.openURL(navigationUrl(target)) (Google Maps app, free).
- driver_assigned: "Picked up" → optional proof photo (camera, expo-image-manipulator to 1280px JPEG) uploaded to
  delivery-proofs/<driverId>/<orderId>/pickup.jpg, then rpc('mark_picked_up', { p_order_id, p_proof_path }).
- on_the_way: "Delivered" → same with delivery.jpg and rpc('mark_delivered').
- driver_assigned: "Release" (confirm) → rpc('release_order').
Contact buttons (call canteen / recipient). Haptics on success. If no active order, redirect to the map.
```

### 3.5b Chat on mobile
```
Port the web chat to mobile: (shared)/messages.tsx inbox (rpc my_conversations, unread badges on the tab icon)
and (shared)/messages/[id].tsx thread (messages list, realtime INSERT subscription on messages filtered by
conversation_id — use a unique channel name per screen instance, mark_conversation_read on open, composer with
send button). Mine = brick bubble on the right, others = card bubble on the left with "Name, Role" above.
Add a "Message" button on the driver's active delivery screen (rpc open_order_chat). Reuse the query functions by
moving apps/web/lib/queries/chat.ts into packages/shared/src/queries/chat.ts (taking a SupabaseClient<Database>).
```

### 3.6 Driver: history + profile
```
(driver)/history.tsx: completed deliveries list with date, portions, canteen → recipient.
profile.tsx: name, phone, vehicle_type (picker) and vehicle_number (updates drivers), theme, sign out.
```

### 3.7 Phase 3 review
```
Review apps/mobile against AGENTS.md. Run tsc for mobile and web. Make sure the background task stops when it
should, that no Google Maps API is used, and that every screen has loading/empty/error states.
```

---

## PHASE 4 — Android app — recipient screens

```
Build the (recipient) group in apps/mobile, mirroring the web Phase 2 features with native UX:
1. Feed/Map tabs using rpc('nearby_listings') with radius chips and current location; realtime invalidation.
2. Listing detail + Claim sheet (drop-off = current location or a draggable pin on a MapLibre map + Photon search,
   reuse the Photon helper by moving lib/photon.ts into packages/shared so both apps use it).
3. My claims list with cancel.
4. Live tracking screen: driver marker animated from driver_locations realtime, route + ETA via the same routes
   endpoint, status timeline, call driver, Message button.
5. "Ask the canteen" on listing detail → rpc open_listing_chat → messages thread.
Share logic, not components: put fetchers and query keys used by both apps into packages/shared/src/queries
(taking a SupabaseClient<Database> parameter).
```

---

## PHASE 5 — Ship it (free)

### 5.1 Web on Vercel
```
Prepare apps/web for Vercel: confirm build works from a clean clone with only the two NEXT_PUBLIC env vars and
ORS_API_KEY. Add a short "Deploy" section to README with: Root Directory apps/web, env vars, and the Supabase URL
configuration changes (Site URL + /auth/callback redirect for the Vercel domain).
```

### 5.2 Keep Supabase awake
```
Add .github/workflows/keepalive.yml: runs every 3 days (cron) and on workflow_dispatch; curls
${SUPABASE_URL}/rest/v1/canteens?select=id&limit=1 with apikey header from repository secrets
SUPABASE_URL and SUPABASE_ANON_KEY. Document the two secrets in README.
```

### 5.3 Android APK (local build, no EAS)
```
Write docs/ANDROID_BUILD.md and the config for a signed release APK built locally:
1. Generate a keystore (keytool command), store it OUTSIDE the repo; add *.keystore/*.jks to .gitignore.
2. npx expo prebuild --platform android --clean
3. Configure signing via ~/.gradle/gradle.properties (PLATELINK_UPLOAD_STORE_FILE, …) and a config plugin
   (plugins/withReleaseSigning.js) so prebuild --clean doesn't wipe it.
4. cd android && ./gradlew assembleRelease → android/app/build/outputs/apk/release/app-release.apk
5. How to install it on a phone (enable "Install unknown apps", adb install).
Also add the alternative: `eas build -p android --profile preview --local` with an eas.json preview profile
using buildType "apk".
```

### 5.4 Final security + polish pass
```
Audit the whole repo:
- No secret keys in client code or git (only publishable/anon key and EXPO_PUBLIC vars client-side).
- Every Supabase write from clients is allowed by an RLS policy or goes through an RPC; list any that would fail.
- All forms validate with shared zod schemas; all lists paginate or limit.
- Lighthouse-style check of the web app: image sizes, CLS from maps (reserve height), accessible labels.
Fix what you find and summarise the rest.
```

---

## When something breaks — debugging prompt

```
This is failing: <paste the exact error / stack trace / screenshot description>.
Steps to reproduce: <steps>.
First explain the root cause in 3 lines, citing the file and line. Check RLS policies and RPC errcodes in
0001_init.sql before assuming a code bug. Then fix it minimally, without touching unrelated files, and run
typecheck + lint.
```
