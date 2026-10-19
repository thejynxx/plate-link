-- =====================================================================
-- Plate-Link — Initial schema (Supabase / PostgreSQL)
-- Run in: Supabase Dashboard → SQL Editor, or `supabase db push`
-- (save as supabase/migrations/0001_init.sql)
-- =====================================================================

-- ---------------------------------------------------------------------
-- 0. Extensions
-- ---------------------------------------------------------------------
create extension if not exists postgis with schema extensions;   -- radius queries
create extension if not exists pg_cron;                           -- listing expiry job

-- ---------------------------------------------------------------------
-- 1. Enums
-- ---------------------------------------------------------------------
create type public.user_role      as enum ('canteen', 'driver', 'user');
create type public.listing_status as enum ('available', 'claimed', 'picked_up', 'delivered', 'expired', 'cancelled');
-- Expanded from spec: driver_assigned separates "accepted" from "food in transit".
create type public.order_status   as enum ('pending_driver', 'driver_assigned', 'on_the_way', 'completed', 'cancelled');
create type public.food_type      as enum ('veg', 'non_veg', 'vegan', 'mixed');

-- ---------------------------------------------------------------------
-- 2. Shared trigger: updated_at
-- ---------------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

-- ---------------------------------------------------------------------
-- 3. Tables
-- ---------------------------------------------------------------------

