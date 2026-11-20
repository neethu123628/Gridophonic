import { Server } from "socket.io";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";
import Project from "./models/project.js";
import User from "./models/User.js";
import Classroom from "./models/Classroom.js";

function readCookie(header, name) {
  for (const part of (header || "").split(";")) {
    const separator = part.indexOf("=");

    if (separator === -1) continue;

    const key = part.slice(0, separator).trim();
    const value = part.slice(separator + 1).trim();

    if (key === name) {
      return decodeURIComponent(value);
    }
  }

  return null;
}

function projectRoom(projectId) {
  return `project:${projectId}`;
}

function classroomRoom(classroomId) {
  return `classroom:${classroomId}`;
}

function getUpdates(body = {}) {
  const updates = {};

  if (body.title !== undefined) {
    if (
      typeof body.title !== "string" ||
      body.title.trim().length < 1 ||
      body.title.trim().length > 100
    ) {
      return { error: "Title must be between 1 and 100 characters" };
    }

    updates.title = body.title.trim();
  }

  if (body.bpm !== undefined) {
    if (!Number.isInteger(body.bpm) || body.bpm < 40 || body.bpm > 240) {
      return { error: "BPM must be a whole number from 40 to 240" };
    }

    updates.bpm = body.bpm;
  }

  if (body.stepCount !== undefined) {
    if (![8, 16].includes(body.stepCount)) {
      return { error: "Step count must be 8 or 16" };
    }

    updates.stepCount = body.stepCount;
  }

  if (body.tracks !== undefined) {
    if (!Array.isArray(body.tracks) || body.tracks.length > 32) {
      return { error: "Tracks must be an array with no more than 32 items" };
    }

    updates.tracks = body.tracks;
  }

  if (Object.keys(updates).length === 0) {
    return { error: "No project fields provided" };
  }

  return { updates };
}

async function sendPresence(io, projectId) {
  const room = projectRoom(projectId);
  const sockets = await io.in(room).fetchSockets();
  const usersById = new Map();

  for (const socket of sockets) {
    const user = socket.data.user;

    if (user) {
      usersById.set(user.id, {
        id: user.id,
        name: user.name
      });
    }
  }

  io.to(room).emit("room:presence", [...usersById.values()]);
}

export function attachSocketServer(httpServer) {
  const io = new Server(httpServer, {
    cors: {
      origin: process.env.CLIENT_URL,
      credentials: true
    }
  });

  // Authenticate each Socket.IO connection using the login cookie.
  io.use(async (socket, next) => {
    try {
      const token = readCookie(socket.handshake.headers.cookie, "token");

      if (!token) {
        return next(new Error("Please log in"));
      }

      const payload = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(payload.userId);

      if (!user || user.status !== "active") {
        return next(new Error("Account is unavailable"));
      }

      socket.data.user = {
        id: user._id.toString(),
        name: user.name
      };

      next();
    } catch {
      next(new Error("Invalid or expired login"));
    }
  });

  io.on("connection", (socket) => {
    socket.on("project:join", async (body = {}, acknowledge) => {
      const reply = typeof acknowledge === "function" ? acknowledge : () => {};
      const projectId = body.projectId;

      try {
        if (!mongoose.isValidObjectId(projectId)) {
          return reply({ error: "Invalid project ID" });
        }

        const project = await Project.findOne({
          _id: projectId,
          $or: [
            { owner: socket.data.user.id },
            { collaborators: socket.data.user.id }
          ]
        });

        if (!project) {
          return reply({ error: "Project not found or access denied" });
        }

        const previousProjectId = socket.data.projectId;

        if (previousProjectId) {
          await socket.leave(projectRoom(previousProjectId));
          socket.data.projectId = null;
          await sendPresence(io, previousProjectId);
        }

        socket.data.projectId = project._id.toString();
        await socket.join(projectRoom(socket.data.projectId));

        reply({
          project: project.toObject(),
          user: socket.data.user
        });

        await sendPresence(io, socket.data.projectId);
      } catch (error) {
        console.error("Socket join error:", error.message);
        reply({ error: "Could not join project room" });
      }
    });

    socket.on("project:update", async (body = {}, acknowledge) => {
      const reply = typeof acknowledge === "function" ? acknowledge : () => {};
      const projectId = socket.data.projectId;

      if (!projectId) {
        return reply({ error: "Join a project room first" });
      }

      const result = getUpdates(body);

      if (result.error) {
        return reply({ error: result.error });
      }

      try {
        const project = await Project.findOneAndUpdate(
          {
            _id: projectId,
            $or: [
              { owner: socket.data.user.id },
              { collaborators: socket.data.user.id }
            ]
          },
          { $set: result.updates },
          { new: true, runValidators: true }
        );

        if (!project) {
          return reply({ error: "Project not found or access denied" });
        }

        const projectData = project.toObject();
        delete projectData.collaborators;

        io.to(projectRoom(projectId)).emit("project:updated", {
          project: projectData,
          updatedBy: socket.data.user
        });

        reply({ ok: true });
      } catch (error) {
        console.error("Socket update error:", error.message);
        reply({ error: "Could not update project" });
      }
    });

    // Join a classroom room so this user's browser can receive its notifications.
    socket.on("classroom:join", async (body = {}, acknowledge) => {
      const reply = typeof acknowledge === "function" ? acknowledge : () => {};
      const classroomId = body.classroomId;

      try {
        if (!mongoose.isValidObjectId(classroomId)) {
          return reply({ error: "Invalid classroom ID" });
        }

        const classroom = await Classroom.findOne({
          _id: classroomId,
          "members.user": socket.data.user.id
        }).select("_id");

        if (!classroom) {
          return reply({ error: "Classroom not found or access denied" });
        }

        const previousClassroomId = socket.data.classroomId;

        if (previousClassroomId) {
          await socket.leave(classroomRoom(previousClassroomId));
        }

        socket.data.classroomId = classroom._id.toString();
        await socket.join(classroomRoom(socket.data.classroomId));

        reply({ ok: true, classroomId: socket.data.classroomId });
      } catch (error) {
        console.error("Classroom socket join error:", error.message);
        reply({ error: "Could not join classroom notifications" });
      }
    });

    socket.on("disconnect", async () => {
      const projectId = socket.data.projectId;

      if (projectId) {
        await sendPresence(io, projectId);
      }
    });
  });

  return io;
}