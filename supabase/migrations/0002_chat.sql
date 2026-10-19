-- =====================================================================
-- Plate-Link — 0002: chat between canteens, NGOs and drivers
-- Run AFTER 0001_init.sql, in Supabase → SQL Editor (paste whole file → Run).
--
-- Two kinds of conversation:
--   • order   — one per order. Canteen + recipient join when food is claimed,
--               the driver joins automatically when they accept the delivery.
--   • listing — an NGO or driver asks a canteen about a listing before claiming
--               (one thread per listing per asker).
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Tables
-- ---------------------------------------------------------------------
create table public.conversations (
  id                   uuid primary key default gen_random_uuid(),
  kind                 text not null check (kind in ('order', 'listing')),
  order_id             uuid unique references public.orders (id) on delete cascade,
  listing_id           uuid references public.food_listings (id) on delete cascade,
  requester_id         uuid references public.users (id) on delete cascade,   -- listing chats only
  last_message_at      timestamptz,
  last_message_preview text,
  created_at           timestamptz not null default now(),
  constraint conversation_shape check (
    (kind = 'order'   and order_id is not null) or
    (kind = 'listing' and listing_id is not null and requester_id is not null)
  )
);
create unique index conversations_listing_requester on public.conversations (listing_id, requester_id)
  where kind = 'listing';

create table public.conversation_participants (
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  user_id         uuid not null references public.users (id) on delete cascade,
  last_read_at    timestamptz not null default 'epoch',
  joined_at       timestamptz not null default now(),
  primary key (conversation_id, user_id)
);
create index conversation_participants_user_idx on public.conversation_participants (user_id);

create table public.messages (
  id              bigint generated always as identity primary key,
  conversation_id uuid not null references public.conversations (id) on delete cascade,
  sender_id       uuid references public.users (id) on delete set null,
  body            text not null check (char_length(btrim(body)) between 1 and 2000),
  created_at      timestamptz not null default now()
);
create index messages_conversation_idx on public.messages (conversation_id, created_at desc);

-- ---------------------------------------------------------------------
-- 2. Helpers + triggers
-- ---------------------------------------------------------------------
create or replace function public.is_participant(p_conversation uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.conversation_participants
    where conversation_id = p_conversation and user_id = auth.uid()
  )
$$;

-- Keep the inbox preview fresh
create or replace function public.messages_touch_conversation()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  update public.conversations
     set last_message_at = new.created_at,
         last_message_preview = left(new.body, 140)
   where id = new.conversation_id;
  -- the sender has obviously read everything up to their own message
  update public.conversation_participants
     set last_read_at = new.created_at
   where conversation_id = new.conversation_id and user_id = new.sender_id;
  return new;
end $$;

create trigger messages_touch_conversation
  after insert on public.messages
  for each row execute function public.messages_touch_conversation();

-- Every new order gets a thread with the canteen + recipient
create or replace function public.orders_open_chat()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  cid uuid;
begin
  insert into public.conversations (kind, order_id, listing_id)
  values ('order', new.id, new.listing_id)
  on conflict (order_id) do update set order_id = excluded.order_id
  returning id into cid;

  insert into public.conversation_participants (conversation_id, user_id)
  values (cid, new.canteen_id), (cid, new.user_id)
  on conflict do nothing;
  return new;
end $$;

create trigger orders_open_chat
  after insert on public.orders
  for each row execute function public.orders_open_chat();

-- Driver joins the thread when they accept
create or replace function public.orders_driver_joins_chat()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if new.driver_id is not null and new.driver_id is distinct from old.driver_id then
    insert into public.conversation_participants (conversation_id, user_id)
    select c.id, new.driver_id from public.conversations c where c.order_id = new.id
    on conflict do nothing;
  end if;
  return new;
end $$;

create trigger orders_driver_joins_chat
  after update of driver_id on public.orders
  for each row execute function public.orders_driver_joins_chat();

-- Backfill threads for orders created before this migration
insert into public.conversations (kind, order_id, listing_id)
select 'order', o.id, o.listing_id from public.orders o
on conflict (order_id) do nothing;

insert into public.conversation_participants (conversation_id, user_id)
select c.id, p.uid
from public.conversations c
join public.orders o on o.id = c.order_id
cross join lateral (values (o.canteen_id), (o.user_id), (o.driver_id)) as p(uid)
where p.uid is not null
on conflict do nothing;

-- ---------------------------------------------------------------------
-- 3. Row Level Security
-- ---------------------------------------------------------------------
alter table public.conversations             enable row level security;
alter table public.conversation_participants enable row level security;
alter table public.messages                  enable row level security;

create policy conversations_select on public.conversations for select to authenticated
  using (public.is_participant(id));

create policy participants_select on public.conversation_participants for select to authenticated
  using (public.is_participant(conversation_id));

