import { Resend } from "resend";

const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
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

async function sendEmail({ to, subject, text, html }) {
  if (!resend || !process.env.MAIL_FROM) {
    console.warn("Email skipped: RESEND_API_KEY or MAIL_FROM is not configured.");
    return;
  }

  try {
    const { error } = await resend.emails.send({
      from: process.env.MAIL_FROM,
      to: [to],
      subject,
      text,
      html
    });

    if (error) {
      throw new Error(error.message || "Resend rejected the email");
    }
  } catch (error) {
    console.error("Email could not be sent:", error.message);
  }
}

export async function sendWelcomeEmail(user) {
  const name = user.name || "there";
  const safeName = escapeHtml(name);

  await sendEmail({
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
}

export async function sendClassroomJoinCodeEmail({
  email,
  name,
  classroomName,
  joinCode
}) {
  const safeName = escapeHtml(name || "there");
  const safeClassroomName = escapeHtml(classroomName || "your classroom");
  const safeJoinCode = escapeHtml(joinCode || "");

  await sendEmail({
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
}
