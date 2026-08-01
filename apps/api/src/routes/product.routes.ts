import { Router } from "express";
import * as productController from "../controllers/product.controller";
import { requireAuth } from "../middleware/auth.middleware";
import { requireRole } from "../middleware/rbac.middleware";
import { apiRateLimit } from "../middleware/rate-limit.middleware";
import { auditLog } from "../middleware/audit.middleware";
import { asyncHandler } from "../lib/async-handler";

export const productRouter = Router();
productRouter.use(requireAuth, apiRateLimit());

productRouter.post(
  "/",
  requireRole("owner", "admin"),
  auditLog("product.create", "product"),
  asyncHandler(productController.create),
);
// Sales staff need the catalog to render the sale-logging grid — the only
// route in this file open to "staff", not just owner/admin.
productRouter.get(
  "/",
  requireRole("owner", "admin", "staff"),
  asyncHandler(productController.list),
);
// Low-stock alerts (value-add follow-up) — owner/admin dashboard reporting
// surface, same tier as sale/cash-check history views. Registered before
// "/:productId" routes purely for readability; Express wouldn't confuse the
// two regardless since "/low-stock" only matches GET / exactly, not the
// param route.
productRouter.get(
  "/low-stock",
  requireRole("owner", "admin"),
  asyncHandler(productController.lowStock),
);
productRouter.patch(
  "/:productId",
  requireRole("owner", "admin"),
  auditLog("product.update", "product"),
  asyncHandler(productController.update),
);
productRouter.post(
  "/:productId/deactivate",
  requireRole("owner", "admin"),
  auditLog("product.deactivate", "product"),
  asyncHandler(productController.deactivate),
);
