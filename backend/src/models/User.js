import mongoose from "mongoose";
import bcrypt from "bcryptjs";

const profilePhotoSchema = new mongoose.Schema(
  {
    url: {
      type: String,
      trim: true,
      default: ""
    },
    publicId: {
      type: String,
      trim: true,
      default: ""
    }
  },
  { _id: false }
);

const userSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      minlength: 2,
      maxlength: 80
    },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true
    },
    googleId: {
      type: String,
      unique: true,
      sparse: true,
      select: false
    },
    passwordHash: {
      type: String,
      required: true,
      select: false
    },
    bio: {
      type: String,
      trim: true,
      maxlength: 300,
      default: ""
    },
    profilePhoto: {
      type: profilePhotoSchema,
      default: () => ({})
    },
    role: {
      type: String,
      enum: ["producer", "admin"],
      default: "producer"
    },
    status: {
      type: String,
      enum: ["active", "suspended", "banned"],
      default: "active"
    }
  },
  { timestamps: true }
);

userSchema.methods.comparePassword = function (password) {
  return bcrypt.compare(password, this.passwordHash);
};

const User = mongoose.model("User", userSchema);

export default User;
