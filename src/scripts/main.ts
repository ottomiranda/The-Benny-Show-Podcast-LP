import {
  formatCount,
  formatDuration,
  getChannelStats,
  getLatestShorts,
  getLatestVideo,
  type ChannelStats,
  type VideoSummary,
} from '@/lib/youtube';
import { subscribeToMailchimp } from '@/lib/mailchimp';
import { TESTIMONIALS, type Testimonial } from '@/lib/testimonials';
import { initBrandPitch } from './brand-pitch';

const SHORTS_LIMIT = 6;

type StatKey = 'videos' | 'views' | 'subscribers';

function formatStat(stats: ChannelStats, key: StatKey): string {
  switch (key) {
    case 'videos':
      return formatCount(stats.videoCount);
    case 'views':
      return formatCount(stats.viewCount);
    case 'subscribers':
      return formatCount(stats.subscriberCount);
  }
}

function formatPublishedDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function setText(selector: string, value: string, root: ParentNode = document) {
  root.querySelectorAll<HTMLElement>(selector).forEach((el) => {
    el.textContent = value;
  });
}

async function hydrateChannelStats(): Promise<void> {
  let stats: ChannelStats;
  try {
    stats = await getChannelStats();
  } catch (err) {
    console.warn('[hydrate] channel stats failed', err);
    return;
  }

  document.querySelectorAll<HTMLElement>('[data-yt-stat]').forEach((el) => {
    const key = el.dataset.ytStat as StatKey | undefined;
    if (!key) return;
    el.textContent = formatStat(stats, key);
  });
}

function highestThumbnail(video: VideoSummary): string {
  return `https://i.ytimg.com/vi/${video.id}/maxresdefault.jpg`;
}

function fallbackThumbnail(videoId: string): string {
  return `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`;
}

