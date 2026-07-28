# Container Security

- Run as non-root.
- Keep final images minimal.
- Scan images for vulnerabilities.
- Avoid development tools in runtime images.
- Use explicit base images and update deliberately.
- Keep `.dockerignore` tight to avoid copying caches and secrets.
