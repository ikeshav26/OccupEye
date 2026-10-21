import { createServer } from "node:http";
import dotenv from "dotenv";
dotenv.config();

import app from "./src/app.js";
import { env } from "./src/config/env.js";
import { initSocketServer } from "./src/sockets/socket.js";

const port = env.PORT;
const httpServer = createServer(app);

initSocketServer(httpServer);

httpServer.listen(port, () => {
  console.log(`[OccupEye] Server running on port ${port}`);
});