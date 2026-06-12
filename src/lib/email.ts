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
  const defaultFromEmail = process.env.EMAIL_USER || 'khaitanbgk@gmail.com';
  const rawFrom = process.env.EMAIL_FROM || `BGK Attendance <${defaultFromEmail}>`;
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
    <body style="margin:0;padding:0;background:#f1f5f9;font-family:'Segoe UI',Arial,sans-serif;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:40px 20px;">
        <tr><td align="center">
          <table width="480" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e2e8f0;box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);">
            <tr>
              <td style="background:linear-gradient(135deg,#2563eb,#f59e0b);height:6px;"></td>
            </tr>
            <tr>
              <td style="padding:40px 40px 0;">
                <h1 style="margin:0;font-size:22px;font-weight:700;color:#1e293b;">BGK Attendance</h1>
                <p style="margin:8px 0 0;font-size:14px;color:#64748b;">Secure Login Verification</p>
              </td>
            </tr>
            <tr>
              <td style="padding:32px 40px;">
                <p style="font-size:15px;color:#334155;margin:0 0 24px;">Assalaamu Alaikum, <strong style="color:#1e293b;">${name}</strong></p>
                <p style="font-size:14px;color:#475569;margin:0 0 28px;">Your One-Time Password (OTP) for BGK Attendance login is:</p>
                <div style="background:#f8fafc;border:2px solid #2563eb;border-radius:12px;padding:24px;text-align:center;margin-bottom:28px;">
                  <span style="font-size:42px;font-weight:800;letter-spacing:12px;color:#2563eb;">${otp}</span>
                </div>
                <p style="font-size:13px;color:#64748b;margin:0;text-align:center;">This OTP expires in <strong style="color:#f59e0b;">10 minutes</strong>. Do not share it with anyone.</p>
              </td>
            </tr>
            <tr>
              <td style="padding:0 40px 32px;">
                <div style="border-top:1px solid #e2e8f0;padding-top:24px;">
                  <p style="font-size:12px;color:#94a3b8;margin:0;">If you did not attempt to login, please contact your administrator immediately.</p>
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
    <body style="margin:0;padding:0;background:#f1f5f9;font-family:'Segoe UI',Arial,sans-serif;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:40px 20px;">
        <tr><td align="center">
          <table width="480" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e2e8f0;box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);">
            <tr>
              <td style="background:linear-gradient(135deg,#2563eb,#f59e0b);height:6px;"></td>
            </tr>
            <tr>
              <td style="padding:40px 40px 0;">
                <h1 style="margin:0;font-size:22px;font-weight:700;color:#1e293b;">BGK Attendance</h1>
                <p style="margin:8px 0 0;font-size:14px;color:#64748b;">Password Reset Request</p>
              </td>
            </tr>
            <tr>
              <td style="padding:32px 40px;">
                <p style="font-size:15px;color:#334155;margin:0 0 24px;">Assalaamu Alaikum, <strong style="color:#1e293b;">${name}</strong></p>
                <p style="font-size:14px;color:#475569;margin:0 0 28px;">We received a request to reset your BGK Attendance password. Click the button below to set a new password:</p>
                <div style="text-align:center;margin-bottom:28px;">
                  <a href="${resetLink}" style="display:inline-block;background:linear-gradient(135deg,#2563eb,#1d4ed8);color:#fff;font-size:15px;font-weight:600;text-decoration:none;padding:14px 36px;border-radius:10px;box-shadow:0 2px 4px rgba(37,99,235,0.2);">Reset My Password</a>
                </div>
                <p style="font-size:13px;color:#64748b;margin:0 0 12px;text-align:center;">This link expires in <strong style="color:#f59e0b;">1 hour</strong>.</p>
                <p style="font-size:12px;color:#94a3b8;margin:0;text-align:center;word-break:break-all;">Or copy this URL: <a href="${resetLink}" style="color:#2563eb;">${resetLink}</a></p>
              </td>
            </tr>
            <tr>
              <td style="padding:0 40px 32px;">
                <div style="border-top:1px solid #e2e8f0;padding-top:24px;">
                  <p style="font-size:12px;color:#94a3b8;margin:0;">If you did not request a password reset, you can safely ignore this email. Your password will not change.</p>
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
  const statusColor = isSafar ? '#d97706' : '#059669';
  const displayStatus = isSafar ? 'Marked as Safar' : `Present (${status.charAt(0).toUpperCase() + status.slice(1)})`;

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8" />
      <title>Attendance Confirmation</title>
    </head>
    <body style="margin:0;padding:0;background:#f1f5f9;font-family:'Segoe UI',Arial,sans-serif;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:40px 20px;">
        <tr><td align="center">
          <table width="480" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e2e8f0;box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);">
            <tr>
              <td style="background:linear-gradient(135deg,#10b981,#3b82f6);height:6px;"></td>
            </tr>
            <tr>
              <td align="center" style="padding:40px 40px 20px;">
                <img src="https://app.burhaniguards.org/images/logo.png" alt="BGK Logo" width="80" height="80" style="display:block;margin-bottom:16px;" />
                <h1 style="margin:0;font-size:22px;font-weight:700;color:#1e293b;">Burhani Guards Khaitan</h1>
                <p style="margin:4px 0 0;font-size:14px;color:#64748b;">Miqaat Attendance Confirmation</p>
              </td>
            </tr>
            <tr>
              <td style="padding:20px 40px 32px;">
                <p style="font-size:15px;color:#334155;margin:0 0 20px;">Assalaamu Alaikum, <strong style="color:#1e293b;">${name}</strong> (${itsId})</p>
                <p style="font-size:14px;color:#64748b;margin:0 0 24px;">Your attendance has been successfully marked for the following event:</p>
                
                <table width="100%" cellpadding="12" cellspacing="0" style="background:#f8fafc;border-radius:10px;border:1px solid #e2e8f0;margin-bottom:24px;color:#1e293b;font-size:14px;">
                  <tr>
                    <td style="color:#64748b;width:30%;">Event:</td>
                    <td><strong>${miqaatName}</strong></td>
                  </tr>
                  ${sessionName ? `<tr>
                    <td style="color:#64748b;">Session:</td>
                    <td>${sessionName}</td>
                  </tr>` : ''}
                  <tr>
                    <td style="color:#64748b;">Status:</td>
                    <td><span style="color:${statusColor};font-weight:bold;">${displayStatus}</span></td>
                  </tr>
                  <tr>
                    <td style="color:#64748b;">Time:</td>
                    <td>${dateString}</td>
                  </tr>
                  ${location ? `<tr>
                    <td style="color:#64748b;">Location:</td>
                    <td>${location}</td>
                  </tr>` : ''}
                  ${reason ? `<tr>
                    <td style="color:#64748b;">Note/Reason:</td>
                    <td>${reason}</td>
                  </tr>` : ''}
                </table>

                <p style="font-size:13px;color:#64748b;margin:0;text-align:center;">This is an automated confirmation of your attendance. Shurukan.</p>
              </td>
            </tr>
            <tr>
              <td style="padding:0 40px 32px;">
                <div style="border-top:1px solid #e2e8f0;padding-top:24px;text-align:center;">
                  <p style="font-size:11px;color:#94a3b8;margin:0;">Designed and Managed by Shabbir Shakir &bull; BGK Khaitan</p>
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
    <body style="margin:0;padding:0;background:#f1f5f9;font-family:'Segoe UI',Arial,sans-serif;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:40px 20px;">
        <tr><td align="center">
          <table width="480" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e2e8f0;box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);">
            <tr>
              <td style="background:linear-gradient(135deg,#ef4444,#f59e0b);height:6px;"></td>
            </tr>
            <tr>
              <td align="center" style="padding:40px 40px 20px;">
                <img src="https://app.burhaniguards.org/images/logo.png" alt="BGK Logo" width="80" height="80" style="display:block;margin-bottom:16px;" />
                <h1 style="margin:0;font-size:22px;font-weight:700;color:#1e293b;">Burhani Guards Khaitan</h1>
                <p style="margin:4px 0 0;font-size:14px;color:#ef4444;font-weight:600;letter-spacing:1px;text-transform:uppercase;">Absence Notification</p>
              </td>
            </tr>
            <tr>
              <td style="padding:20px 40px 32px;">
                <p style="font-size:15px;color:#334155;margin:0 0 20px;">Assalaamu Alaikum, <strong style="color:#1e293b;">${name}</strong> (${itsId})</p>
                <p style="font-size:14px;color:#64748b;margin:0 0 24px;">This email is to inform you that your attendance was <strong>not marked</strong> for the following Miqaat event:</p>
                
                <table width="100%" cellpadding="12" cellspacing="0" style="background:#f8fafc;border-radius:10px;border:1px solid #e2e8f0;margin-bottom:24px;color:#1e293b;font-size:14px;">
                  <tr>
                    <td style="color:#64748b;width:30%;">Event:</td>
                    <td><strong>${miqaatName}</strong></td>
                  </tr>
                  <tr>
                    <td style="color:#64748b;">Status:</td>
                    <td><span style="color:#ef4444;font-weight:bold;">Absent</span></td>
                  </tr>
                  <tr>
                    <td style="color:#64748b;">Date:</td>
                    <td>${dateString}</td>
                  </tr>
                  ${location ? `<tr>
                    <td style="color:#64748b;">Location:</td>
                    <td>${location}</td>
                  </tr>` : ''}
                </table>

                <p style="font-size:13px;color:#475569;line-height:1.6;margin:0 0 16px;">
                  If you attended this event but your attendance was not marked, or if you were on leave/safar, please contact your <strong>Group Leader</strong> or <strong>Idara Admin</strong> as soon as possible to update your record.
                </p>
              </td>
            </tr>
            <tr>
              <td style="padding:0 40px 32px;">
                <div style="border-top:1px solid #e2e8f0;padding-top:24px;text-align:center;">
                  <p style="font-size:11px;color:#94a3b8;margin:0;">Designed and Managed by Shabbir Shakir &bull; BGK Khaitan</p>
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

