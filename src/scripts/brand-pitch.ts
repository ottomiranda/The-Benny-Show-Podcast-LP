import { submitBrandPitch, type BrandPitchPayload } from '@/lib/brandPitch';

interface FieldElements {
  step: HTMLElement;
  input: HTMLInputElement | HTMLSelectElement;
  error: HTMLElement;
  back: HTMLButtonElement | null;
  next: HTMLButtonElement | null;
}

const FIELD_NAMES: Array<keyof BrandPitchPayload> = [
  'firstName',
  'lastName',
  'phone',
  'email',
  'company',
  'industry',
];

function showError(field: FieldElements, message: string) {
  field.error.textContent = message;
  field.input.setAttribute('aria-invalid', 'true');
}

function clearError(field: FieldElements) {
  field.error.textContent = '';
  field.input.removeAttribute('aria-invalid');
}

function validateField(field: FieldElements): string | null {
  const value = field.input.value.trim();
  if (!value) return 'This field is required.';
  if (field.input.tagName === 'SELECT' && (field.input as HTMLSelectElement).selectedIndex === 0) {
    return 'Please pick an option.';
  }
  if (field.input instanceof HTMLInputElement) {
    const minlen = parseInt(field.input.getAttribute('minlength') ?? '0', 10);
    if (minlen && value.length < minlen) return `At least ${minlen} characters, please.`;
    if (field.input.type === 'email' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
      return 'Please enter a valid email address.';
    }
    if (field.input.type === 'tel' && !/^[+\d][\d\s().-]{6,}$/.test(value)) {
      return 'Please enter a valid phone number.';
    }
  }
  return null;
}

export function initBrandPitch(): void {
  const form = document.querySelector<HTMLFormElement>('[data-pitch-form]');
  const card = document.querySelector<HTMLElement>('[data-pitch-card]');
  const progress = document.querySelector<HTMLElement>('[data-pitch-progress]');
  const success = document.querySelector<HTMLElement>('[data-pitch-success]');
  const successMsg = document.querySelector<HTMLElement>('[data-pitch-success-message]');
  if (!form || !card || !progress || !success) return;

  const stepEls = Array.from(form.querySelectorAll<HTMLElement>('[data-pitch-step]'));
  if (stepEls.length === 0) return;

  const fields: FieldElements[] = stepEls.map((step) => ({
    step,
    input: step.querySelector<HTMLInputElement | HTMLSelectElement>('[data-pitch-input]')!,
    error: step.querySelector<HTMLElement>('[data-pitch-error]')!,
    back: step.querySelector<HTMLButtonElement>('[data-pitch-back]'),
    next: step.querySelector<HTMLButtonElement>('[data-pitch-next]'),
  }));

  let current = 0;
  const total = fields.length;

  const showStep = (index: number, autoFocus = true) => {
    fields.forEach((f, i) => f.step.classList.toggle('is-active', i === index));
    progress.style.width = `${((index + 1) / total) * 100}%`;
    current = index;
    if (autoFocus) {
      window.requestAnimationFrame(() =>
        fields[index].input.focus({ preventScroll: true }),
      );
    }
  };

  const goNext = () => {
    const field = fields[current];
    const err = validateField(field);
    if (err) {
      showError(field, err);
      return;
    }
    clearError(field);
    if (current < total - 1) {
      showStep(current + 1);
    } else {
      void submitForm();
    }
  };

  const goBack = () => {
    if (current > 0) showStep(current - 1);
  };

  const submitForm = async () => {
    const finalBtn = form.querySelector<HTMLButtonElement>('[data-pitch-final]');
    if (finalBtn) {
      finalBtn.disabled = true;
      finalBtn.textContent = 'Sending…';
    }

    const data = new FormData(form);
    const payload: BrandPitchPayload = {
      firstName: String(data.get('firstName') ?? '').trim(),
      lastName: String(data.get('lastName') ?? '').trim(),
      phone: String(data.get('phone') ?? '').trim(),
      email: String(data.get('email') ?? '').trim(),
      company: String(data.get('company') ?? '').trim(),
      industry: String(data.get('industry') ?? '').trim(),
    };

    for (const name of FIELD_NAMES) {
      if (!payload[name]) {
        if (finalBtn) {
          finalBtn.disabled = false;
          finalBtn.textContent = 'Send pitch';
        }
        return;
      }
    }

    const result = await submitBrandPitch(payload);

    if (result.ok) {
      progress.style.width = '100%';
      form.hidden = true;
      success.hidden = false;
      if (successMsg) successMsg.textContent = result.message;
    } else {
      if (finalBtn) {
        finalBtn.disabled = false;
        finalBtn.textContent = 'Send pitch';
      }
      const last = fields[total - 1];
      showError(last, result.message);
    }
  };

  fields.forEach((field, idx) => {
    field.next?.addEventListener('click', goNext);
    field.back?.addEventListener('click', goBack);
    field.input.addEventListener('input', () => {
      if (field.error.textContent) clearError(field);
    });
    if (field.input instanceof HTMLInputElement) {
      field.input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          if (idx < total - 1) goNext();
          else void submitForm();
        }
      });
    }
  });

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    if (current === total - 1) void submitForm();
  });

  showStep(0, false);
}
