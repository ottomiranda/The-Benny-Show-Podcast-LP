const API_KEY = import.meta.env.VITE_YT_API_KEY as string | undefined;
const CHANNEL_ID = import.meta.env.VITE_YT_CHANNEL_ID as string | undefined;
const API_BASE = 'https://www.googleapis.com/youtube/v3';
const CACHE_TTL_MS = 30 * 60 * 1000;
const SHORT_MAX_DURATION_SECONDS = 60;

export interface ChannelStats {
  title: string;
  videoCount: number;
  viewCount: number;
  subscriberCount: number;
}

export interface VideoSummary {
  id: string;
  title: string;
  description: string;
  publishedAt: string;
  thumbnailUrl: string;
  durationSeconds: number;
  viewCount: number;
}

type CacheEntry<T> = { data: T; timestamp: number };

interface ChannelsResponse {
  items: Array<{
    snippet: { title: string };
    statistics: { videoCount: string; viewCount: string; subscriberCount: string };
    contentDetails: { relatedPlaylists: { uploads: string } };
  }>;
}

interface PlaylistItemsResponse {
  items: Array<{ contentDetails: { videoId: string } }>;
}

interface VideosResponse {
  items: Array<{
    id: string;
    snippet: {
      title: string;
      description: string;
      publishedAt: string;
      thumbnails: { high?: { url: string }; medium?: { url: string }; default?: { url: string } };
    };
    contentDetails: { duration: string };
    statistics: { viewCount: string };
  }>;
}

function getCache<T>(key: string): T | null {
  if (typeof sessionStorage === 'undefined') return null;
  const raw = sessionStorage.getItem(key);
  if (!raw) return null;
  try {
    const entry = JSON.parse(raw) as CacheEntry<T>;
    if (Date.now() - entry.timestamp > CACHE_TTL_MS) {
      sessionStorage.removeItem(key);
      return null;
    }
    return entry.data;
  } catch {
    sessionStorage.removeItem(key);
    return null;
  }
}

function setCache<T>(key: string, data: T): void {
  if (typeof sessionStorage === 'undefined') return;
  try {
    const entry: CacheEntry<T> = { data, timestamp: Date.now() };
    sessionStorage.setItem(key, JSON.stringify(entry));
  } catch {
    /* sessionStorage quota exceeded — drop silently */
  }
}

function requireConfig(): { apiKey: string; channelId: string } {
  if (!API_KEY) throw new Error('VITE_YT_API_KEY is not configured');
  if (!CHANNEL_ID) throw new Error('VITE_YT_CHANNEL_ID is not configured');
  return { apiKey: API_KEY, channelId: CHANNEL_ID };
}

async function ytFetch<T>(path: string, params: Record<string, string>): Promise<T> {
  const { apiKey } = requireConfig();
  const url = new URL(`${API_BASE}/${path}`);
  url.searchParams.set('key', apiKey);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const res = await fetch(url.toString());
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`YouTube API ${res.status}: ${text}`);
  }
  return res.json() as Promise<T>;
}

function parseISODuration(iso: string): number {
  const match = /^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/.exec(iso);
  if (!match) return 0;
  const hours = match[1] ? parseInt(match[1], 10) : 0;
  const minutes = match[2] ? parseInt(match[2], 10) : 0;
  const seconds = match[3] ? parseInt(match[3], 10) : 0;
  return hours * 3600 + minutes * 60 + seconds;
}

interface ChannelData {
  uploadsPlaylistId: string;
  stats: ChannelStats;
}

let channelDataPromise: Promise<ChannelData> | null = null;

async function getChannelData(): Promise<ChannelData> {
  if (channelDataPromise) return channelDataPromise;

  const { channelId } = requireConfig();
  const cacheKey = `yt:channel:${channelId}`;
  const cached = getCache<ChannelData>(cacheKey);
  if (cached) return cached;

  channelDataPromise = (async () => {
    const res = await ytFetch<ChannelsResponse>('channels', {
      part: 'snippet,statistics,contentDetails',
      id: channelId,
    });
    const item = res.items[0];
    if (!item) throw new Error(`YouTube channel not found: ${channelId}`);
    const data: ChannelData = {
      uploadsPlaylistId: item.contentDetails.relatedPlaylists.uploads,
      stats: {
        title: item.snippet.title,
        videoCount: parseInt(item.statistics.videoCount, 10),
        viewCount: parseInt(item.statistics.viewCount, 10),
        subscriberCount: parseInt(item.statistics.subscriberCount, 10),
      },
    };
    setCache(cacheKey, data);
    return data;
  })().catch((err) => {
    channelDataPromise = null;
    throw err;
  });

  return channelDataPromise;
}

async function fetchVideoDetails(ids: string[]): Promise<VideoSummary[]> {
  if (ids.length === 0) return [];
  const res = await ytFetch<VideosResponse>('videos', {
    part: 'snippet,contentDetails,statistics',
    id: ids.join(','),
  });
  return res.items.map((v) => ({
    id: v.id,
    title: v.snippet.title,
    description: v.snippet.description,
    publishedAt: v.snippet.publishedAt,
    thumbnailUrl:
      v.snippet.thumbnails.high?.url ??
      v.snippet.thumbnails.medium?.url ??
      v.snippet.thumbnails.default?.url ??
      '',
    durationSeconds: parseISODuration(v.contentDetails.duration),
    viewCount: parseInt(v.statistics.viewCount, 10),
  }));
}

export async function getChannelStats(): Promise<ChannelStats> {
  const { stats } = await getChannelData();
  return stats;
}

export async function getLatestVideo(): Promise<VideoSummary | null> {
  const { channelId } = requireConfig();
  const cacheKey = `yt:latest-video:${channelId}`;
  const cached = getCache<VideoSummary>(cacheKey);
  if (cached) return cached;

  const { uploadsPlaylistId } = await getChannelData();
  const list = await ytFetch<PlaylistItemsResponse>('playlistItems', {
    part: 'contentDetails',
    playlistId: uploadsPlaylistId,
    maxResults: '10',
  });
  const ids = list.items.map((i) => i.contentDetails.videoId);
  const videos = await fetchVideoDetails(ids);
  const latest =
    videos.find((v) => v.durationSeconds > SHORT_MAX_DURATION_SECONDS) ?? videos[0] ?? null;
  if (!latest) return null;
  setCache(cacheKey, latest);
  return latest;
}

export async function getLatestShorts(limit = 6): Promise<VideoSummary[]> {
  const { channelId } = requireConfig();
  const cacheKey = `yt:shorts:${channelId}:${limit}`;
  const cached = getCache<VideoSummary[]>(cacheKey);
  if (cached) return cached;

  const { uploadsPlaylistId } = await getChannelData();
  const list = await ytFetch<PlaylistItemsResponse>('playlistItems', {
    part: 'contentDetails',
    playlistId: uploadsPlaylistId,
    maxResults: '50',
  });
  const ids = list.items.map((i) => i.contentDetails.videoId);
  const videos = await fetchVideoDetails(ids);
  const shorts = videos
    .filter((v) => v.durationSeconds > 0 && v.durationSeconds <= SHORT_MAX_DURATION_SECONDS)
    .slice(0, limit);
  setCache(cacheKey, shorts);
  return shorts;
}

export function formatCount(n: number): string {
  if (!Number.isFinite(n) || n < 0) return '0';
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1).replace(/\.0$/, '')}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1).replace(/\.0$/, '')}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1).replace(/\.0$/, '')}K`;
  return String(n);
}

export function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return '0:00';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  return `${m}:${String(s).padStart(2, '0')}`;
}
