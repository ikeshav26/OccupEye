import { type Request, type Response, type NextFunction } from "express";
import jwt from "jsonwebtoken";
import { env } from "../config/env.js";

export interface AuthenticatedUser {
  username: string;
  role: string;
}

export interface AuthenticatedRequest extends Request {
  user?: AuthenticatedUser;
}

export function requireAdminAuth(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  let token: string | undefined;

  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    token = authHeader.substring(7).trim();
  }

  if (!token && req.cookies && typeof req.cookies.token === "string") {
    token = req.cookies.token;
  }

  if (!token && typeof req.headers["x-auth-token"] === "string") {
    token = req.headers["x-auth-token"];
  }

  if (!token) {
    res.status(401).json({
      error: "Unauthorized",
      message: "Authentication token required. Provide via cookie or Authorization: Bearer <token>",
    });
    return;
  }

  try {
    const decoded = jwt.verify(token, env.JWT_SECRET) as AuthenticatedUser;
    req.user = decoded;
    next();
  } catch {
    res.status(401).json({
      error: "Unauthorized",
      message: "Invalid or expired token",
    });
  }
}