create policy participants_update_self on public.conversation_participants for update to authenticated
  using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));
revoke update on public.conversation_participants from authenticated, anon;
grant  update (last_read_at) on public.conversation_participants to authenticated;

create policy messages_select on public.messages for select to authenticated
  using (public.is_participant(conversation_id));

create policy messages_insert on public.messages for insert to authenticated
  with check (sender_id = (select auth.uid()) and public.is_participant(conversation_id));

-- conversations / participants are only created by the triggers + RPCs above/below

-- ---------------------------------------------------------------------
-- 4. RPCs
-- ---------------------------------------------------------------------

-- Returns the order's thread id (creating it if somehow missing)
create or replace function public.open_order_chat(p_order_id uuid)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  o   public.orders;
  cid uuid;
begin
  select * into o from public.orders where id = p_order_id;
  if not found or auth.uid() not in (o.user_id, o.canteen_id, coalesce(o.driver_id, '00000000-0000-0000-0000-000000000000'::uuid)) then
    raise exception 'Order not found' using errcode = 'P0002';
  end if;

  insert into public.conversations (kind, order_id, listing_id)
  values ('order', o.id, o.listing_id)
  on conflict (order_id) do update set order_id = excluded.order_id
  returning id into cid;

  insert into public.conversation_participants (conversation_id, user_id)
  select cid, uid from (values (o.canteen_id), (o.user_id), (o.driver_id)) v(uid)
  where uid is not null
  on conflict do nothing;

  return cid;
end $$;

-- NGO/driver asks the canteen about a listing (one thread per asker per listing)
create or replace function public.open_listing_chat(p_listing_id uuid)
returns uuid
language plpgsql security definer set search_path = ''
as $$
declare
  l   public.food_listings;
  cid uuid;
begin
  if public.my_role() not in ('user', 'driver') then
    raise exception 'Only NGOs and drivers can start a chat about a listing' using errcode = '42501';
  end if;
  select * into l from public.food_listings where id = p_listing_id;
  if not found then
    raise exception 'Listing not found' using errcode = 'P0002';
  end if;

  select id into cid from public.conversations
   where kind = 'listing' and listing_id = l.id and requester_id = auth.uid();

  if cid is null then
    insert into public.conversations (kind, listing_id, requester_id)
    values ('listing', l.id, auth.uid())
    returning id into cid;
    insert into public.conversation_participants (conversation_id, user_id)
    values (cid, l.canteen_id), (cid, auth.uid())
    on conflict do nothing;
  end if;
  return cid;
end $$;

-- Inbox: my threads with title, other people, preview and unread count
create or replace function public.my_conversations()
returns table (
  id uuid, kind text, order_id uuid, listing_id uuid, title text, photo_url text,
  order_status public.order_status, last_message_at timestamptz, last_message_preview text,
  unread bigint, participants jsonb, created_at timestamptz
)
language sql stable security definer set search_path = ''
as $$
  select c.id, c.kind, c.order_id, c.listing_id,
         coalesce(l.title, 'Conversation'), l.photo_url, o.status,
         c.last_message_at, c.last_message_preview,
         (select count(*) from public.messages m
           where m.conversation_id = c.id and m.created_at > me.last_read_at
             and m.sender_id is distinct from auth.uid()),
         (select coalesce(jsonb_agg(jsonb_build_object(
                    'id', u.id, 'name', coalesce(cn.org_name, u.name), 'role', u.role, 'phone', u.phone)
                  order by u.role), '[]'::jsonb)
            from public.conversation_participants p
            join public.users u on u.id = p.user_id
            left join public.canteens cn on cn.id = u.id
           where p.conversation_id = c.id and p.user_id <> auth.uid()),
         c.created_at
  from public.conversation_participants me
  join public.conversations c on c.id = me.conversation_id
  left join public.food_listings l on l.id = c.listing_id
  left join public.orders o on o.id = c.order_id
  where me.user_id = auth.uid()
  order by coalesce(c.last_message_at, c.created_at) desc
  limit 200
$$;

create or replace function public.mark_conversation_read(p_conversation_id uuid)
returns void
language sql security definer set search_path = ''
as $$
  update public.conversation_participants
     set last_read_at = now()
   where conversation_id = p_conversation_id and user_id = auth.uid()
$$;

revoke execute on function
  public.open_order_chat(uuid), public.open_listing_chat(uuid),
  public.my_conversations(), public.mark_conversation_read(uuid), public.is_participant(uuid)
from public, anon;
grant execute on function
  public.open_order_chat(uuid), public.open_listing_chat(uuid),
  public.my_conversations(), public.mark_conversation_read(uuid), public.is_participant(uuid)
to authenticated;

-- ---------------------------------------------------------------------
-- 5. Realtime
-- ---------------------------------------------------------------------
alter publication supabase_realtime add table public.messages, public.conversations;
