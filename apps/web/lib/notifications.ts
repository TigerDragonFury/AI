import { Resend } from 'resend';

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
const FROM_EMAIL = process.env.NOTIFICATION_FROM_EMAIL ?? 'noreply@aiadplatform.com';
const ADMIN_EMAIL = process.env.ADMIN_NOTIFICATION_EMAIL;

export interface JobFailureContext {
  jobId: string;
  userId: string;
  userEmail?: string;
  errorMessage: string;
  pipeline: string;
}

/** Send a failure email to the user (if known) and optionally to admins. */
export async function sendJobFailureEmail(ctx: JobFailureContext): Promise<void> {
  if (!resend) return;

  const { jobId, userEmail, errorMessage, pipeline } = ctx;

  const recipients: string[] = [];
  if (userEmail) recipients.push(userEmail);
  if (ADMIN_EMAIL) recipients.push(ADMIN_EMAIL);
  if (recipients.length === 0) return;

  await resend.emails.send({
    from: FROM_EMAIL,
    to: recipients,
    subject: `Job failed: ${jobId}`,
    html: `
      <h2>Your AI Ad job failed</h2>
      <p>We're sorry — your job <strong>${jobId}</strong> encountered an error in the <em>${pipeline}</em> pipeline.</p>
      <p><strong>Reason:</strong> ${errorMessage}</p>
      <p>Please review your media files and try again. If the problem persists, contact support.</p>
      <hr />
      <p style="color:#94a3b8;font-size:12px">AI Ad Platform &bull; Job ID: ${jobId}</p>
    `
  });
}

export interface GenericNotification {
  to: string | string[];
  subject: string;
  html: string;
}

/** Send an arbitrary email via Resend. */
export async function sendEmail(n: GenericNotification): Promise<void> {
  if (!resend) return;
  await resend.emails.send({ from: FROM_EMAIL, ...n });
}
