import { createServer } from "node:http";
import dotenv from "dotenv";
dotenv.config();

import app from "./app.js";
import { env } from "./config/env.js";
import { initSocketServer } from "./sockets/socket.js";
import { keepAwake } from "@ikeshav26/keep-awake";

const httpServer = createServer(app);

initSocketServer(httpServer);

httpServer.listen(env.PORT, () => {
  console.log(`[OccupEye] HTTP & WebSocket Server running on http://localhost:${env.PORT}`);

  const apiUrl = process.env.API_URL;
  if (apiUrl) {
    const interval = parseInt(process.env.KEEP_AWAKE_INTERVAL || "1", 10);
    keepAwake({
      url: apiUrl,
      interval,
    });
    console.log(`[KeepAwake] Active: pinging ${apiUrl} every ${interval} min`);
  }
});
