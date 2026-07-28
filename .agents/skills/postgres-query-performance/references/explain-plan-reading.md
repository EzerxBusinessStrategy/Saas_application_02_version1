# Explain Plan Reading

- Look for sequential scans on large tenant-owned tables.
- Compare estimated rows with actual rows.
- Inspect sort method, memory, and disk spills.
- Watch nested loops where the inner side executes many times.
- Check buffers to distinguish CPU, memory, and I/O pressure.
- Treat one explain plan as evidence, not proof across all tenants.
