import mongoose from "mongoose";

const projectSchema = new mongoose.Schema(
  {
    owner: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true
    },
    collaborators: [
  {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User"
  }
],
    title: {
      type: String,
      required: true,
      trim: true,
      minlength: 1,
      maxlength: 100
    },
    bpm: {
      type: Number,
      default: 120,
      min: 40,
      max: 240
    },
    stepCount: {
      type: Number,
      enum: [8, 16],
      default: 16
    },
    tracks: {
      type: [mongoose.Schema.Types.Mixed],
      default: []
    }
  },
  { timestamps: true }
);

const Project = mongoose.model("Project", projectSchema);

export default Project;