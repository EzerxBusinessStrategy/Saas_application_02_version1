-- Generic template only. Do not run against production during ordinary Codex work.
create role app_runtime login password '<set-outside-source-control>';
alter role app_runtime nobypassrls;
grant usage on schema public to app_runtime;
