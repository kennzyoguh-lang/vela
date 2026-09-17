import multer from "multer";
import { ValidationError } from "./errors";

// 5MB cap — comfortably holds a phone photo of a receipt while keeping a
// single Postgres row (schema.prisma's comment on StoredFile explains the
// "no object-storage layer yet" tradeoff) from ever growing unreasonably
// large. Memory storage, not disk: the buffer goes straight into the
// database, never touching this process's local filesystem.
const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024;

const ALLOWED_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "application/pdf"]);

export const uploadSingleFile = (fieldName: string) =>
  multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: MAX_FILE_SIZE_BYTES },
    fileFilter: (_req, file, cb) => {
      if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
        cb(new ValidationError(`Unsupported file type: ${file.mimetype}`));
        return;
      }
      cb(null, true);
    },
  }).single(fieldName);
