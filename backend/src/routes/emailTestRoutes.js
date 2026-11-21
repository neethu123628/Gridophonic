import { Router } from "express";
import rateLimit from "express-rate-limit";
import { requireAuth } from "../middleware/requireAuth.js";
import { sendTestEmail } from "../utils/mailer.js";

const router = Router();

const emailTestLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 1,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { message: "Wait one minute before sending another test email." }
});

router.post("/", requireAuth, emailTestLimiter, async (req, res) => {
  const result = await sendTestEmail(req.user);

  if (!result.ok) {
    console.error("Email test failed:", result.error);
    return res.status(502).json({
      message: "Resend could not send the test email",
      error: result.error
    });
  }

  return res.json({
    message: "Test email sent",
    sentTo: req.user.email,
    emailId: result.id
  });
});

export default router;
