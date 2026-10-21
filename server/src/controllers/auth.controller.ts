import { type Request, type Response } from "express";
import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { db } from "../db/db.js";
import { adminsTable } from "../db/schema.js";
import { env } from "../config/env.js";
import { type AuthenticatedRequest } from "../middleware/auth.js";

/**
 * Admin Login: validates credentials against the database with bcrypt
 */
export async function login(req: Request, res: Response): Promise<void> {
  const { username, password } = req.body;

  if (!username || !password) {
    res.status(400).json({
      error: "Bad Request",
      message: "Both username and password are required",
    });
    return;
  }

  try {
    const [admin] = await db
      .select()
      .from(adminsTable)
      .where(eq(adminsTable.username, username.trim()))
      .limit(1);

    if (!admin) {
      res.status(401).json({
        error: "Unauthorized",
        message: "Invalid username or password",
      });
      return;
    }

    const isValidPassword = await bcrypt.compare(password, admin.passwordHash);

    if (!isValidPassword) {
      res.status(401).json({
        error: "Unauthorized",
        message: "Invalid username or password",
      });
      return;
    }

    const token = jwt.sign(
      { username: admin.username, role: "admin" },
      env.JWT_SECRET,
      { expiresIn: "30d" }
    );

    // Set HTTP-only cookie with standard options for web browsers
    res.cookie("token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 30 * 24 * 60 * 60 * 1000,
      path: "/",
    });

    res.json({
      success: true,
      message: "Login successful",
      token,
      user: {
        username: admin.username,
        role: "admin",
      },
    });
  } catch (error) {
    console.error("[Auth] Login error:", error);
    res.status(500).json({
      error: "Internal Server Error",
      message: "Login failed due to a server error",
    });
  }
}

/**
 * Change Password: allows the authenticated admin to change their own password
 */
export async function changePassword(req: AuthenticatedRequest, res: Response): Promise<void> {
  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword) {
    res.status(400).json({
      error: "Bad Request",
      message: "Both currentPassword and newPassword are required",
    });
    return;
  }

  if (newPassword.length < 6) {
    res.status(400).json({
      error: "Bad Request",
      message: "New password must be at least 6 characters long",
    });
    return;
  }

  try {
    const username = req.user?.username;
    if (!username) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const [admin] = await db
      .select()
      .from(adminsTable)
      .where(eq(adminsTable.username, username))
      .limit(1);

    if (!admin) {
      res.status(404).json({ error: "Not Found", message: "Admin account not found" });
      return;
    }

    const isMatch = await bcrypt.compare(currentPassword, admin.passwordHash);
    if (!isMatch) {
      res.status(401).json({ error: "Unauthorized", message: "Current password is incorrect" });
      return;
    }

    const newHash = await bcrypt.hash(newPassword, 10);

    await db
      .update(adminsTable)
      .set({
        passwordHash: newHash,
        updatedAt: new Date(),
      })
      .where(eq(adminsTable.id, admin.id));

    res.json({
      success: true,
      message: "Password changed successfully",
    });
  } catch (error) {
    console.error("[Auth] Change password error:", error);
    res.status(500).json({
      error: "Internal Server Error",
      message: "Failed to update password",
    });
  }
}

export async function updateUsername(req: AuthenticatedRequest, res: Response): Promise<void> {
  const { newUsername } = req.body;

  if (!newUsername || newUsername.trim().length < 3) {
    res.status(400).json({
      error: "Bad Request",
      message: "New username must be at least 3 characters long",
    });
    return;
  }

  try {
    const currentUsername = req.user?.username;
    if (!currentUsername) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const [admin] = await db
      .select()
      .from(adminsTable)
      .where(eq(adminsTable.username, currentUsername))
      .limit(1);

    if (!admin) {
      res.status(404).json({ error: "Not Found", message: "Admin account not found" });
      return;
    }

    const cleanUsername = newUsername.trim();
    await db
      .update(adminsTable)
      .set({
        username: cleanUsername,
        updatedAt: new Date(),
      })
      .where(eq(adminsTable.id, admin.id));

    const token = jwt.sign(
      { username: cleanUsername, role: "admin" },
      env.JWT_SECRET,
      { expiresIn: "30d" }
    );

    res.json({
      success: true,
      message: "Username updated successfully",
      token,
      user: {
        username: cleanUsername,
        role: "admin",
      },
    });
  } catch (error) {
    console.error("[Auth] Update username error:", error);
    res.status(500).json({
      error: "Internal Server Error",
      message: "Failed to update username",
    });
  }
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
