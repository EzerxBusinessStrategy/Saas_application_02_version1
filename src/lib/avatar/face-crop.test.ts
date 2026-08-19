import { describe, expect, it } from "vitest";
import { calculateCenterCrop, calculateFaceCrop, cropForFaces, selectLargestFace } from "./face-crop";

describe("face crop", () => {
  it("centers a square on the largest face and keeps it inside the image", () => {
    const crop = calculateFaceCrop({ x: 400, y: 80, width: 80, height: 100 }, 800, 600);
    expect(crop.size).toBe(240);
    expect(crop.x).toBeGreaterThanOrEqual(0);
    expect(crop.y).toBeGreaterThanOrEqual(0);
    expect(crop.x + crop.size).toBeLessThanOrEqual(800);
    expect(crop.y + crop.size).toBeLessThanOrEqual(600);
    expect(crop.x + crop.size / 2).toBeCloseTo(440);
  });

  it("falls back to a centered square when no face is found", () => {
    expect(calculateCenterCrop(1000, 400)).toEqual({ x: 300, y: 0, size: 400 });
    expect(cropForFaces([], 1000, 400)).toEqual({ x: 300, y: 0, size: 400 });
  });

  it("uses the largest detected face", () => {
    const largest = selectLargestFace([
      { x: 10, y: 10, width: 20, height: 20 },
      { x: 100, y: 40, width: 80, height: 90 },
    ]);
    expect(largest).toEqual({ x: 100, y: 40, width: 80, height: 90 });
  });
});
