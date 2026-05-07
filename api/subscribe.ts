import type { VercelRequest, VercelResponse } from '@vercel/node';

interface SubscribeBody {
  name?: unknown;
  email?: unknown;
  topic?: unknown;
}

interface MailchimpError {
  title?: string;
  detail?: string;
  status?: number;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, message: 'Method not allowed' });
  }

  const apiKey = process.env.MAILCHIMP_API_KEY;
  const listId = process.env.MAILCHIMP_LIST_ID;
  const dc = process.env.MAILCHIMP_DC;

  if (!apiKey || !listId || !dc) {
    return res
      .status(500)
      .json({ ok: false, message: 'Newsletter is not configured.' });
  }

  const body = (req.body ?? {}) as SubscribeBody;
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  const email = typeof body.email === 'string' ? body.email.trim() : '';
  const topic = typeof body.topic === 'string' ? body.topic.trim() : '';

  if (name.length < 2) {
    return res.status(400).json({ ok: false, message: 'Please enter your first name.' });
  }
  if (!EMAIL_RE.test(email)) {
    return res.status(400).json({ ok: false, message: 'Please enter a valid email address.' });
  }

  const mergeFields: Record<string, string> = { FNAME: name };
  if (topic) mergeFields.MMERGE7 = topic.slice(0, 200);

  const url = `https://${dc}.api.mailchimp.com/3.0/lists/${listId}/members`;
  const auth = Buffer.from(`anystring:${apiKey}`).toString('base64');

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Basic ${auth}`,
      },
      body: JSON.stringify({
        email_address: email,
        status: 'subscribed',
        merge_fields: mergeFields,
      }),
    });

    if (response.ok) {
      return res
        .status(200)
        .json({ ok: true, message: `Welcome, ${name}! Check your inbox.` });
    }

    const data = (await response.json().catch(() => ({}))) as MailchimpError;

    if (data.title === 'Member Exists') {
      return res
        .status(200)
        .json({ ok: true, message: 'You are already subscribed.' });
    }

    return res
      .status(response.status === 401 || response.status === 403 ? 500 : 400)
      .json({ ok: false, message: data.detail || data.title || 'Could not subscribe.' });
  } catch (err) {
    return res
      .status(502)
      .json({ ok: false, message: 'Network error. Please try again.' });
  }
}
