# Signed Upload Flow

1. Authenticate and authorize actor.
2. Create pending metadata.
3. Generate non-guessable object key.
4. Issue short-lived signed upload URL.
5. Confirm upload server-side.
6. Queue scan via outbox.
7. Activate only after validation and scan succeed.
