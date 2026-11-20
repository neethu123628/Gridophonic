import "dotenv/config";
import { createServer } from "node:http";
import app from "./app.js";
import { connectDB } from "../srcconfig/db.js";
import { attachSocketServer } from "./socket.js";

const port = process.env.PORT || 5002;
const httpServer = createServer(app);

const io = attachSocketServer(httpServer);
app.set("io", io);

async function startServer() {
  try {
    await connectDB();

    httpServer.listen(port, () => {
      console.log(`Gridophonic API listening at http://localhost:${port}`);
    });
  } catch (error) {
    console.error("Could not start the server:", error.message);
    process.exit(1);
  }
}

startServer();