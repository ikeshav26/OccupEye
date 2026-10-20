import { type Request, type Response } from "express";
import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
import { type AuthenticatedRequest } from "../middleware/auth.js";

export async function login(req: Request, res: Response): Promise<void> {
  const { username, password } = req.body;

  if (!username || !password) {
    res.status(400).json({
      error: "Bad Request",
      message: "Both username and password are required",
    });
    return;
  }

  if (username !== env.ADMIN_USERNAME || password !== env.ADMIN_PASSWORD) {
    res.status(401).json({
      error: "Unauthorized",
      message: "Invalid credentials",
    });
    return;
  }

  const token = jwt.sign(
    { username: env.ADMIN_USERNAME, role: "admin" },
    env.JWT_SECRET,
    { expiresIn: "7d" }
  );


  res.cookie("token", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: "/",
  });

  res.json({
    success: true,
    message: "Login successful",
    token,
    user: {
      username: env.ADMIN_USERNAME,
      role: "admin",
    },
  });
}

export async function logout(_req: Request, res: Response): Promise<void> {
  res.clearCookie("token", { path: "/" });
  res.json({
    success: true,
    message: "Logout successful",
  });
}

export async function me(req: AuthenticatedRequest, res: Response): Promise<void> {
  res.json({
    success: true,
    user: req.user,
  });
}
