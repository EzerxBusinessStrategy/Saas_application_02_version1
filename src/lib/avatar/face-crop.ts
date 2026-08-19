export type FaceBox = {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
};

export type CropRect = {
  readonly x: number;
  readonly y: number;
  readonly size: number;
};

const FACE_PADDING = 2.4;
const FACE_VERTICAL_BIAS = 0.12;

export function calculateCenterCrop(imageWidth: number, imageHeight: number): CropRect {
  const size = Math.min(imageWidth, imageHeight);
  return {
    x: (imageWidth - size) / 2,
    y: (imageHeight - size) / 2,
    size,
  };
}

export function calculateFaceCrop(face: FaceBox, imageWidth: number, imageHeight: number): CropRect {
  const faceSize = Math.max(face.width, face.height);
  const size = Math.min(Math.max(faceSize * FACE_PADDING, 1), imageWidth, imageHeight);
  const faceCenterX = face.x + face.width / 2;
  const faceCenterY = face.y + face.height / 2;
  const x = clamp(faceCenterX - size / 2, 0, Math.max(imageWidth - size, 0));
  const y = clamp(faceCenterY - size / 2 + size * FACE_VERTICAL_BIAS, 0, Math.max(imageHeight - size, 0));
  return { x, y, size };
}

export function selectLargestFace(faces: readonly FaceBox[]): FaceBox | undefined {
  let largest: FaceBox | undefined;
  for (const face of faces) {
    if (!largest || face.width * face.height > largest.width * largest.height) {
      largest = face;
    }
  }
  return largest;
}

export function cropForFaces(
  faces: readonly FaceBox[],
  imageWidth: number,
  imageHeight: number,
): CropRect {
  const face = selectLargestFace(faces);
  return face ? calculateFaceCrop(face, imageWidth, imageHeight) : calculateCenterCrop(imageWidth, imageHeight);
}

export function clampCrop(crop: CropRect, imageWidth: number, imageHeight: number): CropRect {
  const size = Math.min(Math.max(crop.size, 1), imageWidth, imageHeight);
  return {
    x: clamp(crop.x, 0, Math.max(imageWidth - size, 0)),
    y: clamp(crop.y, 0, Math.max(imageHeight - size, 0)),
    size,
  };
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}
