import { Router } from "express";
import { createAlert, getAlerts, resolveAlert, registerPushToken } from "../controllers/alert.controller.js";
import { requireAdminAuth } from "../middleware/auth.js";

const router = Router();

router.post("/", createAlert);
router.post("/push-token", registerPushToken);

router.get("/", requireAdminAuth, getAlerts);
router.patch("/:id/resolve", requireAdminAuth, resolveAlert);

export default router;
