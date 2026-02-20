import { Resend } from 'resend';

let resendClient: Resend | null = null;

function getResend(): Resend | null {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    return null;
  }
  if (!resendClient) {
    resendClient = new Resend(key);
  }
  return resendClient;
}

const FROM_ADDRESS = process.env.EMAIL_FROM ?? 'AI Ad Platform <noreply@yourdomain.com>';

export async function sendJobApprovedEmail(to: string, jobId: string): Promise<void> {
  const resend = getResend();
  if (!resend) {
    console.log(`[email] Resend not configured — skipping job-approved email for ${jobId}`);
    return;
  }

  try {
    await resend.emails.send({
      from: FROM_ADDRESS,
      to,
      subject: 'Your ad job has been approved',
      html: `
        <h1>Job Approved</h1>
        <p>Your ad generation job <strong>${jobId}</strong> has been approved and is now being processed.</p>
        <p>We'll notify you once it's ready to publish.</p>
      `
    });
  } catch (err) {
    console.error('[email] Failed to send job-approved email:', err);
  }
}

export async function sendJobPublishedEmail(
  to: string,
  jobId: string,
  platformList: string[]
): Promise<void> {
  const resend = getResend();
  if (!resend) {
    console.log(`[email] Resend not configured — skipping job-published email for ${jobId}`);
    return;
  }

  const platformsText = platformList.join(', ') || 'your selected platforms';

  try {
    await resend.emails.send({
      from: FROM_ADDRESS,
      to,
      subject: 'Your ad has been published',
      html: `
        <h1>Ad Published</h1>
        <p>Your ad from job <strong>${jobId}</strong> has been published to: <strong>${platformsText}</strong>.</p>
        <p>You can check analytics in your dashboard.</p>
      `
    });
  } catch (err) {
    console.error('[email] Failed to send job-published email:', err);
  }
}

export async function sendBoostCreatedEmail(
  to: string,
  postId: string,
  platformList: string[]
): Promise<void> {
  const resend = getResend();
  if (!resend) {
    console.log(`[email] Resend not configured — skipping boost-created email for ${postId}`);
    return;
  }

  const platformsText = platformList.join(', ') || 'selected platforms';

  try {
    await resend.emails.send({
      from: FROM_ADDRESS,
      to,
      subject: 'Your ad boost campaign has started',
      html: `
        <h1>Boost Campaign Started</h1>
        <p>A boost campaign for post <strong>${postId}</strong> has been created on: <strong>${platformsText}</strong>.</p>
      `
    });
  } catch (err) {
    console.error('[email] Failed to send boost-created email:', err);
  }
}
