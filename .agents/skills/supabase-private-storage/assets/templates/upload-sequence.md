# Generic Upload Sequence

1. Browser requests upload session.
2. Backend authenticates and authorizes.
3. Backend writes pending metadata.
4. Backend returns short-lived signed upload URL.
5. Browser uploads bytes to private bucket.
6. Backend confirms object metadata.
7. Outbox schedules scan.
8. Worker marks clean or quarantined.
