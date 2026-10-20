import { type Request, type Response } from "express";
import { desc, eq } from "drizzle-orm";
import { db } from "../db/db.js";
import { notificationsTable, type NewNotification } from "../db/schema.js";
import { uploadSnapshot, deleteSnapshot } from "../config/cloudinary.js";
import { getIO } from "../sockets/socket.js";

//function to be called by the detection service
export const createAlert = async (req: Request, res: Response): Promise<void> => {
  try {
    const {
      classroom_id = "room_101",
      student_count = 0,
      fan_status = "ON",
      idle_seconds,
      image_base64,
    } = req.body;

    if (idle_seconds === undefined || typeof idle_seconds !== "number") {
      res.status(400).json({
        error: "Bad Request",
        message: "idle_seconds (number) is required",
      });
      return;
    }

    let snapshotUrl: string | null = null;
    let cloudinaryPublicId: string | null = null;

    if (image_base64) {
      const uploadResult = await uploadSnapshot(image_base64);
      if (uploadResult) {
        snapshotUrl = uploadResult.url;
        cloudinaryPublicId = uploadResult.publicId;
      }
    }


    const newRecord: NewNotification = {
      classroomId: classroom_id,
      studentCount: student_count,
      fanStatus: fan_status,
      idleSeconds: idle_seconds,
      snapshotUrl,
      cloudinaryPublicId,
      isResolved: false,
    };

    const [alert] = await db.insert(notificationsTable).values(newRecord).returning();

    try {
      getIO().emit("alert", alert);
      console.log(`[Alert] Emitted new alert #${alert.id} to connected socket clients`);
    } catch (socketErr) {
      console.warn("[Alert] Socket emit skipped (server not fully bound yet):", socketErr);
    }

    res.status(201).json({
      success: true,
      message: "Alert recorded and emitted successfully",
      alert,
    });
  } catch (error) {
    console.error("[Alert] Error handling detection alert:", error);
    res.status(500).json({
      error: "Internal Server Error",
      message: "Failed to record alert",
    });
  }
};


export const getAlerts = async (req: Request, res: Response): Promise<void> => {
  try {
    const { resolved } = req.query;
    let query = db.select().from(notificationsTable);

    if (resolved === "true") {
      query = query.where(eq(notificationsTable.isResolved, true)) as typeof query;
    } else if (resolved === "false") {
      query = query.where(eq(notificationsTable.isResolved, false)) as typeof query;
    }

    const alerts = await query.orderBy(desc(notificationsTable.createdAt));

    res.json({
      success: true,
      count: alerts.length,
      alerts,
    });
  } catch (error) {
    console.error("[Alert] Error fetching alerts:", error);
    res.status(500).json({
      error: "Internal Server Error",
      message: "Failed to fetch alerts",
    });
  }
};


export const resolveAlert = async (req: Request, res: Response): Promise<void> => {
  try {
    const paramId = Array.isArray(req.params.id) ? req.params.id[0] : req.params.id;
    const id = parseInt(paramId, 10);
    if (isNaN(id)) {
      res.status(400).json({ error: "Bad Request", message: "Invalid alert ID" });
      return;
    }


    const [existing] = await db
      .select()
      .from(notificationsTable)
      .where(eq(notificationsTable.id, id))
      .limit(1);

    if (!existing) {
      res.status(404).json({ error: "Not Found", message: "Alert not found" });
      return;
    }


    if (existing.cloudinaryPublicId) {
      console.log(`[Alert] Deleting Cloudinary snapshot: ${existing.cloudinaryPublicId}`);
      await deleteSnapshot(existing.cloudinaryPublicId);
    }

    const resolvedAt = new Date();
    const [updated] = await db
      .update(notificationsTable)
      .set({
        isResolved: true,
        resolvedAt,
        snapshotUrl: null,
        cloudinaryPublicId: null,
      })
      .where(eq(notificationsTable.id, id))
      .returning();


    try {
      getIO().emit("alert:resolved", updated);
    } catch (socketErr) {
      console.warn("[Alert] Socket emit skipped:", socketErr);
    }

    res.json({
      success: true,
      message: "Alert marked as resolved and snapshot removed from Cloudinary",
      alert: updated,
    });
  } catch (error) {
    console.error("[Alert] Error resolving alert:", error);
    res.status(500).json({
      error: "Internal Server Error",
      message: "Failed to resolve alert",
    });
  }
};