async function hydrateLatestEpisode(): Promise<void> {
  const card = document.querySelector<HTMLElement>('[data-yt-video]');
  if (!card) return;

  let video: VideoSummary | null = null;
  try {
    video = await getLatestVideo();
  } catch (err) {
    console.warn('[hydrate] latest video failed', err);
  }

  if (!video) {
    setText('[data-yt-video-title]', 'Latest episodes are on YouTube', card);
    setText(
      '[data-yt-video-description]',
      'Tap the play button or open the channel to watch the newest drop.',
      card,
    );
    setText('[data-yt-video-duration]', '—', card);
    setText('[data-yt-video-date]', '—', card);
    setText('[data-yt-video-views]', '—', card);
    return;
  }

  card.dataset.ytVideoId = video.id;

  const thumb = card.querySelector<HTMLImageElement>('[data-yt-video-thumb]');
  if (thumb) {
    const picture = thumb.closest('picture');
    picture?.querySelectorAll('source').forEach((source) => source.remove());
    thumb.alt = video.title;
    thumb.onerror = () => {
      thumb.onerror = null;
      thumb.src = fallbackThumbnail(video.id);
    };
    thumb.src = highestThumbnail(video);
  }

  setText('[data-yt-video-title]', video.title, card);
  setText(
    '[data-yt-video-description]',
    video.description.split('\n')[0] || video.title,
    card,
  );
  setText('[data-yt-video-duration]', formatDuration(video.durationSeconds), card);
  setText('[data-yt-video-date]', formatPublishedDate(video.publishedAt), card);
  setText('[data-yt-video-views]', `${formatCount(video.viewCount)} views`, card);

  const iframe = document.getElementById('episodeIframe') as HTMLIFrameElement | null;
  if (iframe) {
    iframe.title = `${video.title} — The Beny Podcast Show`;
  }
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function shortThumbnail(video: VideoSummary): string {
  return video.thumbnailUrl || `https://i.ytimg.com/vi/${video.id}/hqdefault.jpg`;
}

function buildPhoneMock(video: VideoSummary, ariaHidden: boolean): string {
  const safeTitle = escapeHtml(video.title);
  const tabAttrs = ariaHidden
    ? 'tabindex="-1" aria-hidden="true"'
    : `tabindex="0" role="button" aria-label="Play short: ${safeTitle}"`;
  return `
    <div class="phone-mock" data-yt-short-id="${video.id}" ${tabAttrs}>
      <div class="phone-mock-screen" data-yt-short-screen>
        <img src="${shortThumbnail(video)}" alt="" loading="lazy" data-yt-short-thumb />
      </div>
      <div class="phone-mock-overlay">
        <div class="phone-mock-title">${safeTitle}</div>
        <div class="phone-mock-views">${formatCount(video.viewCount)} views</div>
      </div>
      <div class="phone-mock-play">
        <svg viewBox="0 0 24 24"><polygon points="5 3 19 12 5 21 5 3"/></svg>
      </div>
      <button type="button" class="phone-mock-close" data-yt-short-close aria-label="Stop video">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>
    </div>
  `;
}

let activeShortMock: HTMLElement | null = null;

function stopShort(mock: HTMLElement | null) {
  if (!mock) return;
  const screen = mock.querySelector<HTMLElement>('[data-yt-short-screen]');
  const videoId = mock.dataset.ytShortId;
  if (!screen || !videoId) return;
  screen.innerHTML = `<img src="${shortThumbnail({ id: videoId, thumbnailUrl: '' } as VideoSummary)}" alt="" loading="lazy" data-yt-short-thumb />`;
  mock.classList.remove('is-playing');
}

function playShort(mock: HTMLElement) {
  const videoId = mock.dataset.ytShortId;
  const screen = mock.querySelector<HTMLElement>('[data-yt-short-screen]');
  if (!videoId || !screen) return;

  if (activeShortMock && activeShortMock !== mock) {
    stopShort(activeShortMock);
  }

  const iframe = document.createElement('iframe');
  iframe.src = `https://www.youtube.com/embed/${videoId}?autoplay=1&playsinline=1&rel=0&modestbranding=1`;
  iframe.title = 'YouTube short';
  iframe.allow = 'accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen';
  iframe.setAttribute('allowfullscreen', '');
  iframe.frameBorder = '0';
  screen.replaceChildren(iframe);
  mock.classList.add('is-playing');
  activeShortMock = mock;

  const marquee = mock.closest<HTMLElement>('[data-yt-shorts-marquee]');
  if (marquee) marquee.classList.add('is-playing');
}

function bindShortInteractions() {
  const marquee = document.querySelector<HTMLElement>('[data-yt-shorts-marquee]');
  if (!marquee) return;

  marquee.addEventListener('click', (event) => {
    const target = event.target as HTMLElement;
    const closeBtn = target.closest<HTMLElement>('[data-yt-short-close]');
    if (closeBtn) {
      event.preventDefault();
      event.stopPropagation();
      const mock = closeBtn.closest<HTMLElement>('.phone-mock');
      stopShort(mock);
      if (mock && mock === activeShortMock) {
        activeShortMock = null;
        marquee.classList.remove('is-playing');
      }
      return;
    }
    const mock = target.closest<HTMLElement>('.phone-mock:not(.phone-mock--skeleton)');
    if (!mock || mock.classList.contains('is-playing')) return;
    playShort(mock);
  });

  marquee.addEventListener('keydown', (event) => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    const target = event.target as HTMLElement;
    const mock = target.closest<HTMLElement>('.phone-mock:not(.phone-mock--skeleton)');
    if (!mock || mock.classList.contains('is-playing')) return;
    event.preventDefault();
    playShort(mock);
  });
}

