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

export async function notifyJobFailure(ctx: JobFailureContext): Promise<void> {
  if (!resend) return;

  const { jobId, userEmail, errorMessage, pipeline } = ctx;

  const recipients: string[] = [];
  if (userEmail) recipients.push(userEmail);
  if (ADMIN_EMAIL) recipients.push(ADMIN_EMAIL);
  if (recipients.length === 0) return;

  try {
    await resend.emails.send({
      from: FROM_EMAIL,
      to: recipients,
      subject: `AI Ad job failed [${jobId}]`,
      html: `
        <h2>Your AI Ad job encountered an error</h2>
        <p>Job <strong>${jobId}</strong> failed in the <em>${pipeline}</em> stage.</p>
        <p><strong>Reason:</strong> ${errorMessage}</p>
        <p>Please check your uploaded media and retry. If the issue persists, contact support.</p>
        <hr />
        <p style="color:#94a3b8;font-size:12px">AI Ad Platform &bull; Job ID: ${jobId}</p>
      `
    });
  } catch (err) {
    console.error('[notifications] Failed to send job failure email:', err);
  }
}
