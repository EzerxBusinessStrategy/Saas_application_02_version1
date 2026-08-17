alter table public.engagement_service_configurations
  add column if not exists discount_percent numeric(5,2) not null default 0;

alter table public.engagement_service_configurations
  drop constraint if exists engagement_service_configurations_discount_percent_check;

alter table public.engagement_service_configurations
  add constraint engagement_service_configurations_discount_percent_check
  check (discount_percent >= 0 and discount_percent <= 100);
