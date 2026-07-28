# Generic Download Sequence

1. Browser requests document download.
2. Backend resolves trusted actor and tenant.
3. Backend loads metadata and grants.
4. Backend authorizes resource access.
5. Backend creates short-lived signed URL.
6. Backend writes audit event.
7. Browser downloads directly from storage.
