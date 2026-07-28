# Query Diagnosis Workflow

1. Identify endpoint, tenant scope, actor scope, and expected result size.
2. Capture exact SQL and parameters without logging secrets.
3. Count queries per request to detect N+1 behavior.
4. Measure baseline latency with representative data.
5. Run safe explain plans on development/test data only.
6. Compare estimated rows to actual rows.
7. Check payload size and selected columns.
8. Recommend one minimal change and re-measure.
