import { NextRequest, NextResponse } from 'next/server';
import { ImapFlow } from 'imapflow';

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
    let bodyText = 'No text content available.';

    try {
      const message = await client.fetchOne(String(uid), {
        source: true
      }, { uid: true });

      if (message && message.source) {
        const sourceStr = message.source.toString();
        
        // Simple extraction of the HTML body content if present
        const htmlMatch = sourceStr.match(/<html>([\s\S]*?)<\/html>/i);
        if (htmlMatch) {
          bodyText = htmlMatch[1]
            .replace(/<style([\s\S]*?)<\/style>/gi, '')
            .replace(/<script([\s\S]*?)<\/script>/gi, '')
            .replace(/<[^>]+>/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
        } else {
          // Fallback to extraction from plain text content MIME structures
          const textMatch = sourceStr.match(/Content-Transfer-Encoding:[\s\S]*?\n\r?\n([\s\S]*?)(?=------|=20)/i) 
            || sourceStr.match(/Content-Type: text\/plain[\s\S]*?\n\r?\n([\s\S]*?)(?=------|$)/i);
            
          if (textMatch) {
            bodyText = textMatch[1].trim();
          } else {
            // Ultimate fallback: split headers and body
            const parts = sourceStr.split(/\r?\n\r?\n/);
            if (parts.length > 1) {
              bodyText = parts.slice(1).join('\n')
                .replace(/<[^>]+>/g, ' ')
                .replace(/\s+/g, ' ')
                .trim();
            }
          }
        }
      }
    } finally {
      lock.release();
    }

    await client.logout();

    // Clean up snippet/body layout
    bodyText = bodyText
      .replace(/=\r?\n/g, '') // Remove quoted-printable line breaks
      .replace(/=3D/g, '=')   // Decode equals signs
      .replace(/=20/g, ' ')   // Decode space
      .substring(0, 1000)
      .trim();

    return NextResponse.json({ success: true, body: bodyText });
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
