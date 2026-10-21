import { Router } from "express";
import { login, logout, me, changePassword, updateUsername } from "../controllers/auth.controller.js";
import { requireAdminAuth } from "../middleware/auth.js";

const router = Router();

// Public login & logout
router.post("/login", login);
router.post("/logout", logout);

// Authenticated admin endpoints
router.get("/me", requireAdminAuth, me);
router.patch("/change-password", requireAdminAuth, changePassword);
router.patch("/update-username", requireAdminAuth, updateUsername);

export default router;
