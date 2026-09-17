import type { Request, Response } from "express";
import * as storedFileRepo from "../repositories/stored-file.repository";
import * as receiptOcrService from "../services/receipt-ocr.service";
import { sendSuccess } from "../lib/response";
import { getAuthContext } from "../lib/auth-context";
import { ValidationError, NotFoundError, InsufficientPermissionError } from "../lib/errors";

// Any authenticated org member can scan a receipt — an expense claim is
// typically submitted by the person who spent the money, not just
// owner/admin, so this can't be gated the same way payroll/KYC are.
export async function scan(req: Request, res: Response) {
  const { orgId, userId } = getAuthContext(req);
  if (!req.file) {
    throw new ValidationError("No receipt file was uploaded", "receipt");
  }

  const stored = await storedFileRepo.create(orgId, userId, req.file.buffer, req.file.mimetype);
  const extracted = await receiptOcrService.extractReceiptData(
    req.file.buffer,
    req.file.originalname,
    req.file.mimetype,
  );

  sendSuccess(res, { storedFileId: stored.id, extracted }, 201);
}

// Streams a previously-uploaded file back — owner/admin can view any
// receipt in the org; anyone else only their own (same "your own claims"
// boundary expense-claim.service.ts will apply once it exists).
export async function download(req: Request, res: Response) {
  const { orgId, userId, role } = getAuthContext(req);
  const file = await storedFileRepo.findById(orgId, req.params.fileId!);
  if (!file) throw new NotFoundError("File not found");

  const isOwnerOrAdmin = role === "owner" || role === "admin";
  if (!isOwnerOrAdmin && file.uploadedByUserId !== userId) {
    throw new InsufficientPermissionError("You don't have access to this file");
  }

  res.setHeader("Content-Type", file.mimeType);
  res.send(file.content);
}
