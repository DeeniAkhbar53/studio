import nodemailer from 'nodemailer';

const transporter = nodemailer.createTransport({
  host: process.env.EMAIL_HOST || 'smtp.gmail.com',
  port: parseInt(process.env.EMAIL_PORT || '587'),
  secure: false, // use STARTTLS
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

export async function sendEmail(to: string, subject: string, html: string, text?: string): Promise<void> {
  const rawFrom = process.env.EMAIL_FROM || 'BGK Attendance <khaitanbgk@gmail.com>';
  const cleanFrom = rawFrom.replace(/^"+|"+$/g, '').trim();

  const fallbackText = text || html
    .replace(/<style([\s\S]*?)<\/style>/gi, '')
    .replace(/<script([\s\S]*?)<\/script>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  await transporter.sendMail({
    from: cleanFrom,
    to,
    subject,
    html,
    text: fallbackText,
    headers: {
      'X-Priority': '3', // Normal priority
      'X-Mailer': 'BGK Attendance System',
      'List-Unsubscribe': `<mailto:${cleanFrom.includes('<') ? cleanFrom.split('<')[1].replace('>', '') : cleanFrom}?subject=unsubscribe>`
    }
  });
}


export function otpEmailTemplate(name: string, otp: string): string {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8" />
      <title>Your OTP - BGK Attendance</title>
    </head>
    <body style="margin:0;padding:0;background:#0f172a;font-family:'Segoe UI',Arial,sans-serif;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background:#0f172a;padding:40px 20px;">
        <tr><td align="center">
          <table width="480" cellpadding="0" cellspacing="0" style="background:#1e293b;border-radius:16px;overflow:hidden;border:1px solid #334155;">
            <tr>
              <td style="background:linear-gradient(135deg,#2563eb,#f59e0b);height:6px;"></td>
            </tr>
            <tr>
              <td style="padding:40px 40px 0;">
                <h1 style="margin:0;font-size:22px;font-weight:700;color:#f8fafc;">BGK Attendance</h1>
                <p style="margin:8px 0 0;font-size:14px;color:#94a3b8;">Secure Login Verification</p>
              </td>
            </tr>
            <tr>
              <td style="padding:32px 40px;">
                <p style="font-size:15px;color:#cbd5e1;margin:0 0 24px;">Assalaamu Alaikum, <strong style="color:#f8fafc;">${name}</strong></p>
                <p style="font-size:14px;color:#94a3b8;margin:0 0 28px;">Your One-Time Password (OTP) for BGK Attendance login is:</p>
                <div style="background:#0f172a;border:2px solid #2563eb;border-radius:12px;padding:24px;text-align:center;margin-bottom:28px;">
                  <span style="font-size:42px;font-weight:800;letter-spacing:12px;color:#60a5fa;">${otp}</span>
                </div>
                <p style="font-size:13px;color:#64748b;margin:0;text-align:center;">This OTP expires in <strong style="color:#f59e0b;">10 minutes</strong>. Do not share it with anyone.</p>
              </td>
            </tr>
            <tr>
              <td style="padding:0 40px 32px;">
                <div style="border-top:1px solid #334155;padding-top:24px;">
                  <p style="font-size:12px;color:#475569;margin:0;">If you did not attempt to login, please contact your administrator immediately.</p>
                </div>
              </td>
            </tr>
          </table>
        </td></tr>
      </table>
    </body>
    </html>
  `;
}

export function resetPasswordEmailTemplate(name: string, resetLink: string): string {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8" />
      <title>Reset Password - BGK Attendance</title>
    </head>
    <body style="margin:0;padding:0;background:#0f172a;font-family:'Segoe UI',Arial,sans-serif;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background:#0f172a;padding:40px 20px;">
        <tr><td align="center">
          <table width="480" cellpadding="0" cellspacing="0" style="background:#1e293b;border-radius:16px;overflow:hidden;border:1px solid #334155;">
            <tr>
              <td style="background:linear-gradient(135deg,#2563eb,#f59e0b);height:6px;"></td>
            </tr>
            <tr>
              <td style="padding:40px 40px 0;">
                <h1 style="margin:0;font-size:22px;font-weight:700;color:#f8fafc;">BGK Attendance</h1>
                <p style="margin:8px 0 0;font-size:14px;color:#94a3b8;">Password Reset Request</p>
              </td>
            </tr>
            <tr>
              <td style="padding:32px 40px;">
                <p style="font-size:15px;color:#cbd5e1;margin:0 0 24px;">Assalaamu Alaikum, <strong style="color:#f8fafc;">${name}</strong></p>
                <p style="font-size:14px;color:#94a3b8;margin:0 0 28px;">We received a request to reset your BGK Attendance password. Click the button below to set a new password:</p>
                <div style="text-align:center;margin-bottom:28px;">
                  <a href="${resetLink}" style="display:inline-block;background:linear-gradient(135deg,#2563eb,#1d4ed8);color:#fff;font-size:15px;font-weight:600;text-decoration:none;padding:14px 36px;border-radius:10px;">Reset My Password</a>
                </div>
                <p style="font-size:13px;color:#64748b;margin:0 0 12px;text-align:center;">This link expires in <strong style="color:#f59e0b;">1 hour</strong>.</p>
                <p style="font-size:12px;color:#475569;margin:0;text-align:center;word-break:break-all;">Or copy this URL: <a href="${resetLink}" style="color:#60a5fa;">${resetLink}</a></p>
              </td>
            </tr>
            <tr>
              <td style="padding:0 40px 32px;">
                <div style="border-top:1px solid #334155;padding-top:24px;">
                  <p style="font-size:12px;color:#475569;margin:0;">If you did not request a password reset, you can safely ignore this email. Your password will not change.</p>
                </div>
              </td>
            </tr>
          </table>
        </td></tr>
      </table>
    </body>
    </html>
  `;
}

export function attendanceConfirmationEmailTemplate(
  name: string,
  itsId: string,
  miqaatName: string,
  sessionName: string,
  status: string,
  dateString: string,
  location: string,
  reason?: string
): string {
  const isSafar = status.toLowerCase() === 'safar';
  const statusColor = isSafar ? '#f59e0b' : '#10b981';
  const displayStatus = isSafar ? 'Marked as Safar' : `Present (${status.charAt(0).toUpperCase() + status.slice(1)})`;

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8" />
      <title>Attendance Confirmation</title>
    </head>
    <body style="margin:0;padding:0;background:#0f172a;font-family:'Segoe UI',Arial,sans-serif;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background:#0f172a;padding:40px 20px;">
        <tr><td align="center">
          <table width="480" cellpadding="0" cellspacing="0" style="background:#1e293b;border-radius:16px;overflow:hidden;border:1px solid #334155;">
            <tr>
              <td style="background:linear-gradient(135deg,#10b981,#3b82f6);height:6px;"></td>
            </tr>
            <tr>
              <td align="center" style="padding:40px 40px 20px;">
                <img src="https://app.burhaniguards.org/images/logo.png" alt="BGK Logo" width="80" height="80" style="display:block;margin-bottom:16px;" />
                <h1 style="margin:0;font-size:22px;font-weight:700;color:#f8fafc;">Burhani Guards Khaitan</h1>
                <p style="margin:4px 0 0;font-size:14px;color:#94a3b8;">Miqaat Attendance Confirmation</p>
              </td>
            </tr>
            <tr>
              <td style="padding:20px 40px 32px;">
                <p style="font-size:15px;color:#cbd5e1;margin:0 0 20px;">Assalaamu Alaikum, <strong style="color:#f8fafc;">${name}</strong> (${itsId})</p>
                <p style="font-size:14px;color:#94a3b8;margin:0 0 24px;">Your attendance has been successfully marked for the following event:</p>
                
                <table width="100%" cellpadding="12" cellspacing="0" style="background:#0f172a;border-radius:10px;border:1px solid #334155;margin-bottom:24px;color:#f8fafc;font-size:14px;">
                  <tr>
                    <td style="color:#94a3b8;width:30%;">Event:</td>
                    <td><strong>${miqaatName}</strong></td>
                  </tr>
                  ${sessionName ? `<tr>
                    <td style="color:#94a3b8;">Session:</td>
                    <td>${sessionName}</td>
                  </tr>` : ''}
                  <tr>
                    <td style="color:#94a3b8;">Status:</td>
                    <td><span style="color:${statusColor};font-weight:bold;">${displayStatus}</span></td>
                  </tr>
                  <tr>
                    <td style="color:#94a3b8;">Time:</td>
                    <td>${dateString}</td>
                  </tr>
                  ${location ? `<tr>
                    <td style="color:#94a3b8;">Location:</td>
                    <td>${location}</td>
                  </tr>` : ''}
                  ${reason ? `<tr>
                    <td style="color:#94a3b8;">Note/Reason:</td>
                    <td>${reason}</td>
                  </tr>` : ''}
                </table>

                <p style="font-size:13px;color:#64748b;margin:0;text-align:center;">This is an automated confirmation of your attendance. Shurukan.</p>
              </td>
            </tr>
            <tr>
              <td style="padding:0 40px 32px;">
                <div style="border-top:1px solid #334155;padding-top:24px;text-align:center;">
                  <p style="font-size:11px;color:#475569;margin:0;">Designed and Managed by Shabbir Shakir &bull; BGK Khaitan</p>
                </div>
              </td>
            </tr>
          </table>
        </td></tr>
      </table>
    </body>
    </html>
  `;
}

export function miqaatAbsenceEmailTemplate(
  name: string,
  itsId: string,
  miqaatName: string,
  dateString: string,
  location: string
): string {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8" />
      <title>Miqaat Absence Notification</title>
    </head>
    <body style="margin:0;padding:0;background:#0f172a;font-family:'Segoe UI',Arial,sans-serif;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background:#0f172a;padding:40px 20px;">
        <tr><td align="center">
          <table width="480" cellpadding="0" cellspacing="0" style="background:#1e293b;border-radius:16px;overflow:hidden;border:1px solid #334155;">
            <tr>
              <td style="background:linear-gradient(135deg,#ef4444,#f59e0b);height:6px;"></td>
            </tr>
            <tr>
              <td align="center" style="padding:40px 40px 20px;">
                <img src="https://app.burhaniguards.org/images/logo.png" alt="BGK Logo" width="80" height="80" style="display:block;margin-bottom:16px;" />
                <h1 style="margin:0;font-size:22px;font-weight:700;color:#f8fafc;">Burhani Guards Khaitan</h1>
                <p style="margin:4px 0 0;font-size:14px;color:#ef4444;font-weight:600;letter-spacing:1px;text-transform:uppercase;">Absence Notification</p>
              </td>
            </tr>
            <tr>
              <td style="padding:20px 40px 32px;">
                <p style="font-size:15px;color:#cbd5e1;margin:0 0 20px;">Assalaamu Alaikum, <strong style="color:#f8fafc;">${name}</strong> (${itsId})</p>
                <p style="font-size:14px;color:#94a3b8;margin:0 0 24px;">This email is to inform you that your attendance was <strong>not marked</strong> for the following Miqaat event:</p>
                
                <table width="100%" cellpadding="12" cellspacing="0" style="background:#0f172a;border-radius:10px;border:1px solid #334155;margin-bottom:24px;color:#f8fafc;font-size:14px;">
                  <tr>
                    <td style="color:#94a3b8;width:30%;">Event:</td>
                    <td><strong>${miqaatName}</strong></td>
                  </tr>
                  <tr>
                    <td style="color:#94a3b8;">Status:</td>
                    <td><span style="color:#ef4444;font-weight:bold;">Absent</span></td>
                  </tr>
                  <tr>
                    <td style="color:#94a3b8;">Date:</td>
                    <td>${dateString}</td>
                  </tr>
                  ${location ? `<tr>
                    <td style="color:#94a3b8;">Location:</td>
                    <td>${location}</td>
                  </tr>` : ''}
                </table>

                <p style="font-size:13px;color:#cbd5e1;line-height:1.6;margin:0 0 16px;">
                  If you attended this event but your attendance was not marked, or if you were on leave/safar, please contact your **Group Leader** or **Idara Admin** as soon as possible to update your record.
                </p>
              </td>
            </tr>
            <tr>
              <td style="padding:0 40px 32px;">
                <div style="border-top:1px solid #334155;padding-top:24px;text-align:center;">
                  <p style="font-size:11px;color:#475569;margin:0;">Designed and Managed by Shabbir Shakir &bull; BGK Khaitan</p>
                </div>
              </td>
            </tr>
          </table>
        </td></tr>
      </table>
    </body>
    </html>
  `;
}

