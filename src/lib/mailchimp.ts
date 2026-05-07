export interface SubscribePayload {
  name: string;
  email: string;
  topic?: string;
}

export interface SubscribeResult {
  ok: boolean;
  message: string;
}

interface SubscribeApiResponse {
  ok?: boolean;
  message?: string;
}

export async function subscribeToMailchimp(payload: SubscribePayload): Promise<SubscribeResult> {
  try {
    const response = await fetch('/api/subscribe', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: payload.name.trim(),
        email: payload.email.trim(),
        topic: payload.topic?.trim() || undefined,
      }),
    });

    const data = (await response.json().catch(() => ({}))) as SubscribeApiResponse;

    return {
      ok: data.ok ?? response.ok,
      message: data.message ?? (response.ok ? 'Subscribed!' : 'Could not subscribe.'),
    };
  } catch {
    return { ok: false, message: 'Network error. Please try again.' };
  }
}
