# shadcn fallback components

The official shadcn registry is currently blocked by a self-signed certificate
in the local chain. SSL verification was not disabled.

Local TailAdmin-based components are used instead:

- `Button`, `Card`, `Badge`, and `Dialog` under `src/components/ui`.
- `Input`, `Select`, and Radix `DropdownMenu` wrappers under
  `src/components/ui`. They adapt installed dependencies and local TailAdmin
  tokens; they were not downloaded from the registry.
- `EmptyState`, `ErrorState`, `LoadingState`, `PermissionBoundary`, and
  `FeatureBoundary` under `src/components/shared`.
- `FilterToolbar`, `Pagination`, `MobileEntityCard`, `EntityHeader`,
  `PriorityBadge`, `ConfirmationDialog`, and `ResponsiveTabs` are local shared
  compositions, not a second component system.

These are local implementations, not registry downloads. Review the registry
when certificate access is restored before adding new primitives.
