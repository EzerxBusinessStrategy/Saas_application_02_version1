import { BadRequestException, Inject, Injectable, ServiceUnavailableException } from "@nestjs/common";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { randomUUID } from "node:crypto";
import { APP_CONFIG } from "../config/app-config.module";
import type { AppConfig } from "../config/app-config";

const MAX_DOCUMENT_SIZE_BYTES = 20 * 1024 * 1024;
const ALLOWED_CONTENT_TYPES = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/csv",
  "text/plain",
  "image/png",
  "image/jpeg",
  "image/webp",
  "application/zip",
  "application/x-zip-compressed",
]);

export const documentStoragePortals = ["SUPER_ADMIN", "TENANT", "MANAGER", "EMPLOYEE", "CLIENT"] as const;
export type DocumentStoragePortal = (typeof documentStoragePortals)[number];
export type StoredDocumentObject = { readonly storageBucket: string; readonly storageKey: string };

const bucketForPortal: Record<DocumentStoragePortal, string> = {
  SUPER_ADMIN: "super-admin-documents",
  TENANT: "tenant-documents",
  MANAGER: "manager-documents",
  EMPLOYEE: "employee-documents",
  CLIENT: "client-documents",
};

export function documentStorageBucket(portal: DocumentStoragePortal): string {
  return bucketForPortal[portal];
}

export function tenantDocumentObjectPrefix(input: {
  tenantId: string;
  clientId?: string;
  portal: DocumentStoragePortal;
}): string {
  const portal = input.portal.toLowerCase();
  return input.clientId
    ? `tenants/${input.tenantId}/clients/${input.clientId}/${portal}/`
    : `tenants/${input.tenantId}/internal/${portal}/`;
}

@Injectable()
export class TenantDocumentStorageService {
  private readonly client: SupabaseClient | null;

  constructor(@Inject(APP_CONFIG) config: AppConfig) {
    this.client = config.supabaseUrl && config.supabaseAdminKey
      ? createClient(config.supabaseUrl, config.supabaseAdminKey, {
          auth: {
            autoRefreshToken: false,
            detectSessionInUrl: false,
            persistSession: false,
            skipAutoInitialize: true,
          },
        })
      : null;
  }

  async createSignedUploadUrl(input: {
    tenantId: string;
    clientId?: string;
    portal: DocumentStoragePortal;
    fileName: string;
    contentType: string;
    sizeBytes: number;
    operationId?: string;
  }): Promise<StoredDocumentObject & { signedUrl: string }> {
    this.assertFileMetadata(input.fileName, input.contentType, input.sizeBytes);
    const client = this.requireClient();
    const extension = extensionFor(input.fileName);
    const operationId = input.operationId ?? randomUUID();
    assertUuid(operationId, "DOCUMENT_OPERATION_INVALID", "The upload operation is invalid. Start the upload again.");
    if (input.clientId) {
      assertUuid(input.clientId, "CLIENT_NOT_AVAILABLE", "Select an available client.");
    }
    const storageBucket = documentStorageBucket(input.portal);
    const storageKey = `${tenantDocumentObjectPrefix({
      tenantId: input.tenantId,
      clientId: input.clientId,
      portal: input.portal,
    })}${operationId}.${extension}`;
    const { data, error } = await client.storage
      .from(storageBucket)
      .createSignedUploadUrl(storageKey, { upsert: false });
    if (error || !data?.signedUrl) {
      throw new ServiceUnavailableException({
        code: "DOCUMENT_STORAGE_UNAVAILABLE",
        message: "Document storage is temporarily unavailable. Please try again.",
      });
    }
    return { storageBucket, storageKey, signedUrl: data.signedUrl };
  }

  async verifyUploadedFile(input: {
    tenantId: string;
    clientId?: string;
    portal: DocumentStoragePortal;
    storageKey: string;
    fileName: string;
    contentType: string;
    sizeBytes: number;
  }): Promise<StoredDocumentObject> {
    this.assertFileMetadata(input.fileName, input.contentType, input.sizeBytes);
    const expectedPrefix = tenantDocumentObjectPrefix({
      tenantId: input.tenantId,
      clientId: input.clientId,
      portal: input.portal,
    });
    if (!input.storageKey.startsWith(expectedPrefix)) {
      throw new BadRequestException({
        code: "DOCUMENT_STORAGE_KEY_INVALID",
        message: input.clientId
          ? "The uploaded file does not match the selected client."
          : "The uploaded file does not match this tenant document.",
      });
    }
    const storageBucket = documentStorageBucket(input.portal);
    const { data, error } = await this.requireClient().storage.from(storageBucket).download(input.storageKey);
    if (error || !data) {
      throw new BadRequestException({ code: "DOCUMENT_UPLOAD_INCOMPLETE", message: "The file upload did not finish. Select the file and try again." });
    }
    if (data.size !== input.sizeBytes) {
      throw new BadRequestException({ code: "DOCUMENT_SIZE_INVALID", message: "The uploaded file size does not match the selected file." });
    }
    assertFileSignature(input.fileName, new Uint8Array(await data.slice(0, 16).arrayBuffer()));
    return { storageBucket, storageKey: input.storageKey };
  }

