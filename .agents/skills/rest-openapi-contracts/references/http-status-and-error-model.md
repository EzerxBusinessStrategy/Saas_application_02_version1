# HTTP Status And Error Model

- Use `200` for successful reads and updates with a body.
- Use `201` for created resources.
- Use `202` when work is accepted for background processing.
- Use `204` only when no response body is needed.
- Use `400` for malformed or invalid requests.
- Use `401` for missing or invalid authentication.
- Use `403` for authenticated but denied requests.
- Use `404` when hiding inaccessible resource existence is required.
- Use `409` for state conflicts and duplicate non-idempotent mutations.
- Use `412` for failed expected-version checks.
- Use `422` only for domain validation that is syntactically valid.
- Use `429` for throttling.

Error envelope:

```ts
type ApiError = {
  error: {
    code: string;
    message: string;
    requestId: string;
    details?: unknown;
  };
};
```
