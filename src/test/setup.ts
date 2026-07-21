import "@testing-library/jest-dom/vitest";

class ResizeObserverMock {
  constructor(
    private readonly callback: (
      entries: Array<{ contentRect: { width: number; height: number } }>,
    ) => void,
  ) {}

  observe() {
    this.callback([{ contentRect: { width: 800, height: 256 } }]);
  }
  unobserve() {}
  disconnect() {}
}

Object.defineProperty(window, "ResizeObserver", {
  value: ResizeObserverMock,
  writable: true,
});
