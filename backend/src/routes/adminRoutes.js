import { Router } from "express";
import mongoose from "mongoose";
import User from "../models/User.js";
import Project from "../models/project.js";
import { requireAuth, requireAdmin } from "../middleware/requireAuth.js";

const router = Router();

router.use(requireAuth, requireAdmin);

// View users. Optional filters: ?search=name-or-email&status=active
router.get("/users", async (req, res) => {
  try {
    const filter = {};

    if (["active", "suspended", "banned"].includes(req.query.status)) {
      filter.status = req.query.status;
    }

    if (typeof req.query.search === "string" && req.query.search.trim()) {
      const search = req.query.search.trim();
      filter.$or = [
        { name: { $regex: search, $options: "i" } },
        { email: { $regex: search, $options: "i" } }
      ];
    }

    const users = await User.find(filter)
      .select("_id name email role status createdAt")
      .sort({ createdAt: -1 })
      .limit(100);

    return res.json({ users });
  } catch (error) {
    console.error("Admin list users error:", error.message);
    return res.status(500).json({ message: "Could not load users" });
  }
});

// Change an ordinary producer account's status.
router.patch("/users/:id/status", async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body ?? {};

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ message: "Invalid user ID" });
    }

    if (!["active", "suspended", "banned"].includes(status)) {
      return res.status(400).json({
        message: "Status must be active, suspended, or banned"
      });
    }

    if (id === req.user._id.toString()) {
      return res.status(400).json({
        message: "You cannot change your own account status"
      });
    }

    const user = await User.findOneAndUpdate(
      { _id: id, role: "producer" },
      { $set: { status } },
      { new: true, runValidators: true }
    ).select("_id name email role status");

    if (!user) {
      return res.status(404).json({
        message: "Producer account not found"
      });
    }

    return res.json({ message: "User status updated", user });
  } catch (error) {
    console.error("Admin update user error:", error.message);
    return res.status(500).json({ message: "Could not update user status" });
  }
});

// View projects with owner details.
router.get("/projects", async (_req, res) => {
  try {
    const projects = await Project.find()
      .populate("owner", "name email")
      .select("title bpm stepCount owner createdAt updatedAt")
      .sort({ updatedAt: -1 })
      .limit(100);

    return res.json({ projects });
  } catch (error) {
    console.error("Admin list projects error:", error.message);
    return res.status(500).json({ message: "Could not load projects" });
  }
});

// Delete any project.
router.delete("/projects/:id", async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ message: "Invalid project ID" });
    }

    const project = await Project.findByIdAndDelete(id);

    if (!project) {
      return res.status(404).json({ message: "Project not found" });
    }

    return res.json({ message: "Project deleted" });
  } catch (error) {
    console.error("Admin delete project error:", error.message);
    return res.status(500).json({ message: "Could not delete project" });
  }
});

export default router;