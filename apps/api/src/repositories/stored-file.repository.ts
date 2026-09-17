import { randomUUID } from "node:crypto";
import { withOrgScope } from "../lib/prisma";
import type { StoredFile } from "@prisma/client";

export async function create(
  orgId: string,
  uploadedByUserId: string,
  content: Buffer,
  mimeType: string,
): Promise<StoredFile> {
  return withOrgScope(orgId, (tx) =>
    tx.storedFile.create({
      data: {
        id: randomUUID(),
        orgId,
        uploadedByUserId,
        mimeType,
        sizeBytes: content.byteLength,
        content,
      },
    }),
  );
}

export async function findById(orgId: string, fileId: string): Promise<StoredFile | null> {
  return withOrgScope(orgId, (tx) => tx.storedFile.findFirst({ where: { id: fileId, orgId } }));
}
