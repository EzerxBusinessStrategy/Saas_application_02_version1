alter table public.task_submissions
  add column if not exists task_comment text;
