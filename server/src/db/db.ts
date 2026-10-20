import dotenv from "dotenv";
dotenv.config();

import { defineRelations } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema.js";

const { Pool } = pg;

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not defined in server/.env");
}

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export const relations = defineRelations(schema, () => ({}));

export const db = drizzle({ client: pool, relations });
export default db;
