import { NextRequest, NextResponse } from 'next/server';
import { ImapFlow } from 'imapflow';

export async function GET(req: NextRequest) {
  let client: ImapFlow | null = null;
  try {
    const role = req.headers.get('x-user-role');
    if (role !== 'superadmin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const emailUser = process.env.EMAIL_USER;
    const emailPass = process.env.EMAIL_PASS;

    if (!emailUser || !emailPass) {
      return NextResponse.json({ error: 'Email configuration is missing on the server.' }, { status: 500 });
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
    const emails: any[] = [];

    try {
      const status = await client.status(sentMailboxPath, { messages: true });
      const totalMessages = status.messages || 0;

      if (totalMessages > 0) {
        const startSeq = Math.max(1, totalMessages - 49);
        const endSeq = totalMessages;
        const fetchRange = `${startSeq}:${endSeq}`;

        const messagesGen = client.fetch(fetchRange, {
          envelope: true
        });

        for await (const message of messagesGen) {
          const envelope = message.envelope;
          if (!envelope) continue;

          const toAddress = envelope.to && envelope.to.length > 0
            ? envelope.to.map((r: any) => `${r.name || ''} <${r.address || ''}>`.trim()).join(', ')
            : 'Unknown';
          
          emails.push({
            id: String(message.uid),
            to: toAddress,
            subject: envelope.subject || '(No Subject)',
            status: 'success',
            timestamp: envelope.date ? envelope.date.toISOString() : new Date().toISOString(),
            snippet: `Sent email (UID: ${message.uid})`,
          });
        }
      }
    } finally {
      lock.release();
    }

    await client.logout();

    // Sort emails by date descending (latest first)
    emails.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());

    return NextResponse.json({ success: true, logs: emails });
  } catch (error: any) {
    console.error('IMAP Fetch Error:', error);
    if (client) {
      try {
        await client.logout();
      } catch (logoutError) {
        // Ignore logout error if already disconnected
      }
    }
    return NextResponse.json({ error: 'Failed to retrieve email logs: ' + error.message }, { status: 500 });
  }
}
