import express, { type Request, type Response } from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import authRoutes from "./routes/auth.routes.js";
import alertRoutes from "./routes/alert.routes.js";

const app = express();

app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: "15mb" }));
app.use(cookieParser());

app.get("/", (_req: Request, res: Response) => {
  res.json({
    name: "OccupEye API",
    status: "active",
    endpoints: {
      auth: "POST /api/auth/login",
      alerts: "POST /api/alerts (Ingestion from sensor) | GET /api/alerts (Admin)",
      resolve: "PATCH /api/alerts/:id/resolve (Admin)",
      websocket: "Socket.IO (events: 'alert', 'alert:resolved')",
    },
  });
});

app.use("/api/auth", authRoutes);
app.use("/api/alerts", alertRoutes);

export default app;