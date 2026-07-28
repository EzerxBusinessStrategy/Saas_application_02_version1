-- Run only on development or test databases.
-- Replace placeholders with safe values. Do not paste secrets into logs.

-- Query frequency and latency, when pg_stat_statements is enabled:
SELECT query, calls, mean_exec_time, rows
FROM pg_stat_statements
ORDER BY mean_exec_time DESC
LIMIT 20;

-- Explain one measured query on safe data:
EXPLAIN (ANALYZE, BUFFERS)
SELECT *
FROM example_table
WHERE tenant_id = '00000000-0000-0000-0000-000000000000'
ORDER BY created_at DESC
LIMIT 50;