export function userCreatedEmailTemplate(name: string, itsId: string, mohallahName: string, role: string, designation: string): string {
  return `
    <!DOCTYPE html>
    <html>
    <head><meta charset="UTF-8" /><title>Account Created - BGK Attendance</title></head>
    <body style="margin:0;padding:0;background:#f1f5f9;font-family:'Segoe UI',Arial,sans-serif;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:40px 20px;">
        <tr><td align="center">
          <table width="480" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e2e8f0;box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);">
            <tr><td style="background:linear-gradient(135deg,#3b82f6,#10b981);height:6px;"></td></tr>
            <tr>
              <td style="padding:40px 40px 20px;">
                <h1 style="margin:0;font-size:22px;font-weight:700;color:#1e293b;">BGK Attendance</h1>
                <p style="margin:8px 0 0;font-size:14px;color:#64748b;">Account Registration Confirmation</p>
              </td>
            </tr>
            <tr>
              <td style="padding:20px 40px 32px;color:#334155;font-size:14px;line-height:1.6;">
                <p>Assalaamu Alaikum, <strong style="color:#1e293b;">${name}</strong></p>
                <p>Your account has been successfully created in the BGK Attendance System with the following details:</p>
                <table width="100%" cellpadding="10" cellspacing="0" style="background:#f8fafc;border-radius:10px;border:1px solid #e2e8f0;margin:20px 0;color:#1e293b;font-size:13px;">
                  <tr><td style="color:#64748b;width:35%;">ITS ID:</td><td><strong>${itsId}</strong></td></tr>
                  <tr><td style="color:#64748b;">Mohallah:</td><td>${mohallahName}</td></tr>
                  <tr><td style="color:#64748b;">Role:</td><td>${role}</td></tr>
                  <tr><td style="color:#64748b;">Designation:</td><td>${designation}</td></tr>
                </table>
                <p style="margin:20px 0 0;">You can log in to the portal at: <a href="https://bgk-attendance.netlify.app" style="color:#2563eb;font-weight:600;text-decoration:none;">bgk-attendance.netlify.app</a></p>
              </td>
            </tr>
            <tr>
              <td style="padding:0 40px 32px;">
                <div style="border-top:1px solid #e2e8f0;padding-top:24px;text-align:center;">
                  <p style="font-size:11px;color:#94a3b8;margin:0;">Designed and Managed by Shabbir Shakir &bull; BGK Khaitan</p>
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

export function userTransferredEmailTemplate(name: string, itsId: string, oldMohallahName: string, newMohallahName: string): string {
  return `
    <!DOCTYPE html>
    <html>
    <head><meta charset="UTF-8" /><title>Account Transferred - BGK Attendance</title></head>
    <body style="margin:0;padding:0;background:#f1f5f9;font-family:'Segoe UI',Arial,sans-serif;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:40px 20px;">
        <tr><td align="center">
          <table width="480" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e2e8f0;box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);">
            <tr><td style="background:linear-gradient(135deg,#f59e0b,#3b82f6);height:6px;"></td></tr>
            <tr>
              <td style="padding:40px 40px 20px;">
                <h1 style="margin:0;font-size:22px;font-weight:700;color:#1e293b;">BGK Attendance</h1>
                <p style="margin:8px 0 0;font-size:14px;color:#64748b;">Mohallah Transfer Notification</p>
              </td>
            </tr>
            <tr>
              <td style="padding:20px 40px 32px;color:#334155;font-size:14px;line-height:1.6;">
                <p>Assalaamu Alaikum, <strong style="color:#1e293b;">${name}</strong></p>
                <p>Your BGK Attendance profile has been transferred to a new Mohallah:</p>
                <table width="100%" cellpadding="10" cellspacing="0" style="background:#f8fafc;border-radius:10px;border:1px solid #e2e8f0;margin:20px 0;color:#1e293b;font-size:13px;">
                  <tr><td style="color:#64748b;width:35%;">ITS ID:</td><td><strong>${itsId}</strong></td></tr>
                  <tr><td style="color:#64748b;">From Mohallah:</td><td>${oldMohallahName}</td></tr>
                  <tr><td style="color:#64748b;">To Mohallah:</td><td><span style="color:#d97706;font-weight:bold;">${newMohallahName}</span></td></tr>
                </table>
                <p>All your attendance history and profile logs have been successfully preserved.</p>
              </td>
            </tr>
            <tr>
              <td style="padding:0 40px 32px;">
                <div style="border-top:1px solid #e2e8f0;padding-top:24px;text-align:center;">
                  <p style="font-size:11px;color:#94a3b8;margin:0;">Designed and Managed by Shabbir Shakir &bull; BGK Khaitan</p>
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

