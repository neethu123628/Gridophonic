import { Router } from "express";
import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import rateLimit from "express-rate-limit";
import { OAuth2Client } from "google-auth-library";
import User from "../models/User.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { sendWelcomeEmail } from "../utils/mailer.js";

const router = Router();
const googleClient = new OAuth2Client();

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { message: "Too many attempts. Please try again later." }
});

function cookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: "/"
  };
}

function publicUser(user) {
  return {
    id: user._id,
    name: user.name,
    email: user.email,
    role: user.role
  };
}

function setLoginCookie(res, user) {
  const token = jwt.sign(
    { userId: user._id.toString() },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || "7d" }
  );

  res.cookie("token", token, cookieOptions());
}

router.post("/register", authLimiter, async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (
      typeof name !== "string" ||
      typeof email !== "string" ||
      typeof password !== "string"
    ) {
      return res.status(400).json({
        message: "Name, email, and password are required"
      });
    }

    const cleanName = name.trim();
    const cleanEmail = email.trim().toLowerCase();

    if (cleanName.length < 2 || cleanName.length > 80) {
      return res.status(400).json({
        message: "Name must be between 2 and 80 characters"
      });
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      return res.status(400).json({ message: "Enter a valid email address" });
    }

    if (password.length < 8 || password.length > 72) {
      return res.status(400).json({
        message: "Password must be between 8 and 72 characters"
      });
    }

    const existingUser = await User.findOne({ email: cleanEmail });

    if (existingUser) {
      return res.status(409).json({ message: "Email is already registered" });
    }

    const passwordHash = await bcrypt.hash(password, 12);

    const user = await User.create({
      name: cleanName,
      email: cleanEmail,
      passwordHash
    });

    setLoginCookie(res, user);
    await sendWelcomeEmail(user);

    return res.status(201).json({
      message: "Account created",
      user: publicUser(user)
    });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({ message: "Email is already registered" });
    }

    console.error("Registration error:", error.message);
    return res.status(500).json({ message: "Could not create account" });
  }
});

router.post("/login", authLimiter, async (req, res) => {
  try {
    const { email, password } = req.body;

    if (typeof email !== "string" || typeof password !== "string") {
      return res.status(400).json({
        message: "Email and password are required"
      });
    }

    const user = await User.findOne({
      email: email.trim().toLowerCase()
    }).select("+passwordHash");

    if (!user || !(await user.comparePassword(password))) {
      return res.status(401).json({
        message: "Email or password is incorrect"
      });
    }

    if (user.status !== "active") {
      return res.status(403).json({
        message: "This account is unavailable"
      });
    }

    setLoginCookie(res, user);
    await sendWelcomeEmail(user);

    return res.json({
      message: "Logged in",
      user: publicUser(user)
    });
  } catch (error) {
    console.error("Login error:", error.message);
    return res.status(500).json({ message: "Could not log in" });
  }
});

// Verify the Google ID token, find or create the account, and set the login cookie.
router.post("/google", authLimiter, async (req, res) => {
  try {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const credential = req.body?.credential;

    if (!clientId) {
      return res.status(500).json({
        message: "Google sign-in is not configured on the server"
      });
    }

    if (typeof credential !== "string" || !credential) {
      return res.status(400).json({
        message: "Google sign-in credential is missing"
      });
    }

    const ticket = await googleClient.verifyIdToken({
      idToken: credential,
      audience: clientId
    });

    const payload = ticket.getPayload();

    if (!payload?.sub || !payload.email || !payload.email_verified) {
      return res.status(401).json({
        message: "Google account could not be verified"
      });
    }

    const email = payload.email.trim().toLowerCase();

    let user = await User.findOne({ googleId: payload.sub }).select(
      "+googleId"
    );

    if (!user) {
      user = await User.findOne({ email }).select("+googleId");

      if (user) {
        if (user.status !== "active") {
          return res.status(403).json({
            message: "This account is unavailable"
          });
        }

        if (user.googleId && user.googleId !== payload.sub) {
          return res.status(409).json({
            message: "This email is linked to another Google account"
          });
        }

        user.googleId = payload.sub;
        await user.save();
      } else {
        let name =
          typeof payload.name === "string" ? payload.name.trim() : "";

        if (name.length < 2) {
          name = email.split("@")[0];
        }
        if (name.length < 2) {
          name = "Google User";
        }

        const passwordHash = await bcrypt.hash(
          randomBytes(32).toString("hex"),
          12
        );

        user = await User.create({
          name: name.slice(0, 80),
          email,
          googleId: payload.sub,
          passwordHash
        });
      }
    }

    if (user.status !== "active") {
      return res.status(403).json({
        message: "This account is unavailable"
      });
    }

    setLoginCookie(res, user);
    await sendWelcomeEmail(user);

    return res.json({
      message: "Signed in with Google",
      user: publicUser(user)
    });
  } catch (error) {
    console.error("Google sign-in error:", error.message);
    return res.status(401).json({
      message: "Google sign-in failed"
    });
  }
});

router.post("/logout", (_req, res) => {
  res.clearCookie("token", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: process.env.NODE_ENV === "production" ? "none" : "lax",
    path: "/"
  });

  return res.json({ message: "Logged out" });
});

router.get("/me", requireAuth, (req, res) => {
  return res.json({ user: publicUser(req.user) });
});

export default router;

