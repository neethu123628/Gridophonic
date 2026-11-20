import { Router } from "express";
import mongoose from "mongoose";
import { randomBytes } from "node:crypto";
import Classroom from "../models/Classroom.js";
import Project from "../models/project.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { sendClassroomJoinCodeEmail } from "../utils/mailer.js";

const router = Router();

router.use(requireAuth);

async function makeJoinCode() {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const code = randomBytes(3).toString("hex").toUpperCase();

    if (!(await Classroom.exists({ joinCode: code }))) {
      return code;
    }
  }

  throw new Error("Could not create a unique classroom code");
}

function classroomAccessFilter(classroomId, userId) {
  return {
    _id: classroomId,
    $or: [{ owner: userId }, { "members.user": userId }]
  };
}

async function populateClassroom(classroom) {
  await classroom.populate([
    { path: "owner", select: "name email" },
    { path: "members.user", select: "name email" },
    { path: "assignments.createdBy", select: "name" },
    { path: "beats.project", select: "title bpm stepCount" },
    { path: "beats.creator", select: "name email" },
    { path: "notifications.actor", select: "name" },
    { path: "notifications.project", select: "title" }
  ]);

  return classroom;
}

// List classrooms owned or joined by the logged-in user.
router.get("/", async (req, res) => {
  try {
    const classrooms = await Classroom.find({
      $or: [
        { owner: req.user._id },
        { "members.user": req.user._id }
      ]
    })
      .populate("members.user", "name email")
      .sort({ updatedAt: -1 })
      .select("name owner joinCode members createdAt updatedAt");

    return res.json({ classrooms });
  } catch (error) {
    console.error("List classrooms error:", error.message);
    return res.status(500).json({ message: "Could not load classrooms" });
  }
});

// Create a classroom. Its creator becomes a teacher.
router.post("/", async (req, res) => {
  try {
    const name =
      typeof req.body?.name === "string" ? req.body.name.trim() : "";

    if (name.length < 2 || name.length > 80) {
      return res.status(400).json({
        message: "Classroom name must be between 2 and 80 characters"
      });
    }

    const classroom = await Classroom.create({
      name,
      owner: req.user._id,
      joinCode: await makeJoinCode(),
      members: [{ user: req.user._id, role: "teacher" }]
    });

    await sendClassroomJoinCodeEmail({
      email: req.user.email,
      name: req.user.name,
      classroomName: classroom.name,
      joinCode: classroom.joinCode
    });

    return res.status(201).json({ classroom });
  } catch (error) {
    console.error("Create classroom error:", error.message);
    return res.status(500).json({ message: "Could not create classroom" });
  }
});

// Join a classroom using its join code.
router.post("/join", async (req, res) => {
  try {
    const code =
      typeof req.body?.code === "string"
        ? req.body.code.trim().toUpperCase()
        : "";

    if (!code) {
      return res.status(400).json({ message: "Enter a classroom join code" });
    }

    const classroom = await Classroom.findOne({ joinCode: code });

    if (!classroom) {
      return res.status(404).json({ message: "Classroom code not found" });
    }

    const alreadyMember = classroom.members.some((member) =>
      member.user.equals(req.user._id)
    );

    if (!alreadyMember) {
      classroom.members.push({ user: req.user._id, role: "student" });
      await classroom.save();

      // Give the new student access to beats already shared with the class.
      await Promise.all(
        classroom.beats.map((beat) =>
          Project.updateOne(
            { _id: beat.project },
            { $addToSet: { collaborators: req.user._id } }
          )
        )
      );
    }

    return res.json({ message: "Joined classroom", classroom });
  } catch (error) {
    console.error("Join classroom error:", error.message);
    return res.status(500).json({ message: "Could not join classroom" });
  }
});

