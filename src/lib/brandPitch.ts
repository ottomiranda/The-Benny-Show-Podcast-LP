const ENDPOINT = import.meta.env.VITE_BRAND_PITCH_URL as string | undefined;

export interface BrandPitchPayload {
  firstName: string;
  lastName: string;
  phone: string;
  email: string;
  company: string;
  industry: string;
}

export interface BrandPitchResult {
  ok: boolean;
  message: string;
}

export async function submitBrandPitch(payload: BrandPitchPayload): Promise<BrandPitchResult> {
  if (!ENDPOINT) {
    if (import.meta.env.DEV) {
      console.warn('[brand-pitch] VITE_BRAND_PITCH_URL is not configured — payload:', payload);
      return {
        ok: true,
        message: "Demo mode: pitch logged to console. We'll be in touch within 48h.",
      };
    }
    return {
      ok: false,
      message: 'Pitch endpoint is not configured yet. Please email us instead.',
    };
  }

  const body = {
    ...payload,
    _subject: `New brand pitch: ${payload.company} (${payload.industry})`,
    _replyto: payload.email,
  };

  try {
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      let detail = '';
      try {
        const data = (await res.json()) as { error?: string; errors?: Array<{ message?: string }> };
        detail = data.error ?? data.errors?.[0]?.message ?? '';
      } catch {
        /* ignore non-JSON error body */
      }
      return {
        ok: false,
        message: detail
          ? `${detail}`
          : `Submission failed (${res.status}). Please try again.`,
      };
    }
    return { ok: true, message: "Thanks! We'll review and get back within 48h." };
  } catch (err) {
    if (import.meta.env.DEV) console.error('[brand-pitch] submit failed', err);
    return { ok: false, message: 'Network error. Please try again.' };
  }
}
