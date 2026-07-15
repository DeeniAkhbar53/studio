import { NextRequest, NextResponse } from 'next/server';
import { ImapFlow } from 'imapflow';
import { simpleParser } from 'mailparser';

export async function GET(req: NextRequest) {
  let client: ImapFlow | null = null;
  try {
    const role = req.headers.get('x-user-role');
    if (role !== 'superadmin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { searchParams } = new URL(req.url);
    const uidStr = searchParams.get('uid');
    if (!uidStr) {
      return NextResponse.json({ error: 'Missing UID' }, { status: 400 });
    }
    const uid = parseInt(uidStr, 10);

    const emailUser = process.env.EMAIL_USER;
    const emailPass = process.env.EMAIL_PASS;

    if (!emailUser || !emailPass) {
      return NextResponse.json({ error: 'Email configuration is missing.' }, { status: 500 });
    }

    client = new ImapFlow({
      host: 'imap.gmail.com',
      port: 993,
      secure: true,
      auth: {
        user: emailUser,
        pass: emailPass,
      },
      logger: false,
    });

    await client.connect();

    const mailboxes = await client.list();
    let sentMailboxPath = '[Gmail]/Sent Mail';
    for (const m of mailboxes) {
      if (m.specialUse === '\\Sent' || m.name.toLowerCase() === 'sent' || m.path.toLowerCase().includes('sent')) {
        sentMailboxPath = m.path;
        break;
      }
    }

    const lock = await client.getMailboxLock(sentMailboxPath);
    let bodyHtml = 'No content available.';

    try {
      const message = await client.fetchOne(String(uid), {
        source: true
      }, { uid: true });

      if (message && message.source) {
        const parsed = await simpleParser(message.source);
        bodyHtml = parsed.html || parsed.textAsHtml || parsed.text || 'No content available.';
      }
    } finally {
      lock.release();
    }

    await client.logout();

    return NextResponse.json({ success: true, body: bodyHtml });
  } catch (error: any) {
    console.error('IMAP Fetch Body Error:', error);
    if (client) {
      try {
        await client.logout();
      } catch (logoutError) {
        // Ignore logout error
      }
    }
    return NextResponse.json({ error: 'Failed to retrieve email body: ' + error.message }, { status: 500 });
  }
}