export function userDeletedEmailTemplate(name: string, itsId: string): string {
  return `
    <!DOCTYPE html>
    <html>
    <head><meta charset="UTF-8" /><title>Account Deactivated - BGK Attendance</title></head>
    <body style="margin:0;padding:0;background:#f1f5f9;font-family:'Segoe UI',Arial,sans-serif;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:40px 20px;">
        <tr><td align="center">
          <table width="480" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e2e8f0;box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);">
            <tr><td style="background:linear-gradient(135deg,#ef4444,#f59e0b);height:6px;"></td></tr>
            <tr>
              <td style="padding:40px 40px 20px;">
                <h1 style="margin:0;font-size:22px;font-weight:700;color:#1e293b;">BGK Attendance</h1>
                <p style="margin:8px 0 0;font-size:14px;color:#ef4444;font-weight:600;letter-spacing:1px;text-transform:uppercase;">Account Deactivation</p>
              </td>
            </tr>
            <tr>
              <td style="padding:20px 40px 32px;color:#334155;font-size:14px;line-height:1.6;">
                <p>Assalaamu Alaikum, <strong style="color:#1e293b;">${name}</strong></p>
                <p>This email is to inform you that your account associated with ITS ID <strong style="color:#1e293b;">${itsId}</strong> has been deactivated or removed by the administrator.</p>
                <p>If you believe this is in error, or if your registration should be restored, please contact your Mohallah administrator.</p>
              </td>
            </tr>
            <tr>
              <td style="padding:0 40px 32px;">
                <div style="border-top:1px solid #e2e8f0;padding-top:24px;text-align:center;">
                  <p style="font-size:11px;color:#94a3b8;margin:0;">Designed and Managed by Shabbir Shakir &bull; BGK Khaitan</p>
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

export function teamLeaderAbsenceReportEmailTemplate(
  leaderName: string,
  leaderDesignation: string,
  teamName: string,
  miqaatName: string,
  dateString: string,
  absentees: { name: string; itsId: string; email?: string }[]
): string {
  const absenteeRows = absentees.length > 0
    ? absentees.map((a, idx) => `
        <tr style="border-bottom: 1px solid #e2e8f0;">
          <td style="padding: 10px; font-size: 14px; color: #1e293b;">${idx + 1}</td>
          <td style="padding: 10px; font-size: 14px; color: #1e293b;"><strong>${a.name}</strong></td>
          <td style="padding: 10px; font-size: 14px; color: #475569;">${a.itsId}</td>
          <td style="padding: 10px; font-size: 14px; color: #475569;">${a.email || '-'}</td>
        </tr>
      `).join('')
    : `<tr><td colspan="4" style="padding: 20px; text-align: center; color: #64748b; font-style: italic;">No absentees! Everyone in your team was marked present or safar.</td></tr>`;

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8" />
      <title>Team Absentee Report - BGK Attendance</title>
    </head>
    <body style="margin:0;padding:0;background:#f1f5f9;font-family:'Segoe UI',Arial,sans-serif;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:40px 20px;">
        <tr><td align="center">
          <table width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e2e8f0;box-shadow: 0 4px 6px -1px rgba(0,0,0,0.05);">
            <tr>
              <td style="background:linear-gradient(135deg,#3b82f6,#1d4ed8);height:6px;"></td>
            </tr>
            <tr>
              <td align="center" style="padding:40px 40px 20px;">
                <img src="https://app.burhaniguards.org/images/logo.png" alt="BGK Logo" width="80" height="80" style="display:block;margin-bottom:16px;" />
                <h1 style="margin:0;font-size:22px;font-weight:700;color:#1e293b;">Burhani Guards Khaitan</h1>
                <p style="margin:4px 0 0;font-size:14px;color:#475569;font-weight:600;letter-spacing:1px;text-transform:uppercase;">Team Absentee Report</p>
              </td>
            </tr>
            <tr>
              <td style="padding:20px 40px 32px;">
                <p style="font-size:15px;color:#1e293b;margin:0 0 20px;">Assalaamu Alaikum, <strong style="color:#1e293b;">${leaderName}</strong> (${leaderDesignation})</p>
                <p style="font-size:14px;color:#475569;margin:0 0 24px;">Below is the list of absentees from <strong>${teamName}</strong> for the Miqaat event:</p>
                
                <table width="100%" cellpadding="10" cellspacing="0" style="background:#f8fafc;border-radius:10px;border:1px solid #e2e8f0;margin-bottom:24px;font-size:13px;">
                  <tr>
                    <td style="color:#64748b;width:30%;">Miqaat Event:</td>
                    <td style="color:#1e293b;"><strong>${miqaatName}</strong></td>
                  </tr>
                  <tr>
                    <td style="color:#64748b;">Date:</td>
                    <td style="color:#1e293b;">${dateString}</td>
                  </tr>
                  <tr>
                    <td style="color:#64748b;">Total Absentees:</td>
                    <td style="color:#ef4444;font-weight:bold;">${absentees.length}</td>
                  </tr>
                </table>

                <h3 style="font-size:15px;font-weight:600;color:#1e293b;margin:0 0 12px;border-bottom:2px solid #3b82f6;padding-bottom:6px;">Absentee Members</h3>
                <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin-bottom:24px;text-align:left;">
                  <thead>
                    <tr style="background:#f1f5f9;border-bottom:2px solid #e2e8f0;">
                      <th style="padding:10px;font-size:12px;font-weight:600;color:#475569;width:8%;">#</th>
                      <th style="padding:10px;font-size:12px;font-weight:600;color:#475569;">Name</th>
                      <th style="padding:10px;font-size:12px;font-weight:600;color:#475569;width:25%;">ITS ID</th>
                      <th style="padding:10px;font-size:12px;font-weight:600;color:#475569;width:35%;">Email</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${absenteeRows}
                  </tbody>
                </table>

                <p style="font-size:13px;color:#475569;line-height:1.6;margin:0;">
                  Please follow up with these members to understand their reason for absence. If any corrections are required, please contact the administrator.
                </p>
              </td>
            </tr>
            <tr>
              <td style="padding:0 40px 32px;">
                <div style="border-top:1px solid #e2e8f0;padding-top:24px;text-align:center;">
                  <p style="font-size:11px;color:#94a3b8;margin:0;">Designed and Managed by Shabbir Shakir &bull; BGK Khaitan</p>
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
