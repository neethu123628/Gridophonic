import { Router } from "express";
import mongoose from "mongoose";
import Project from "../models/project.js";
import User from "../models/User.js";
import { requireAuth } from "../middleware/requireAuth.js";

const router = Router();

router.use(requireAuth);

function validateProjectFields(body = {}) {
  if (body.title !== undefined) {
    if (
      typeof body.title !== "string" ||
      body.title.trim().length < 1 ||
      body.title.trim().length > 100
    ) {
      return "Title must be between 1 and 100 characters";
    }
  }

  if (body.bpm !== undefined) {
    if (!Number.isInteger(body.bpm) || body.bpm < 40 || body.bpm > 240) {
      return "BPM must be a whole number from 40 to 240";
    }
  }

  if (body.stepCount !== undefined && ![8, 16].includes(body.stepCount)) {
    return "Step count must be 8 or 16";
  }

  if (body.tracks !== undefined) {
    if (!Array.isArray(body.tracks) || body.tracks.length > 32) {
      return "Tracks must be an array with no more than 32 items";
    }
  }

  return null;
}

function projectAccessFilter(projectId, userId) {
  return {
    _id: projectId,
    $or: [{ owner: userId }, { collaborators: userId }]
  };
}

// List projects owned by or shared with the logged-in user.
router.get("/", async (req, res) => {
  try {
    const projects = await Project.find({
      $or: [
        { owner: req.user._id },
        { collaborators: req.user._id }
      ]
    })
      .sort({ updatedAt: -1 })
      .select("title bpm stepCount createdAt updatedAt");

    return res.json({ projects });
  } catch (error) {
    console.error("List projects error:", error.message);
    return res.status(500).json({ message: "Could not load projects" });
  }
});

// Create a project.
router.post("/", async (req, res) => {
  try {
    const body = req.body ?? {};
    const validationError = validateProjectFields(body);

    if (validationError) {
      return res.status(400).json({ message: validationError });
    }

    const project = await Project.create({
      owner: req.user._id,
      title: body.title?.trim() || "Untitled Beat",
      bpm: body.bpm ?? 120,
      stepCount: body.stepCount ?? 16,
      tracks: body.tracks ?? []
    });

    return res.status(201).json({ project });
  } catch (error) {
    console.error("Create project error:", error.message);
    return res.status(500).json({ message: "Could not create project" });
  }
});

// Add an existing active user as a collaborator. Only the owner can do this.
router.post("/:id/collaborators", async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ message: "Invalid project ID" });
    }

    const email =
      typeof req.body?.email === "string"
        ? req.body.email.trim().toLowerCase()
        : "";

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ message: "Enter a valid email address" });
    }

    const project = await Project.findOne({
      _id: id,
      owner: req.user._id
    });

    if (!project) {
      return res.status(404).json({
        message: "Project not found or you are not its owner"
      });
    }

    const collaborator = await User.findOne({
      email,
      status: "active"
    }).select("_id name email");

    if (!collaborator) {
      return res.status(404).json({
        message: "No active account found with that email"
      });
    }

    if (collaborator._id.equals(req.user._id)) {
      return res.status(400).json({
        message: "You already own this project"
      });
    }

    project.collaborators ??= [];

    if (project.collaborators.some((userId) => userId.equals(collaborator._id))) {
      return res.status(409).json({
        message: "This user is already a collaborator"
      });
    }

    if (project.collaborators.length >= 20) {
      return res.status(400).json({
        message: "A project can have at most 20 collaborators"
      });
    }

    project.collaborators.push(collaborator._id);
    await project.save();

    return res.status(201).json({
      message: "Collaborator added",
      collaborator: {
        id: collaborator._id,
        name: collaborator.name,
        email: collaborator.email
      }
    });
  } catch (error) {
    console.error("Add collaborator error:", error.message);
    return res.status(500).json({ message: "Could not add collaborator" });
  }
});

// Duplicate a project the user owns or can access.
router.post("/:id/duplicate", async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ message: "Invalid project ID" });
    }

    const original = await Project.findOne(
      projectAccessFilter(id, req.user._id)
    );

    if (!original) {
      return res.status(404).json({ message: "Project not found" });
    }

    const copy = await Project.create({
      owner: req.user._id,
      title: `${original.title} (copy)`.slice(0, 100),
      bpm: original.bpm,
      stepCount: original.stepCount,
      tracks: original.tracks.map((track) => ({ ...track }))
    });

    return res.status(201).json({ project: copy });
  } catch (error) {
    console.error("Duplicate project error:", error.message);
    return res.status(500).json({ message: "Could not duplicate project" });
  }
});

// Get one project the user owns or can access.
router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ message: "Invalid project ID" });
    }

    const project = await Project.findOne(
      projectAccessFilter(id, req.user._id)
    );

    if (!project) {
      return res.status(404).json({ message: "Project not found" });
    }

    return res.json({ project });
  } catch (error) {
    console.error("Get project error:", error.message);
    return res.status(500).json({ message: "Could not load project" });
  }
});

// Update a project the user owns or can access.
router.patch("/:id", async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ message: "Invalid project ID" });
    }

    const body = req.body ?? {};
    const validationError = validateProjectFields(body);

    if (validationError) {
      return res.status(400).json({ message: validationError });
    }

    const updates = {};

    if (body.title !== undefined) updates.title = body.title.trim();
    if (body.bpm !== undefined) updates.bpm = body.bpm;
    if (body.stepCount !== undefined) updates.stepCount = body.stepCount;
    if (body.tracks !== undefined) updates.tracks = body.tracks;

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ message: "No project fields provided" });
    }

    const project = await Project.findOneAndUpdate(
      projectAccessFilter(id, req.user._id),
      { $set: updates },
      { new: true, runValidators: true }
    );

    if (!project) {
      return res.status(404).json({ message: "Project not found" });
    }

    return res.json({ project });
  } catch (error) {
    console.error("Update project error:", error.message);
    return res.status(500).json({ message: "Could not update project" });
  }
});

// Only the owner can delete a project.
router.delete("/:id", async (req, res) => {
  try {
    const { id } = req.params;

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ message: "Invalid project ID" });
    }

    const project = await Project.findOneAndDelete({
      _id: id,
      owner: req.user._id
    });

    if (!project) {
      return res.status(404).json({ message: "Project not found" });
    }

    return res.json({ message: "Project deleted" });
  } catch (error) {
    console.error("Delete project error:", error.message);
    return res.status(500).json({ message: "Could not delete project" });
  }
});

export default router;