-- 3.1 users — one row per auth user (created by trigger on signup)
create table public.users (
  id          uuid primary key references auth.users (id) on delete cascade,
  role        public.user_role not null,
  name        text not null check (char_length(name) between 1 and 120),
  phone       text check (phone is null or phone ~ '^\+?[0-9 ()-]{7,20}$'),
  avatar_url  text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- 3.2 canteens — org profile for role = canteen (created during onboarding)
create table public.canteens (
  id                  uuid primary key references public.users (id) on delete cascade,
  org_name            text not null check (char_length(org_name) between 1 and 160),
  address             text not null,
  place_id            text,                                   -- Google Places id
  location_lat        double precision not null check (location_lat between -90 and 90),
  location_lng        double precision not null check (location_lng between -180 and 180),
  location            extensions.geography(point, 4326)
                      generated always as (
                        extensions.st_setsrid(extensions.st_makepoint(location_lng, location_lat), 4326)::extensions.geography
                      ) stored,
  pickup_instructions text,
  is_verified         boolean not null default false,         -- admin-set; enforce later if needed
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

-- 3.3 drivers — profile for role = driver (created by signup trigger)
create table public.drivers (
  id              uuid primary key references public.users (id) on delete cascade,
  vehicle_type    text check (vehicle_type in ('bike', 'scooter', 'car', 'van', 'other')),
  vehicle_number  text,
  is_online       boolean not null default false,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

-- 3.4 food_listings
create table public.food_listings (
  id            uuid primary key default gen_random_uuid(),
  canteen_id    uuid not null references public.canteens (id) on delete cascade,
  title         text not null check (char_length(title) between 1 and 120),
  description   text check (char_length(description) <= 1000),
  food_type     public.food_type not null default 'veg',
  quantity      integer not null check (quantity > 0),        -- portions
  photo_url     text,
  status        public.listing_status not null default 'available',
  location_lat  double precision not null check (location_lat between -90 and 90),
  location_lng  double precision not null check (location_lng between -180 and 180),
  location      extensions.geography(point, 4326)
                generated always as (
                  extensions.st_setsrid(extensions.st_makepoint(location_lng, location_lat), 4326)::extensions.geography
                ) stored,
  prepared_at   timestamptz,
  expires_at    timestamptz not null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now(),
  constraint expires_after_creation check (expires_at > created_at)
);

create index food_listings_available_geo_idx on public.food_listings using gist (location)
  where status = 'available';
create index food_listings_canteen_idx on public.food_listings (canteen_id, created_at desc);
create index food_listings_expiry_idx  on public.food_listings (expires_at) where status = 'available';

-- 3.5 orders — one active order per listing
create table public.orders (
  id                  uuid primary key default gen_random_uuid(),
  listing_id          uuid not null references public.food_listings (id) on delete cascade,
  canteen_id          uuid not null references public.canteens (id) on delete cascade,  -- denormalised for RLS
  user_id             uuid not null references public.users (id) on delete cascade,
  driver_id           uuid references public.drivers (id) on delete set null,
  status              public.order_status not null default 'pending_driver',
  dropoff_address     text not null,
  dropoff_lat         double precision not null check (dropoff_lat between -90 and 90),
  dropoff_lng         double precision not null check (dropoff_lng between -180 and 180),
  notes               text check (char_length(notes) <= 500),
  pickup_proof_path   text,     -- storage path in delivery-proofs bucket
  delivery_proof_path text,
  accepted_at         timestamptz,
  picked_up_at        timestamptz,
  delivered_at        timestamptz,
  cancelled_at        timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create unique index orders_one_active_per_listing on public.orders (listing_id)
  where status <> 'cancelled';
create index orders_user_idx    on public.orders (user_id, created_at desc);
create index orders_driver_idx  on public.orders (driver_id, created_at desc);
create index orders_canteen_idx on public.orders (canteen_id, created_at desc);
create index orders_pending_idx on public.orders (created_at) where status = 'pending_driver';

-- 3.6 order_events — audit trail / status timeline
create table public.order_events (
  id          bigint generated always as identity primary key,
  order_id    uuid not null references public.orders (id) on delete cascade,
  actor_id    uuid references public.users (id) on delete set null,
  from_status public.order_status,
  to_status   public.order_status not null,
  created_at  timestamptz not null default now()
);
create index order_events_order_idx on public.order_events (order_id, created_at);

-- 3.7 driver_locations — realtime, one row per driver (upserted)
create table public.driver_locations (
  driver_id     uuid primary key references public.drivers (id) on delete cascade,
  current_lat   double precision not null check (current_lat between -90 and 90),
  current_lng   double precision not null check (current_lng between -180 and 180),
  heading       real,
  speed_mps     real,
  last_updated  timestamptz not null default now()
);

-- updated_at triggers
create trigger users_updated_at    before update on public.users         for each row execute function public.set_updated_at();
create trigger canteens_updated_at before update on public.canteens      for each row execute function public.set_updated_at();
create trigger drivers_updated_at  before update on public.drivers       for each row execute function public.set_updated_at();
create trigger listings_updated_at before update on public.food_listings for each row execute function public.set_updated_at();
create trigger orders_updated_at   before update on public.orders        for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------
-- 4. Helper functions
-- ---------------------------------------------------------------------

-- Current user's role (security definer → no RLS recursion)
create or replace function public.my_role()
returns public.user_role
language sql stable security definer set search_path = ''
as $$ select role from public.users where id = auth.uid() $$;

-- Does the current user share any order with `other`? (for contact info visibility)
create or replace function public.shares_order_with(other uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.orders o
    where auth.uid() in (o.user_id, o.driver_id, o.canteen_id)
      and other      in (o.user_id, o.driver_id, o.canteen_id)
  )
$$;

-- Signup: create public.users (+ drivers row). Role comes from signUp options.data.role
create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  r public.user_role;
begin
  r := coalesce(nullif(new.raw_user_meta_data ->> 'role', ''), 'user')::public.user_role;

  insert into public.users (id, role, name, phone, avatar_url)
  values (
    new.id,
    r,
    coalesce(nullif(new.raw_user_meta_data ->> 'name', ''), split_part(new.email, '@', 1), 'New user'),
    nullif(new.raw_user_meta_data ->> 'phone', ''),
    nullif(new.raw_user_meta_data ->> 'avatar_url', '')
  );

  if r = 'driver' then
    insert into public.drivers (id) values (new.id);
  end if;

  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Listings inherit canteen coordinates when not supplied
create or replace function public.listing_default_location()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if new.location_lat is null or new.location_lng is null then
    select c.location_lat, c.location_lng
      into new.location_lat, new.location_lng
    from public.canteens c where c.id = new.canteen_id;
  end if;
  return new;
end $$;

create trigger listings_default_location
  before insert on public.food_listings
  for each row execute function public.listing_default_location();

-- ---------------------------------------------------------------------
-- 5. Row Level Security
-- ---------------------------------------------------------------------
alter table public.users            enable row level security;
alter table public.canteens         enable row level security;
alter table public.drivers          enable row level security;
alter table public.food_listings    enable row level security;
alter table public.orders           enable row level security;
alter table public.order_events     enable row level security;
alter table public.driver_locations enable row level security;

-- users ---------------------------------------------------------------
create policy users_select on public.users for select to authenticated
  using (id = (select auth.uid()) or public.shares_order_with(id));

create policy users_update_self on public.users for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- role is immutable from the client: only these columns are updatable
revoke update on public.users from authenticated, anon;
grant  update (name, phone, avatar_url) on public.users to authenticated;

-- canteens ------------------------------------------------------------
create policy canteens_select on public.canteens for select to authenticated using (true);

create policy canteens_insert on public.canteens for insert to authenticated
  with check (id = (select auth.uid()) and public.my_role() = 'canteen');

create policy canteens_update on public.canteens for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

revoke update (is_verified) on public.canteens from authenticated, anon;

-- drivers -------------------------------------------------------------
create policy drivers_select on public.drivers for select to authenticated
  using (id = (select auth.uid()) or public.shares_order_with(id));

create policy drivers_update on public.drivers for update to authenticated
  using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- food_listings -------------------------------------------------------
create policy listings_select on public.food_listings for select to authenticated
  using (
    (status = 'available' and expires_at > now())
    or canteen_id = (select auth.uid())
    or exists (
      select 1 from public.orders o
      where o.listing_id = food_listings.id
        and (
          o.user_id = (select auth.uid())
          or o.driver_id = (select auth.uid())
          or (o.status = 'pending_driver' and public.my_role() = 'driver')
        )
    )
  );

create policy listings_insert on public.food_listings for insert to authenticated
  with check (
    canteen_id = (select auth.uid())
    and public.my_role() = 'canteen'
    and status = 'available'
  );

-- Canteens may edit or cancel only while unclaimed; downstream transitions go through RPCs
create policy listings_update on public.food_listings for update to authenticated
  using (canteen_id = (select auth.uid()) and status = 'available')
  with check (canteen_id = (select auth.uid()) and status in ('available', 'cancelled'));

create policy listings_delete on public.food_listings for delete to authenticated
  using (canteen_id = (select auth.uid()) and status in ('available', 'cancelled', 'expired'));

-- orders (read-only from client; all writes via RPCs below) ------------
create policy orders_select on public.orders for select to authenticated
  using (
    (select auth.uid()) in (user_id, driver_id, canteen_id)
    or (status = 'pending_driver' and public.my_role() = 'driver')
  );

-- order_events --------------------------------------------------------
create policy order_events_select on public.order_events for select to authenticated
  using (exists (select 1 from public.orders o where o.id = order_events.order_id));  -- inherits orders RLS

-- driver_locations ----------------------------------------------------
create policy driver_loc_insert on public.driver_locations for insert to authenticated
  with check (driver_id = (select auth.uid()) and public.my_role() = 'driver');

create policy driver_loc_update on public.driver_locations for update to authenticated
  using (driver_id = (select auth.uid())) with check (driver_id = (select auth.uid()));

create policy driver_loc_select on public.driver_locations for select to authenticated
  using (
    driver_id = (select auth.uid())
    or exists (
      select 1 from public.orders o
      where o.driver_id = driver_locations.driver_id
        and o.status in ('driver_assigned', 'on_the_way')
        and (select auth.uid()) in (o.user_id, o.canteen_id)
    )
  );

-- ---------------------------------------------------------------------
-- 6. Transactional RPCs (row-locked state machine)
-- ---------------------------------------------------------------------

-- Recipient claims a listing → creates order (pending_driver)
create or replace function public.claim_listing(
  p_listing_id      uuid,
  p_dropoff_address text,
  p_dropoff_lat     double precision,
  p_dropoff_lng     double precision,
  p_notes           text default null
)
returns public.orders
language plpgsql security definer set search_path = ''
as $$
declare
  l public.food_listings;
  o public.orders;
begin
  if public.my_role() is distinct from 'user' then
    raise exception 'Only recipients can claim food' using errcode = '42501';
  end if;

  select * into l from public.food_listings where id = p_listing_id for update;
  if not found then
    raise exception 'Listing not found' using errcode = 'P0002';
  end if;
  if l.status <> 'available' or l.expires_at <= now() then
    raise exception 'Listing is no longer available' using errcode = 'P0001';
  end if;

  update public.food_listings set status = 'claimed' where id = l.id;

  insert into public.orders (listing_id, canteen_id, user_id, dropoff_address, dropoff_lat, dropoff_lng, notes)
  values (l.id, l.canteen_id, auth.uid(), p_dropoff_address, p_dropoff_lat, p_dropoff_lng, p_notes)
  returning * into o;

  insert into public.order_events (order_id, actor_id, to_status)
  values (o.id, auth.uid(), 'pending_driver');

  return o;
end $$;

-- Driver accepts a pending order (max one active delivery per driver)
create or replace function public.accept_order(p_order_id uuid)
returns public.orders
language plpgsql security definer set search_path = ''
as $$
declare
  o public.orders;
begin
  if public.my_role() is distinct from 'driver' then
    raise exception 'Only drivers can accept deliveries' using errcode = '42501';
  end if;

  if exists (
    select 1 from public.orders
    where driver_id = auth.uid() and status in ('driver_assigned', 'on_the_way')
  ) then
    raise exception 'Finish your current delivery first' using errcode = 'P0001';
  end if;

  select * into o from public.orders where id = p_order_id for update;
  if not found then
    raise exception 'Order not found' using errcode = 'P0002';
  end if;
  if o.status <> 'pending_driver' then
    raise exception 'Order already taken' using errcode = 'P0001';
  end if;

  update public.orders
     set driver_id = auth.uid(), status = 'driver_assigned', accepted_at = now()
   where id = o.id
  returning * into o;

  insert into public.order_events (order_id, actor_id, from_status, to_status)
  values (o.id, auth.uid(), 'pending_driver', 'driver_assigned');

  return o;
end $$;

-- Driver confirms pickup at canteen
create or replace function public.mark_picked_up(p_order_id uuid, p_proof_path text default null)
returns public.orders
language plpgsql security definer set search_path = ''
as $$
declare
  o public.orders;
begin
  select * into o from public.orders where id = p_order_id for update;
  if not found or o.driver_id is distinct from auth.uid() then
    raise exception 'Order not found' using errcode = 'P0002';
  end if;
  if o.status <> 'driver_assigned' then
    raise exception 'Invalid transition from %', o.status using errcode = 'P0001';
  end if;

  update public.orders
     set status = 'on_the_way', picked_up_at = now(), pickup_proof_path = p_proof_path
   where id = o.id
  returning * into o;

  update public.food_listings set status = 'picked_up' where id = o.listing_id;

  insert into public.order_events (order_id, actor_id, from_status, to_status)
  values (o.id, auth.uid(), 'driver_assigned', 'on_the_way');

  return o;
end $$;

-- Driver confirms delivery
create or replace function public.mark_delivered(p_order_id uuid, p_proof_path text default null)
returns public.orders
language plpgsql security definer set search_path = ''
as $$
declare
  o public.orders;
begin
  select * into o from public.orders where id = p_order_id for update;
  if not found or o.driver_id is distinct from auth.uid() then
    raise exception 'Order not found' using errcode = 'P0002';
  end if;
  if o.status <> 'on_the_way' then
    raise exception 'Invalid transition from %', o.status using errcode = 'P0001';
  end if;

  update public.orders
     set status = 'completed', delivered_at = now(), delivery_proof_path = p_proof_path
   where id = o.id
  returning * into o;

  update public.food_listings set status = 'delivered' where id = o.listing_id;

  insert into public.order_events (order_id, actor_id, from_status, to_status)
  values (o.id, auth.uid(), 'on_the_way', 'completed');

  return o;
end $$;

-- Driver backs out before pickup → order returns to the pool
create or replace function public.release_order(p_order_id uuid)
returns public.orders
language plpgsql security definer set search_path = ''
as $$
declare
  o public.orders;
begin
  select * into o from public.orders where id = p_order_id for update;
  if not found or o.driver_id is distinct from auth.uid() then
    raise exception 'Order not found' using errcode = 'P0002';
  end if;
  if o.status <> 'driver_assigned' then
    raise exception 'Can only release before pickup' using errcode = 'P0001';
  end if;

  update public.orders
     set driver_id = null, status = 'pending_driver', accepted_at = null
   where id = o.id
  returning * into o;

  insert into public.order_events (order_id, actor_id, from_status, to_status)
  values (o.id, auth.uid(), 'driver_assigned', 'pending_driver');

  return o;
end $$;

-- Recipient cancels before pickup → listing returns to available (if not expired)
create or replace function public.cancel_order(p_order_id uuid)
returns public.orders
language plpgsql security definer set search_path = ''
as $$
declare
  o    public.orders;
  prev public.order_status;
begin
  select * into o from public.orders where id = p_order_id for update;
  if not found or o.user_id is distinct from auth.uid() then
    raise exception 'Order not found' using errcode = 'P0002';
  end if;
  if o.status not in ('pending_driver', 'driver_assigned') then
    raise exception 'Cannot cancel after pickup' using errcode = 'P0001';
  end if;
  prev := o.status;

  update public.orders
     set status = 'cancelled', cancelled_at = now()
   where id = o.id
  returning * into o;

  update public.food_listings
     set status = case when expires_at > now() then 'available'::public.listing_status
                       else 'expired'::public.listing_status end
   where id = o.listing_id;

  insert into public.order_events (order_id, actor_id, from_status, to_status)
  values (o.id, auth.uid(), prev, 'cancelled');

  return o;
end $$;

-- ---------------------------------------------------------------------
-- 7. Read RPCs (security invoker → RLS applies)
-- ---------------------------------------------------------------------

-- Recipient feed/map: available listings within radius
create or replace function public.nearby_listings(
  p_lat      double precision,
  p_lng      double precision,
  p_radius_m integer default 5000
)
returns table (
  id uuid, canteen_id uuid, canteen_name text, title text, description text,
  food_type public.food_type, quantity integer, photo_url text, expires_at timestamptz,
  location_lat double precision, location_lng double precision, distance_m double precision
)
language sql stable security invoker set search_path = ''
as $$
  with origin as (
    select extensions.st_setsrid(extensions.st_makepoint(p_lng, p_lat), 4326)::extensions.geography as g
  )
  select l.id, l.canteen_id, c.org_name, l.title, l.description, l.food_type, l.quantity,
         l.photo_url, l.expires_at, l.location_lat, l.location_lng,
         extensions.st_distance(l.location, origin.g) as distance_m
  from public.food_listings l
  join public.canteens c on c.id = l.canteen_id
  cross join origin
  where l.status = 'available'
    and l.expires_at > now()
    and extensions.st_dwithin(l.location, origin.g, least(p_radius_m, 50000))
  order by distance_m
  limit 100
$$;

-- Driver map: pending deliveries within radius (distance to pickup)
create or replace function public.available_pickups(
  p_lat      double precision,
  p_lng      double precision,
  p_radius_m integer default 10000
)
returns table (
  order_id uuid, listing_id uuid, title text, quantity integer, canteen_name text,
  pickup_address text, pickup_lat double precision, pickup_lng double precision,
  dropoff_address text, dropoff_lat double precision, dropoff_lng double precision,
  expires_at timestamptz, distance_m double precision, created_at timestamptz
)
language sql stable security invoker set search_path = ''
as $$
  with origin as (
    select extensions.st_setsrid(extensions.st_makepoint(p_lng, p_lat), 4326)::extensions.geography as g
  )
  select o.id, l.id, l.title, l.quantity, c.org_name,
         c.address, l.location_lat, l.location_lng,
         o.dropoff_address, o.dropoff_lat, o.dropoff_lng,
         l.expires_at, extensions.st_distance(l.location, origin.g), o.created_at
  from public.orders o
  join public.food_listings l on l.id = o.listing_id
  join public.canteens c      on c.id = o.canteen_id
  cross join origin
  where o.status = 'pending_driver'
    and extensions.st_dwithin(l.location, origin.g, least(p_radius_m, 50000))
  order by 13
  limit 100
$$;

-- Canteen dashboard metrics
create or replace function public.canteen_stats()
returns table (
  active_listings bigint, total_listings bigint,
  deliveries_completed bigint, portions_donated bigint
)
language sql stable security invoker set search_path = ''
as $$
  select
    count(*) filter (where status = 'available' and expires_at > now()),
    count(*),
    count(*) filter (where status = 'delivered'),
    coalesce(sum(quantity) filter (where status = 'delivered'), 0)
  from public.food_listings
  where canteen_id = auth.uid()
$$;

-- Function privileges: authenticated only
revoke execute on function
  public.claim_listing(uuid, text, double precision, double precision, text),
  public.accept_order(uuid),
  public.mark_picked_up(uuid, text),
  public.mark_delivered(uuid, text),
  public.release_order(uuid),
  public.cancel_order(uuid),
  public.nearby_listings(double precision, double precision, integer),
  public.available_pickups(double precision, double precision, integer),
  public.canteen_stats()
from public, anon;

grant execute on function
  public.claim_listing(uuid, text, double precision, double precision, text),
  public.accept_order(uuid),
  public.mark_picked_up(uuid, text),
  public.mark_delivered(uuid, text),
  public.release_order(uuid),
  public.cancel_order(uuid),
  public.nearby_listings(double precision, double precision, integer),
  public.available_pickups(double precision, double precision, integer),
  public.canteen_stats()
to authenticated;

revoke execute on function public.handle_new_user() from public, anon, authenticated;

-- ---------------------------------------------------------------------
-- 8. Realtime
-- ---------------------------------------------------------------------
alter publication supabase_realtime add table public.food_listings, public.orders, public.driver_locations;

-- ---------------------------------------------------------------------
-- 9. Scheduled expiry (every 5 min)
-- ---------------------------------------------------------------------
select cron.schedule(
  'expire-food-listings',
  '*/5 * * * *',
  $$ update public.food_listings set status = 'expired'
     where status = 'available' and expires_at <= now() $$
);

-- ---------------------------------------------------------------------
-- 10. Storage buckets + policies
-- Path convention: <bucket>/<auth.uid()>/<...>
--   avatars/<uid>/avatar.jpg
--   food-photos/<uid>/<listing_id>.jpg
--   delivery-proofs/<driver_uid>/<order_id>/{pickup|delivery}.jpg
-- ---------------------------------------------------------------------
insert into storage.buckets (id, name, public) values
  ('avatars',         'avatars',         true),
  ('food-photos',     'food-photos',     true),
  ('delivery-proofs', 'delivery-proofs', false)
on conflict (id) do nothing;

create policy storage_insert_own_folder on storage.objects for insert to authenticated
  with check (
    bucket_id in ('avatars', 'food-photos', 'delivery-proofs')
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );

create policy storage_update_own_folder on storage.objects for update to authenticated
  using ((storage.foldername(name))[1] = (select auth.uid())::text);

create policy storage_delete_own_folder on storage.objects for delete to authenticated
  using ((storage.foldername(name))[1] = (select auth.uid())::text);

create policy storage_read_proofs on storage.objects for select to authenticated
  using (
    bucket_id = 'delivery-proofs'
    and exists (
      select 1 from public.orders o
      where o.id::text = (storage.foldername(name))[2]
        and (select auth.uid()) in (o.user_id, o.driver_id, o.canteen_id)
    )
  );
