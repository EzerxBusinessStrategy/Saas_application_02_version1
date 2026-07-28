# Health Readiness Shutdown

- Health: process is alive.
- Readiness: dependencies needed for serving are reachable.
- Shutdown: stop accepting requests, drain in-flight work, close pools, close workers.
- Keep checks cheap and bounded.
- Do not expose sensitive dependency details publicly.
