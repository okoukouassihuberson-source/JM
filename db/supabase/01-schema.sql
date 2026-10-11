-- JM POISSONNERIE — étape 1/13 : tables, index et rôles
-- JM POISSONNERIE — schéma initial (PostgreSQL 14+)
-- Montants en FCFA (entiers). Quantités en unité de vente (kg décimaux, pièces entières…).

create extension if not exists pgcrypto;

-- ───────────── Rôles & permissions (source de vérité des droits) ─────────────
create table roles (
  key         text primary key,
  label       text not null,
  permissions text[] not null default '{}'
);

insert into roles (key, label, permissions) values
  ('super_admin',   'Super admin',          array['*']),
  ('manager',       'Gérant',               array['dashboard.view','products.view','products.manage','categories.manage','stock.view','stock.manage','orders.view','orders.prepare','orders.manage','orders.assign','orders.cancel','payments.manage','drivers.manage','zones.manage','promotions.manage','reviews.moderate','customers.view','customers.manage','staff.manage','settings.manage','audit.view']),
  ('stock_manager', 'Gestionnaire stock',   array['dashboard.view','products.view','stock.view','stock.manage']),
  ('preparer',      'Préparateur',          array['orders.view','orders.prepare']),
  ('driver',        'Livreur',              array['driver.access']),
  ('client',        'Client',               array[]::text[]);

-- ───────────── Utilisateurs ─────────────
create table users (
  id            uuid primary key default gen_random_uuid(),
  phone         text not null unique,               -- identifiant de connexion (E.164 sans +, ex: 2250710369975)
  password_hash text not null,                      -- scrypt, jamais en clair
  role_key      text not null references roles(key) default 'client',
  first_name    text not null,
  last_name     text not null,
  active        boolean not null default true,
  created_at    timestamptz not null default now(),
  last_login_at timestamptz
);
create index users_role_idx on users(role_key);

create table profiles (
  user_id          uuid primary key references users(id) on delete cascade,
  email            text,
  avatar_url       text,
  default_commune  text,
  marketing_opt_in boolean not null default true,
  updated_at       timestamptz not null default now()
);