async function hydrateShorts(): Promise<void> {
  const track = document.querySelector<HTMLElement>('[data-yt-shorts-track]');
  const marquee = document.querySelector<HTMLElement>('[data-yt-shorts-marquee]');
  if (!track || !marquee) return;

  let shorts: VideoSummary[] = [];
  try {
    shorts = await getLatestShorts(SHORTS_LIMIT);
  } catch (err) {
    console.warn('[hydrate] shorts failed', err);
  }

  if (shorts.length === 0) {
    marquee.hidden = true;
    return;
  }

  const real = shorts.map((v) => buildPhoneMock(v, false)).join('');
  const dup = shorts.map((v) => buildPhoneMock(v, true)).join('');
  track.innerHTML = real + dup;
  bindShortInteractions();
}

function buildReviewCard(t: Testimonial): string {
  const star = '<svg viewBox="0 0 24 24"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>';
  return `
    <article class="review-card">
      <div class="review-stars">${star.repeat(5)}</div>
      <p class="review-text">${escapeHtml(t.text)}</p>
      <div class="review-author">
        <div class="review-avatar">
          <img src="${escapeHtml(t.photo)}" alt="${escapeHtml(t.name)}" loading="lazy" />
        </div>
        <div class="review-info">
          <div class="review-name">${escapeHtml(t.name)}</div>
          <div class="review-role">${escapeHtml(t.role)}</div>
        </div>
        <span class="review-badge">Verified</span>
      </div>
    </article>
  `;
}

function renderReviews(): void {
  const ltr = document.querySelector<HTMLElement>('[data-reviews-track="ltr"]');
  const rtl = document.querySelector<HTMLElement>('[data-reviews-track="rtl"]');
  if (!ltr || !rtl) return;

  const ltrCards = TESTIMONIALS.map(buildReviewCard).join('');
  const offset = TESTIMONIALS.length / 2;
  const rotated = [...TESTIMONIALS.slice(offset), ...TESTIMONIALS.slice(0, offset)];
  const rtlCards = rotated.map(buildReviewCard).join('');

  ltr.innerHTML = ltrCards + ltrCards;
  rtl.innerHTML = rtlCards + rtlCards;
}

function bindNewsletter(): void {
  const form = document.querySelector<HTMLFormElement>('[data-newsletter-form]');
  if (!form) return;
  const status = form.parentElement?.querySelector<HTMLElement>('[data-newsletter-status]');
  const submitBtn = form.querySelector<HTMLButtonElement>('[data-newsletter-submit]');
  const submitLabel = form.querySelector<HTMLElement>('[data-newsletter-submit-label]');

  const setStatus = (message: string, kind: 'idle' | 'success' | 'error') => {
    if (!status) return;
    status.textContent = message;
    status.classList.remove('is-success', 'is-error');
    if (kind === 'success') status.classList.add('is-success');
    if (kind === 'error') status.classList.add('is-error');
  };

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const data = new FormData(form);
    const name = String(data.get('name') ?? '').trim();
    const email = String(data.get('email') ?? '').trim();
    const topic = String(data.get('topic') ?? '').trim();

    if (name.length < 2) {
      setStatus('Please enter your first name.', 'error');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setStatus('Please enter a valid email address.', 'error');
      return;
    }

    if (submitBtn) submitBtn.disabled = true;
    if (submitLabel) submitLabel.textContent = 'Sending…';
    setStatus('', 'idle');

    const result = await subscribeToMailchimp({ name, email, topic });

    if (submitBtn) submitBtn.disabled = false;

    if (result.ok) {
      if (submitLabel) submitLabel.textContent = 'Subscribed';
      setStatus(result.message || `Welcome, ${name}! Check your inbox.`, 'success');
      form.reset();
      window.setTimeout(() => {
        if (submitLabel) submitLabel.textContent = 'Subscribe';
      }, 6000);
    } else {
      if (submitLabel) submitLabel.textContent = 'Subscribe';
      setStatus(result.message || 'Could not subscribe. Try again.', 'error');
    }
  });
}

function init(): void {
  void hydrateChannelStats();
  void hydrateLatestEpisode();
  void hydrateShorts();
  renderReviews();
  bindNewsletter();
  initBrandPitch();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init, { once: true });
} else {
  init();
}