// Get classroom details, members, beats, assignments, and notifications.
router.get("/:id", async (req, res) => {
  try {
    if (!mongoose.isValidObjectId(req.params.id)) {
      return res.status(400).json({ message: "Invalid classroom ID" });
    }

    const classroom = await Classroom.findOne(
      classroomAccessFilter(req.params.id, req.user._id)
    );

    if (!classroom) {
      return res.status(404).json({
        message: "Classroom not found or access denied"
      });
    }

    await populateClassroom(classroom);

    return res.json({ classroom });
  } catch (error) {
    console.error("Get classroom error:", error.message);
    return res.status(500).json({ message: "Could not load classroom" });
  }
});

// Add a beat project to the classroom and notify its members.
router.post("/:id/beats", async (req, res) => {
  try {
    const { id } = req.params;
    const projectId = req.body?.projectId;

    if (
      !mongoose.isValidObjectId(id) ||
      !mongoose.isValidObjectId(projectId)
    ) {
      return res.status(400).json({
        message: "Invalid classroom or project ID"
      });
    }

    const classroom = await Classroom.findOne(
      classroomAccessFilter(id, req.user._id)
    );

    if (!classroom) {
      return res.status(404).json({
        message: "Classroom not found or access denied"
      });
    }

    const project = await Project.findOne({
      _id: projectId,
      owner: req.user._id
    });

    if (!project) {
      return res.status(404).json({
        message: "Beat project not found or you do not own it"
      });
    }

    const alreadyAdded = classroom.beats.some((beat) =>
      beat.project.equals(project._id)
    );

    if (alreadyAdded) {
      return res.status(409).json({
        message: "This beat is already in the classroom"
      });
    }

    // Share the beat project with the other classroom members.
    const classroomMemberIds = classroom.members
      .map((member) => member.user)
      .filter((memberId) => !memberId.equals(req.user._id));

    const collaboratorsById = new Map(
      [...(project.collaborators || []), ...classroomMemberIds].map(
        (memberId) => [memberId.toString(), memberId]
      )
    );

    project.collaborators = [...collaboratorsById.values()];
    await project.save();

    classroom.beats.push({
      project: project._id,
      creator: req.user._id
    });

    classroom.notifications.push({
      type: "beat_created",
      message: `${req.user.name} created "${project.title}" in the classroom`,
      actor: req.user._id,
      project: project._id
    });

    await classroom.save();

    const notification = classroom.notifications.at(-1);
    const io = req.app.get("io");

    if (io) {
      io.to(`classroom:${classroom._id}`).emit("classroom:notification", {
        id: notification._id.toString(),
        type: notification.type,
        message: notification.message,
        actor: {
          id: req.user._id.toString(),
          name: req.user.name
        },
        project: {
          id: project._id.toString(),
          title: project.title
        },
        createdAt: notification.createdAt
      });
    }

    return res.status(201).json({
      message: "Beat added to classroom",
      beat: {
        project: {
          _id: project._id,
          title: project.title,
          bpm: project.bpm,
          stepCount: project.stepCount
        },
        creator: {
          _id: req.user._id,
          name: req.user.name,
          email: req.user.email
        },
        createdAt: notification.createdAt
      }
    });
  } catch (error) {
    console.error("Add classroom beat error:", error.message);
    return res.status(500).json({
      message: "Could not add beat to classroom"
    });
  }
});

// Remove a beat from this classroom. The original project stays in its creator's account.
router.delete('/:id/beats/:projectId', async (req, res) => {
  try {
    const { id, projectId } = req.params;

    if (!mongoose.isValidObjectId(id) || !mongoose.isValidObjectId(projectId)) {
      return res.status(400).json({ message: 'Invalid classroom or project ID' });
    }

    const classroom = await Classroom.findOne(classroomAccessFilter(id, req.user._id));
    if (!classroom) {
      return res.status(404).json({ message: 'Classroom not found or access denied' });
    }

    const beat = classroom.beats.find((item) => item.project.equals(projectId));
    if (!beat) {
      return res.status(404).json({ message: 'Beat not found in this classroom' });
    }

    const isTeacher =
      classroom.owner.equals(req.user._id) ||
      classroom.members.some((member) =>
        member.user.equals(req.user._id) && member.role === 'teacher'
      );
    const isBeatCreator = beat.creator.equals(req.user._id);

    if (!isTeacher && !isBeatCreator) {
      return res.status(403).json({ message: 'Only the beat creator or a teacher can remove this beat' });
    }

    classroom.beats = classroom.beats.filter(
      (item) => !item.project.equals(projectId)
    );
    await classroom.save();

    return res.json({ message: 'Beat removed from classroom' });
  } catch (error) {
    console.error('Remove classroom beat error:', error.message);
    return res.status(500).json({ message: 'Could not remove beat from classroom' });
  }
});

