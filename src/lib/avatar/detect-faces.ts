import type { FaceBox } from "@/lib/avatar/face-crop";

type FaceDetectorCtor = new (options?: {
  fastMode?: boolean;
  maxDetectedFaces?: number;
}) => {
  detect(input: ImageBitmapSource): Promise<Array<{ boundingBox: DOMRectReadOnly }>>;
};

export async function detectFaces(image: HTMLImageElement): Promise<FaceBox[]> {
  const Detector = (globalThis as { FaceDetector?: FaceDetectorCtor }).FaceDetector;
  if (!Detector) return [];
  try {
    const detector = new Detector({ fastMode: true, maxDetectedFaces: 8 });
    const detected = await detector.detect(image);
    return detected.map((item) => ({
      x: item.boundingBox.x,
      y: item.boundingBox.y,
      width: item.boundingBox.width,
      height: item.boundingBox.height,
    }));
  } catch {
    return [];
  }
}
