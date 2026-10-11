-- Paiements partiels : le client déclare le montant qu'il verse, l'administration approuve.
alter table orders add column if not exists amount_paid int not null default 0;

create table if not exists payment_installments (
  id         uuid primary key default gen_random_uuid(),
  order_id   uuid not null references orders(id) on delete cascade,
  user_id    uuid not null references users(id),
  amount     int not null check (amount > 0),
  method     text not null default 'mobile_money',
  reference  text,
  status     text not null default 'pending' check (status in ('pending','approved','rejected')),
  note       text,
  decided_by uuid references users(id),
  decided_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists payment_installments_order_idx on payment_installments(order_id, created_at);
create index if not exists payment_installments_status_idx on payment_installments(status);
alter table payment_installments enable row level security;
