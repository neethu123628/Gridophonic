import express from "express";
import cors from "cors";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import authRoutes from "./routes/authRoutes.js";
import projectRoutes from "./routes/projectRoutes.js";
import adminRoutes from "./routes/adminRoutes.js";
import classroomRoutes from "./routes/classroomRoutes.js";
import profileRoutes from "./routes/profileRoutes.js";

const app = express();

app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        ...helmet.contentSecurityPolicy.getDefaultDirectives(),
        "font-src": ["'self'", "https:", "data:"],
        "style-src": ["'self'", "'unsafe-inline'", "https:"],
      },
    },
  })
);

app.use(
  cors({
    origin: process.env.CLIENT_URL,
    credentials: true,
  })
);

app.use(express.json({ limit: "1mb" }));
app.use(cookieParser());

// Root endpoint prevents "Cannot GET /" when opening the service URL.
// app.get("/", (_req, res) => {
//   res.json({ status: "ok", app: "Gridophonic API" });
// });

// app.get("/api/health", (_req, res) => {
//   res.json({
//     status: "ok",
//     app: "Gridophonic API",
//   });
// });

app.use("/api/auth", authRoutes);
app.use("/api/projects", projectRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/classrooms", classroomRoutes);
app.use("/api/profile", profileRoutes);

export default app;
