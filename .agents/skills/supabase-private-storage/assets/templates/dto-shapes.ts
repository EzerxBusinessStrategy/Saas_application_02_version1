export type CreateUploadSessionRequest = {
  fileName: string;
  declaredMimeType: string;
  sizeBytes: number;
  category: string;
};

export type CreateUploadSessionResponse = {
  documentId: string;
  uploadUrl: string;
  expiresAt: string;
};

export type CreateDownloadUrlResponse = {
  downloadUrl: string;
  expiresAt: string;
};
