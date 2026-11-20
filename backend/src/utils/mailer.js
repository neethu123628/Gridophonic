import nodemailer from "nodemailer";

const smtpPort = Number(process.env.SMTP_PORT || 587);
const emailConfigured = Boolean(
  process.env.SMTP_HOST &&
    process.env.SMTP_USER &&
    process.env.SMTP_PASS &&
    process.env.MAIL_FROM
);

const transporter = emailConfigured
  ? nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: smtpPort,
      secure: smtpPort === 465,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
      }
    })
  : null;

function escapeHtml(value = "") {
  return String(value).replace(/[&<>"']/g, (character) => {
    const entities = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;"
    };
    return entities[character];
  });
}

export async function sendWelcomeEmail(user) {
  if (!transporter) {
    console.warn("Welcome email skipped: SMTP settings are not configured.");
    return;
  }

  const name = user.name || "there";
  const safeName = escapeHtml(name);

  try {
    await transporter.sendMail({
      from: process.env.MAIL_FROM,
      to: user.email,
      subject: "Welcome to Gridophonic",
      text: `Welcome to Gridophonic, ${name}! You have successfully signed in. Open Gridophonic to start creating beats.`,
      html: `
        <div style="font-family:Arial,sans-serif;line-height:1.6;color:#172033;max-width:600px;margin:0 auto;padding:24px">
          <h1 style="color:#139b7b">Welcome to Gridophonic, ${safeName}!</h1>
          <p>You have successfully signed in to Gridophonic.</p>
          <p>Your music workspace is ready. Open Gridophonic and start creating beats.</p>
        </div>
      `
    });
  } catch (error) {
    // Email delivery errors should not prevent a successful login.
    console.error("Welcome email could not be sent:", error.message);
  }
}
export async function sendClassroomJoinCodeEmail({
  email,
  name,
  classroomName,
  joinCode
}) {
  if (!transporter) {
    console.warn("Classroom join-code email skipped: SMTP settings are not configured.");
    return;
  }

  const safeName = escapeHtml(name || "there");
  const safeClassroomName = escapeHtml(classroomName || "your classroom");
  const safeJoinCode = escapeHtml(joinCode || "");

  try {
    await transporter.sendMail({
      from: process.env.MAIL_FROM,
      to: email,
      subject: `Your ${classroomName} classroom join code`,
      text: `Hello ${name || "there"}, your classroom "${classroomName}" was created. Share this join code with students: ${joinCode}`,
      html: `
        <div style="font-family:Arial,sans-serif;line-height:1.6;color:#172033;max-width:600px;margin:0 auto;padding:24px">
          <h1 style="color:#139b7b">Your classroom is ready, ${safeName}!</h1>
          <p>Classroom: <strong>${safeClassroomName}</strong></p>
          <p>Share this join code with your students:</p>
          <p style="font-size:28px;font-weight:bold;letter-spacing:4px;background:#f0f7f5;padding:16px;text-align:center;border-radius:8px">${safeJoinCode}</p>
        </div>
      `
    });
  } catch (error) {
    console.error("Classroom join-code email could not be sent:", error.message);
  }
}

