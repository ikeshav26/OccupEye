import { createServer } from "node:http";
import dotenv from "dotenv";
dotenv.config();

import app from "./app.js";
import { env } from "./config/env.js";
import { initSocketServer } from "./sockets/socket.js";

const httpServer = createServer(app);

initSocketServer(httpServer);

httpServer.listen(env.PORT, () => {
  console.log(`[OccupEye] HTTP & WebSocket Server running on http://localhost:${env.PORT}`);
});
