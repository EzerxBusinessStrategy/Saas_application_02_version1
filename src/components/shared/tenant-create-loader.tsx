"use client";

export function TenantCreateLoader() {
  return (
    <div className="tenant-create-loader" role="status" aria-label="Opening tenant creation">
      <div className="tenant-create-loader__box" aria-hidden="true" />
      <svg viewBox="0 0 100 100" aria-hidden="true">
        <defs>
          <mask id="tenant-create-clipping">
            <rect width="100" height="100" fill="black" />
            <g id="tenant-create-clipping-shapes" fill="white">
              <polygon points="50,8 62,38 50,50 38,38" />
              <polygon points="50,50 86,34 70,62" />
              <polygon points="50,50 70,62 62,92 38,70" />
              <polygon points="50,50 38,70 12,62 30,38" />
              <polygon points="50,50 30,38 38,8 62,30" />
              <polygon points="50,50 62,30 92,38 70,50" />
              <polygon points="50,50 70,50 62,92 38,70" />
            </g>
          </mask>
        </defs>
      </svg>
    </div>
  );
}