// Permanently delete a project owned by the logged-in user and remove it from every classroom.
router.delete('/:id/beats/:projectId/delete', async (req, res) => {
  try {
    const { id, projectId } = req.params;
    if (!mongoose.isValidObjectId(id) || !mongoose.isValidObjectId(projectId)) {
      return res.status(400).json({ message: 'Invalid classroom or project ID' });
    }

    const classroom = await Classroom.findOne(classroomAccessFilter(id, req.user._id));
    if (!classroom) {
      return res.status(404).json({ message: 'Classroom not found or access denied' });
    }

    const isInClass = classroom.beats.some((beat) => beat.project.equals(projectId));
    if (!isInClass) {
      return res.status(404).json({ message: 'Beat not found in this classroom' });
    }

    const project = await Project.findOneAndDelete({ _id: projectId, owner: req.user._id });
    if (!project) {
      return res.status(403).json({ message: 'Only the project owner can delete it permanently' });
    }

    const linkedClassrooms = await Classroom.find({ 'beats.project': project._id }).select('_id');
    await Classroom.updateMany(
      {},
      {
        $pull: {
          beats: { project: project._id },
          notifications: { project: project._id }
        }
      }
    );

    const io = req.app.get('io');
    if (io) {
      for (const linkedClassroom of linkedClassrooms) {
        io.to(`classroom:${linkedClassroom._id}`).emit('classroom:beat_deleted', {
          projectId: project._id.toString()
        });
      }
    }

    return res.json({ message: 'Project permanently deleted' });
  } catch (error) {
    console.error('Delete classroom project error:', error.message);
    return res.status(500).json({ message: 'Could not delete project' });
  }
});
// Post a classroom announcement. Teachers only.
router.post("/:id/notifications", async (req, res) => {
  try {
    const { id } = req.params;
    const message =
      typeof req.body?.message === "string" ? req.body.message.trim() : "";

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ message: "Invalid classroom ID" });
    }

    if (!message || message.length > 250) {
      return res.status(400).json({
        message: "Notification must be between 1 and 250 characters"
      });
    }

    const classroom = await Classroom.findOne({
      _id: id,
      $or: [
        { owner: req.user._id },
        {
          members: {
            $elemMatch: { user: req.user._id, role: "teacher" }
          }
        }
      ]
    });

    if (!classroom) {
      return res.status(404).json({
        message: "Classroom not found or you are not its teacher"
      });
    }

    classroom.notifications.push({
      type: "announcement",
      message,
      actor: req.user._id
    });

    await classroom.save();

    const notification = classroom.notifications.at(-1);
    const io = req.app.get("io");

    if (io) {
      io.to(`classroom:${classroom._id}`).emit("classroom:notification", {
        id: notification._id.toString(),
        type: notification.type,
        message: notification.message,
        actor: {
          id: req.user._id.toString(),
          name: req.user.name
        },
        project: null,
        createdAt: notification.createdAt
      });
    }

    return res.status(201).json({
      message: "Notification posted",
      notification
    });
  } catch (error) {
    console.error("Post classroom notification error:", error.message);
    return res.status(500).json({
      message: "Could not post notification"
    });
  }
});
// Edit a classroom announcement. Teachers only; beat-created notifications cannot be edited.
router.patch('/:id/notifications/:notificationId', async (req, res) => {
  try {
    const { id, notificationId } = req.params;
    const message = typeof req.body?.message === 'string' ? req.body.message.trim() : '';

    if (!mongoose.isValidObjectId(id) || !mongoose.isValidObjectId(notificationId)) {
      return res.status(400).json({ message: 'Invalid classroom or notification ID' });
    }

    if (!message || message.length > 250) {
      return res.status(400).json({ message: 'Notification must be between 1 and 250 characters' });
    }

    const classroom = await Classroom.findOne({
      _id: id,
      $or: [
        { owner: req.user._id },
        { members: { $elemMatch: { user: req.user._id, role: 'teacher' } } }
      ]
    });

    if (!classroom) {
      return res.status(404).json({ message: 'Classroom not found or you are not its teacher' });
    }

    const notification = classroom.notifications.id(notificationId);
    if (!notification) {
      return res.status(404).json({ message: 'Notification not found' });
    }
    if (notification.type !== 'announcement') {
      return res.status(400).json({ message: 'Only announcements can be edited' });
    }

    notification.message = message;
    await classroom.save();

    const io = req.app.get('io');
    if (io) {
      io.to(`classroom:${classroom._id}`).emit('classroom:notification_updated', {
        id: notification._id.toString(),
        type: notification.type,
        message: notification.message,
        actor: { id: req.user._id.toString(), name: req.user.name },
        createdAt: notification.createdAt
      });
    }

    return res.json({ message: 'Notification updated', notification });
  } catch (error) {
    console.error('Edit classroom notification error:', error.message);
    return res.status(500).json({ message: 'Could not update notification' });
  }
});

