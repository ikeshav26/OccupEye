import { boolean, integer, pgTable, text, timestamp, varchar } from "drizzle-orm/pg-core";

export const adminsTable = pgTable("admins", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  username: varchar("username", { length: 100 }).notNull().unique(),
  passwordHash: varchar("password_hash", { length: 255 }).notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export type Admin = typeof adminsTable.$inferSelect;
export type NewAdmin = typeof adminsTable.$inferInsert;

export const notificationsTable = pgTable("notifications", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  classroomId: varchar("classroom_id", { length: 100 }).notNull(),
  studentCount: integer("student_count").notNull().default(0),
  fanStatus: varchar("fan_status", { length: 20 }).notNull().default("ON"),
  idleSeconds: integer("idle_seconds").notNull(),
  snapshotUrl: text("snapshot_url"),
  cloudinaryPublicId: varchar("cloudinary_public_id", { length: 255 }),
  isResolved: boolean("is_resolved").notNull().default(false),
  resolvedAt: timestamp("resolved_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type Notification = typeof notificationsTable.$inferSelect;
export type NewNotification = typeof notificationsTable.$inferInsert;

export const pushTokensTable = pgTable("push_tokens", {
  id: integer("id").primaryKey().generatedAlwaysAsIdentity(),
  token: varchar("token", { length: 255 }).notNull().unique(),
  deviceType: varchar("device_type", { length: 50 }).default("unknown"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export type PushToken = typeof pushTokensTable.$inferSelect;
export type NewPushToken = typeof pushTokensTable.$inferInsert;