create table sessions (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references users(id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  user_agent text,
  ip         text
);
create index sessions_user_idx on sessions(user_id);
create index sessions_exp_idx on sessions(expires_at);

-- Réinitialisation de mot de passe SANS OTP/SMS : le gérant remet un code à usage unique.
create table password_resets (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references users(id) on delete cascade,
  requested_at timestamptz not null default now(),
  code_hash    text,
  issued_by    uuid references users(id),
  expires_at   timestamptz,
  used_at      timestamptz
);
create index password_resets_user_idx on password_resets(user_id, requested_at desc);

create table rate_limits (
  key          text primary key,
  count        int not null default 0,
  window_start timestamptz not null default now()
);

-- ───────────── Catalogue ─────────────
create table categories (
  id          uuid primary key default gen_random_uuid(),
  slug        text not null unique,
  name        text not null,
  description text not null default '',
  image_url   text,
  sort_order  int not null default 0,
  active      boolean not null default true,
  created_at  timestamptz not null default now()
);

create table products (
  id                uuid primary key default gen_random_uuid(),
  category_id       uuid not null references categories(id),
  slug              text not null unique,
  name              text not null,
  description       text not null default '',
  unit              text not null default 'kg' check (unit in ('kg','piece','pack','tray','custom')),
  unit_label        text not null default 'kg',        -- libellé affiché (kg, pièce, paquet, plateau, litre…)
  step              numeric(8,3) not null default 0.5 check (step > 0),
  min_qty           numeric(8,3) not null default 0.5 check (min_qty > 0),
  allow_custom_qty  boolean not null default false,    -- saisie libre de la quantité
  price             int not null check (price >= 0),   -- FCFA par unité
  promo_price       int check (promo_price is null or promo_price >= 0),
  promo_active      boolean not null default false,
  promo_ends_at     timestamptz,
  active            boolean not null default true,
  featured          boolean not null default false,
  sku               text,
  origin            text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  check (promo_price is null or promo_price < price)
);
create index products_category_idx on products(category_id) where active;
create index products_featured_idx on products(featured) where active;
create index products_promo_idx on products(promo_active) where active;
create index products_name_idx on products (lower(name));

create table product_images (
  id         uuid primary key default gen_random_uuid(),
  product_id uuid not null references products(id) on delete cascade,
  url        text not null,
  alt        text not null default '',
  position   int not null default 0
);
create index product_images_product_idx on product_images(product_id, position);

create table product_variants (
  id         uuid primary key default gen_random_uuid(),
  product_id uuid not null references products(id) on delete cascade,
  name       text not null,
  price      int not null check (price >= 0),
  active     boolean not null default true,
  position   int not null default 0
);
create index product_variants_product_idx on product_variants(product_id, position);

-- ───────────── Stock ─────────────
create table inventory (
  product_id      uuid primary key references products(id) on delete cascade,
  on_hand         numeric(12,3) not null default 0 check (on_hand >= 0),   -- physiquement en stock
  reserved        numeric(12,3) not null default 0 check (reserved >= 0),  -- réservé par des commandes en cours
  sold            numeric(12,3) not null default 0 check (sold >= 0),      -- cumul vendu (livré)
  alert_threshold numeric(12,3) not null default 0 check (alert_threshold >= 0),
  low_alert_sent  boolean not null default false,
  updated_at      timestamptz not null default now(),
  check (reserved <= on_hand)
);

create table inventory_movements (
  id             bigserial primary key,
  product_id     uuid not null references products(id) on delete cascade,
  type           text not null check (type in ('restock','reserve','release','sale','adjustment','loss','initial')),
  on_hand_delta  numeric(12,3) not null default 0,
  reserved_delta numeric(12,3) not null default 0,
  order_id       uuid,
  user_id        uuid references users(id),
  note           text,
  created_at     timestamptz not null default now()
);
create index inventory_movements_product_idx on inventory_movements(product_id, created_at desc);

-- ───────────── Panier ─────────────
create table carts (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid unique references users(id) on delete cascade,
  guest_token text unique,
  coupon_code text,
  updated_at  timestamptz not null default now(),
  check (user_id is not null or guest_token is not null)
);

create table cart_items (
  id         uuid primary key default gen_random_uuid(),
  cart_id    uuid not null references carts(id) on delete cascade,
  product_id uuid not null references products(id) on delete cascade,
  variant_id uuid references product_variants(id) on delete cascade,
  quantity   numeric(10,3) not null check (quantity > 0),
  created_at timestamptz not null default now()
);
create unique index cart_items_unique_idx on cart_items(cart_id, product_id, coalesce(variant_id, '00000000-0000-0000-0000-000000000000'::uuid));

-- ───────────── Adresses & zones ─────────────
create table addresses (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references users(id) on delete cascade,
  label        text not null default 'Domicile',
  commune      text not null,
  quartier     text not null,
  address      text not null,
  landmark     text,
  phone        text,
  instructions text,
  is_default   boolean not null default false,
  created_at   timestamptz not null default now()
);
create index addresses_user_idx on addresses(user_id);

create table delivery_zones (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  description text not null default '',
  fee         int not null check (fee >= 0),
  eta_min     int not null default 30,   -- minutes
  eta_max     int not null default 60,
  active      boolean not null default true,
  sort_order  int not null default 0
);

create table coupons (
  id         uuid primary key default gen_random_uuid(),
  code       text not null unique,
  type       text not null check (type in ('percent','fixed')),
  value      int not null check (value > 0),
  min_order  int not null default 0,
  max_uses   int,
  used_count int not null default 0,
  expires_at timestamptz,
  active     boolean not null default true,
  created_at timestamptz not null default now()
);

-- ───────────── Commandes ─────────────
create table order_counters (day date primary key, n int not null default 0);

create table orders (
  id              uuid primary key default gen_random_uuid(),
  number          text not null unique,                 -- JM-20261006-0001
  user_id         uuid not null references users(id),
  status          text not null default 'received' check (status in ('received','payment_confirmed','preparing','ready','handed_to_driver','out_for_delivery','delivered','delivery_failed','cancelled')),
  delivery_method text not null check (delivery_method in ('standard','express','pickup')),
  zone_id         uuid references delivery_zones(id),
  zone_name       text,
  subtotal        int not null,
  delivery_fee    int not null default 0,
  discount        int not null default 0,
  total           int not null,
  coupon_code     text,
  payment_method  text not null,
  customer_name   text not null,
  customer_phone  text not null,
  commune         text,
  quartier        text,
  address_line    text,
  landmark        text,
  delivery_phone  text,
  instructions    text,
  delivery_code   text,                                 -- code remis au livreur à la livraison
  cancel_reason   text,
  stock_state     text not null default 'reserved' check (stock_state in ('reserved','sold','released')),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index orders_user_idx on orders(user_id, created_at desc);
create index orders_status_idx on orders(status, created_at desc);
create index orders_created_idx on orders(created_at desc);

create table order_items (
  id                  uuid primary key default gen_random_uuid(),
  order_id            uuid not null references orders(id) on delete cascade,
  product_id          uuid references products(id) on delete set null,
  variant_id          uuid references product_variants(id) on delete set null,
  name                text not null,
  variant_name        text,
  unit                text not null,
  unit_label          text not null,
  quantity            numeric(10,3) not null check (quantity > 0),
  unit_price          int not null,
  original_unit_price int not null,
  line_total          int not null,
  image_url           text
);
create index order_items_order_idx on order_items(order_id);
create index order_items_product_idx on order_items(product_id);

create table payments (
  id           uuid primary key default gen_random_uuid(),
  order_id     uuid not null references orders(id) on delete cascade,
  method       text not null,                            -- cash_on_delivery | mobile_money | card | cinetpay
  provider     text not null default 'manual',
  status       text not null default 'pending' check (status in ('pending','paid','failed','refunded')),
  amount       int not null,
  reference    text,                                     -- réf. transaction saisie par le client (Mobile Money manuel)
  provider_ref text,
  paid_at      timestamptz,
  created_at   timestamptz not null default now(),
  raw          jsonb
);
create index payments_order_idx on payments(order_id);
create index payments_status_idx on payments(status);

-- ───────────── Livraison ─────────────
create table drivers (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null unique references users(id) on delete cascade,
  status     text not null default 'available' check (status in ('available','busy','unavailable')),
  vehicle    text not null default 'Moto',
  created_at timestamptz not null default now()
);

create table deliveries (
  id                   uuid primary key default gen_random_uuid(),
  order_id             uuid not null unique references orders(id) on delete cascade,
  driver_id            uuid references drivers(id),
  status               text not null default 'pending' check (status in ('pending','assigned','accepted','en_route','arrived','delivered','failed')),
  assigned_at          timestamptz,
  accepted_at          timestamptz,
  started_at           timestamptz,
  arrived_at           timestamptz,
  delivered_at         timestamptz,
  failed_at            timestamptz,
  failure_reason       text,
  eta                  timestamptz,
  proof_photo_url      text,
  proof_comment        text,
  last_lat             double precision,
  last_lng             double precision,
  location_updated_at  timestamptz
);
create index deliveries_driver_idx on deliveries(driver_id, status);

create table delivery_status_history (
  id          bigserial primary key,
  order_id    uuid not null references orders(id) on delete cascade,
  status      text not null,
  note        text,
  actor_id    uuid references users(id),
  created_at  timestamptz not null default now()
);
create index dsh_order_idx on delivery_status_history(order_id, created_at);

-- ───────────── Avis, favoris, notifications ─────────────
create table reviews (
  id         uuid primary key default gen_random_uuid(),
  product_id uuid not null references products(id) on delete cascade,
  user_id    uuid not null references users(id) on delete cascade,
  order_id   uuid references orders(id) on delete set null,
  rating     int not null check (rating between 1 and 5),
  comment    text not null default '',
  status     text not null default 'published' check (status in ('published','hidden')),
  created_at timestamptz not null default now(),
  unique (user_id, product_id, order_id)
);
create index reviews_product_idx on reviews(product_id) where status = 'published';

create table favorites (
  user_id    uuid not null references users(id) on delete cascade,
  product_id uuid not null references products(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, product_id)
);

create table notifications (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references users(id) on delete cascade,
  type       text not null,
  title      text not null,
  body       text not null default '',
  link       text,
  read_at    timestamptz,
  created_at timestamptz not null default now()
);
create index notifications_user_idx on notifications(user_id, created_at desc);
create index notifications_unread_idx on notifications(user_id) where read_at is null;

-- ───────────── Factures ─────────────
create table invoice_counters (year int primary key, n int not null default 0);

create table invoices (
  id        uuid primary key default gen_random_uuid(),
  number    text not null unique,                       -- F-2026-000001
  order_id  uuid not null unique references orders(id) on delete cascade,
  issued_at timestamptz not null default now(),
  total     int not null,
  data      jsonb not null                              -- instantané immuable (coordonnées boutique, lignes…)
);

-- ───────────── Contenu & paramètres ─────────────
create table settings (
  key        text primary key,
  value      jsonb not null,
  updated_at timestamptz not null default now(),
  updated_by uuid references users(id)
);

create table banners (
  id         uuid primary key default gen_random_uuid(),
  title      text not null,
  subtitle   text not null default '',
  image_url  text,
  link_url   text,
  active     boolean not null default true,
  position   int not null default 0
);

create table audit_logs (
  id         bigserial primary key,
  user_id    uuid references users(id) on delete set null,
  action     text not null,
  entity     text,
  entity_id  text,
  details    jsonb,
  ip         text,
  created_at timestamptz not null default now()
);
create index audit_logs_created_idx on audit_logs(created_at desc);
create index audit_logs_user_idx on audit_logs(user_id);
