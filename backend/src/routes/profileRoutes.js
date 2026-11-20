import { Router } from "express";
import multer from "multer";
import { requireAuth } from "../middleware/requireAuth.js";
import cloudinary, { isCloudinaryConfigured } from "../config/cloudinary.js";

const router = Router();
const MAX_PHOTO_SIZE = 5 * 1024 * 1024;
const allowedPhotoTypes = new Set(["image/jpeg", "image/png", "image/webp"]);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_PHOTO_SIZE, files: 1 },
  fileFilter: (_req, file, callback) => {
    if (!allowedPhotoTypes.has(file.mimetype)) {
      return callback(new Error("Use a JPG, PNG, or WebP image"));
    }
    callback(null, true);
  }
});

router.use(requireAuth);

function publicProfile(user) {
  return {
    id: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
    bio: user.bio || "",
    profilePhoto: {
      url: user.profilePhoto?.url || ""
    }
  };
}

function uploadBufferToCloudinary(buffer) {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      {
        folder: "gridophonic/profile-photos",
        resource_type: "image",
        transformation: [{ width: 600, height: 600, crop: "limit" }]
      },
      (error, result) => {
        if (error) return reject(error);
        resolve(result);
      }
    );

    stream.end(buffer);
  });
}

router.get("/me", (req, res) => {
  return res.json({ user: publicProfile(req.user) });
});

router.patch("/me", async (req, res) => {
  try {
    const hasName = Object.prototype.hasOwnProperty.call(req.body || {}, "name");
    const hasBio = Object.prototype.hasOwnProperty.call(req.body || {}, "bio");

    if (!hasName && !hasBio) {
      return res.status(400).json({ message: "Provide a name or bio to update" });
    }

    if (hasName) {
      if (typeof req.body.name !== "string") {
        return res.status(400).json({ message: "Name must be text" });
      }
      const name = req.body.name.trim();
      if (name.length < 2 || name.length > 80) {
        return res.status(400).json({ message: "Name must be between 2 and 80 characters" });
      }
      req.user.name = name;
    }

    if (hasBio) {
      if (typeof req.body.bio !== "string") {
        return res.status(400).json({ message: "Bio must be text" });
      }
      const bio = req.body.bio.trim();
      if (bio.length > 300) {
        return res.status(400).json({ message: "Bio must be 300 characters or fewer" });
      }
      req.user.bio = bio;
    }

    await req.user.save();
    return res.json({ message: "Profile updated", user: publicProfile(req.user) });
  } catch (error) {
    console.error("Update profile error:", error.message);
    return res.status(500).json({ message: "Could not update profile" });
  }
});

router.post("/me/photo", (req, res, next) => {
  upload.single("photo")(req, res, (error) => {
    if (!error) return next();
    if (error instanceof multer.MulterError && error.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({ message: "Photo must be 5 MB or smaller" });
    }
    return res.status(400).json({ message: error.message || "Could not read photo" });
  });
}, async (req, res) => {
  let uploadedAsset;

  try {
    if (!req.file) {
      return res.status(400).json({ message: "Choose a photo to upload" });
    }
    if (!isCloudinaryConfigured()) {
      return res.status(503).json({ message: "Profile photo storage is not configured" });
    }

    uploadedAsset = await uploadBufferToCloudinary(req.file.buffer);
    const oldPublicId = req.user.profilePhoto?.publicId;

    req.user.profilePhoto = {
      url: uploadedAsset.secure_url,
      publicId: uploadedAsset.public_id
    };
    await req.user.save();

    if (oldPublicId) {
      cloudinary.uploader.destroy(oldPublicId).catch((error) => {
        console.error("Could not remove previous profile photo:", error.message);
      });
    }

    return res.json({ message: "Profile photo updated", user: publicProfile(req.user) });
  } catch (error) {
    if (uploadedAsset?.public_id) {
      cloudinary.uploader.destroy(uploadedAsset.public_id).catch(() => {});
    }
    console.error("Upload profile photo error:", error.message);
    return res.status(500).json({ message: "Could not upload profile photo" });
  }
});

router.delete("/me/photo", async (req, res) => {
  try {
    const publicId = req.user.profilePhoto?.publicId;

    if (publicId) {
      if (!isCloudinaryConfigured()) {
        return res.status(503).json({ message: "Profile photo storage is not configured" });
      }
      await cloudinary.uploader.destroy(publicId, { resource_type: "image" });
    }

    req.user.profilePhoto = { url: "", publicId: "" };
    await req.user.save();

    return res.json({ message: "Profile photo removed", user: publicProfile(req.user) });
  } catch (error) {
    console.error("Remove profile photo error:", error.message);
    return res.status(500).json({ message: "Could not remove profile photo" });
  }
});

export default router;