// Delete a classroom notification. Teachers only.
router.delete('/:id/notifications/:notificationId', async (req, res) => {
  try {
    const { id, notificationId } = req.params;

    if (!mongoose.isValidObjectId(id) || !mongoose.isValidObjectId(notificationId)) {
      return res.status(400).json({ message: 'Invalid classroom or notification ID' });
    }

    const classroom = await Classroom.findOne({
      _id: id,
      $or: [
        { owner: req.user._id },
        { members: { $elemMatch: { user: req.user._id, role: 'teacher' } } }
      ]
    });

    if (!classroom) {
      return res.status(404).json({ message: 'Classroom not found or you are not its teacher' });
    }

    const notification = classroom.notifications.id(notificationId);
    if (!notification) {
      return res.status(404).json({ message: 'Notification not found' });
    }

    notification.deleteOne();
    await classroom.save();

    const io = req.app.get('io');
    if (io) {
      io.to(`classroom:${classroom._id}`).emit('classroom:notification_deleted', {
        id: notificationId
      });
    }

    return res.json({ message: 'Notification deleted' });
  } catch (error) {
    console.error('Delete classroom notification error:', error.message);
    return res.status(500).json({ message: 'Could not delete notification' });
  }
});
// Only a teacher can post assignments.
router.post("/:id/assignments", async (req, res) => {
  try {
    const { id } = req.params;
    const title =
      typeof req.body?.title === "string" ? req.body.title.trim() : "";
    const instructions =
      typeof req.body?.instructions === "string"
        ? req.body.instructions.trim()
        : "";

    if (!mongoose.isValidObjectId(id)) {
      return res.status(400).json({ message: "Invalid classroom ID" });
    }

    if (!title || title.length > 100) {
      return res.status(400).json({
        message:
          "Assignment title is required and must be 100 characters or fewer"
      });
    }

    if (instructions.length > 1000) {
      return res.status(400).json({
        message: "Instructions must be 1000 characters or fewer"
      });
    }

    const classroom = await Classroom.findOne({
      _id: id,
      $or: [
        { owner: req.user._id },
        {
          members: {
            $elemMatch: {
              user: req.user._id,
              role: "teacher"
            }
          }
        }
      ]
    });

    if (!classroom) {
      return res.status(404).json({
        message: "Classroom not found or you are not its teacher"
      });
    }

    classroom.assignments.push({
      title,
      instructions,
      createdBy: req.user._id
    });

    await classroom.save();

    return res.status(201).json({ message: "Assignment posted" });
  } catch (error) {
    console.error("Post assignment error:", error.message);
    return res.status(500).json({ message: "Could not post assignment" });
  }
});

export default router;