  async createSignedDownloadUrl(object: StoredDocumentObject): Promise<string> {
    const { data, error } = await this.requireClient().storage
      .from(object.storageBucket)
      .createSignedUrl(object.storageKey, 60);
    if (error || !data?.signedUrl) {
      throw new ServiceUnavailableException({
        code: "DOCUMENT_DOWNLOAD_UNAVAILABLE",
        message: "This document is temporarily unavailable. Please try again.",
      });
    }
    return data.signedUrl;
  }

  async storeGeneratedInvoice(input: {
    tenantId: string;
    clientId: string;
    invoiceId: string;
    content: Buffer;
  }): Promise<StoredDocumentObject> {
    const storageBucket = documentStorageBucket("TENANT");
    const storageKey = `tenants/${input.tenantId}/clients/${input.clientId}/tenant/invoices/${input.invoiceId}.pdf`;
    const { error } = await this.requireClient().storage
      .from(storageBucket)
      .upload(storageKey, input.content, {
        contentType: "application/pdf",
        upsert: true,
      });
    if (error) {
      throw new ServiceUnavailableException({
        code: "INVOICE_STORAGE_UNAVAILABLE",
        message: "The invoice file is temporarily unavailable. Please try again.",
      });
    }
    return { storageBucket, storageKey };
  }

  private requireClient(): SupabaseClient {
    if (!this.client) {
      throw new ServiceUnavailableException({
        code: "DOCUMENT_STORAGE_NOT_CONFIGURED",
        message: "Document storage is not configured. Contact platform support.",
      });
    }
    return this.client;
  }

  private assertFileMetadata(fileName: string, contentType: string, sizeBytes: number): void {
    const extension = extensionFor(fileName);
    if (!ALLOWED_CONTENT_TYPES.has(contentType)) {
      throw new BadRequestException({ code: "DOCUMENT_TYPE_INVALID", message: "This file type is not supported." });
    }
    if (sizeBytes < 1 || sizeBytes > MAX_DOCUMENT_SIZE_BYTES) {
      throw new BadRequestException({ code: "DOCUMENT_SIZE_INVALID", message: "Documents must be between 1 byte and 20 MB." });
    }
    if (!allowedExtensionsFor(contentType).includes(extension)) {
      throw new BadRequestException({ code: "DOCUMENT_TYPE_INVALID", message: "The file extension does not match its file type." });
    }
  }
}

function assertUuid(value: string, code: string, message: string): void {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) {
    throw new BadRequestException({ code, message });
  }
}

function extensionFor(fileName: string): string {
  const extension = fileName.trim().toLowerCase().split(".").pop();
  if (!extension || !/^[a-z0-9]{1,8}$/.test(extension)) {
    throw new BadRequestException({ code: "DOCUMENT_FILENAME_INVALID", message: "Select a file with a supported extension." });
  }
  return extension;
}

function allowedExtensionsFor(contentType: string): readonly string[] {
  return {
    "application/pdf": ["pdf"],
    "application/msword": ["doc"],
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document": ["docx"],
    "application/vnd.ms-excel": ["xls"],
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": ["xlsx"],
    "text/csv": ["csv"],
    "text/plain": ["txt"],
    "image/png": ["png"],
    "image/jpeg": ["jpg", "jpeg"],
    "image/webp": ["webp"],
    "application/zip": ["zip"],
    "application/x-zip-compressed": ["zip"],
  }[contentType] ?? [];
}

function assertFileSignature(fileName: string, bytes: Uint8Array): void {
  const extension = extensionFor(fileName);
  const matches = (expected: readonly number[], offset = 0) => expected.every((byte, index) => bytes[offset + index] === byte);
  const zip = matches([0x50, 0x4b, 0x03, 0x04]) || matches([0x50, 0x4b, 0x05, 0x06]) || matches([0x50, 0x4b, 0x07, 0x08]);
  const valid =
    extension === "pdf" ? matches([0x25, 0x50, 0x44, 0x46, 0x2d]) :
    extension === "png" ? matches([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]) :
    ["jpg", "jpeg"].includes(extension) ? matches([0xff, 0xd8, 0xff]) :
    extension === "webp" ? matches([0x52, 0x49, 0x46, 0x46]) && matches([0x57, 0x45, 0x42, 0x50], 8) :
    ["docx", "xlsx", "zip"].includes(extension) ? zip :
    extension === "doc" || extension === "xls" ? matches([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]) :
    ["csv", "txt"].includes(extension) ? !bytes.includes(0) : false;
  if (!valid) {
    throw new BadRequestException({ code: "DOCUMENT_CONTENT_INVALID", message: "The uploaded file content does not match its file type." });
  }
}
