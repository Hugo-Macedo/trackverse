import type { TrackverseBeat } from "@/lib/beats";

const API_BASE_URL = "https://www.googleapis.com/youtube/v3";

type YouTubeSearchResponse = {
  items?: YouTubeSearchItem[];
  nextPageToken?: string;
};

type YouTubeSearchItem = {
  id?: {
    videoId?: string;
  };
  snippet?: {
    title?: string;
    channelTitle?: string;
    description?: string;
    thumbnails?: {
      high?: { url?: string };
      medium?: { url?: string };
      default?: { url?: string };
    };
  };
};

type YouTubeVideosResponse = {
  items?: YouTubeVideoItem[];
};

type YouTubeVideoItem = {
  id?: string;
  contentDetails?: {
    duration?: string;
  };
  statistics?: {
    viewCount?: string;
  };
  status?: {
    embeddable?: boolean;
  };
};

export type SearchYouTubeBeatsParams = {
  q?: string;
  theme?: string;
  limit?: number;
};

export type SearchYouTubeBeatsResult = {
  tracks: TrackverseBeat[];
  nextPageToken: string | null;
  query: string;
};

export class YouTubeConfigError extends Error {
  statusCode = 503;
}

export class YouTubeApiError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public details?: unknown,
  ) {
    super(message);
  }
}

const colors = [
  "#8b3dff",
  "#d946ef",
  "#a855f7",
  "#6d28d9",
  "#7c3aed",
  "#ec4899",
  "#9333ea",
  "#c026d3",
];

export async function searchYouTubeBeats({
  q,
  theme,
  limit = 18,
}: SearchYouTubeBeatsParams): Promise<SearchYouTubeBeatsResult> {
  const query = buildSearchQuery(q, theme && theme !== "Tous" ? theme : "");
  const searchParams = new URLSearchParams({
    part: "snippet",
    type: "video",
    videoCategoryId: "10",
    videoEmbeddable: "true",
    safeSearch: "none",
    order: "relevance",
    maxResults: String(clamp(limit, 1, 25)),
    q: query,
    key: getYouTubeApiKey(),
  });

  const searchResult = await requestYouTubeJson<YouTubeSearchResponse>(
    `/search?${searchParams.toString()}`,
  );
  const searchItems = searchResult.items ?? [];
  const videoIds = searchItems
    .map((item) => item.id?.videoId)
    .filter((id): id is string => Boolean(id));

  if (videoIds.length === 0) {
    return {
      tracks: [],
      nextPageToken: searchResult.nextPageToken ?? null,
      query,
    };
  }

  const detailsParams = new URLSearchParams({
    part: "contentDetails,statistics,status",
    id: videoIds.join(","),
    key: getYouTubeApiKey(),
  });
  const detailsResult = await requestYouTubeJson<YouTubeVideosResponse>(
    `/videos?${detailsParams.toString()}`,
  );
  const detailsById = new Map(
    (detailsResult.items ?? []).map((item) => [item.id, item]),
  );

  return {
    tracks: searchItems
      .filter((item) => item.id?.videoId)
      .map((item) => mapYouTubeVideo(item, detailsById.get(item.id?.videoId)))
      .filter((track) => track.access === "embeddable"),
    nextPageToken: searchResult.nextPageToken ?? null,
    query,
  };
}

async function requestYouTubeJson<T>(path: string): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: {
      accept: "application/json; charset=utf-8",
    },
  });

  if (!response.ok) {
    const details = await readResponseBody(response);
    throw new YouTubeApiError("YouTube a refuse la requete.", response.status, details);
  }

  return response.json() as Promise<T>;
}

function getYouTubeApiKey() {
  const apiKey = process.env.YOUTUBE_API_KEY;

  if (!apiKey || isPlaceholder(apiKey)) {
    throw new YouTubeConfigError(
      "Cle YouTube absente. Ajoute YOUTUBE_API_KEY dans .env.local.",
    );
  }

  return apiKey;
}

function buildSearchQuery(query: string | undefined, theme: string | undefined) {
  const cleanQuery = query?.trim();
  const cleanTheme = theme?.trim();
  const base = "type beat instrumental prod";

  if (cleanQuery && cleanTheme) {
    return `${cleanQuery} ${cleanTheme} ${base}`;
  }

  if (cleanQuery) {
    return `${cleanQuery} ${base}`;
  }

  if (cleanTheme) {
    return `${cleanTheme} ${base}`;
  }

  return `rap ${base}`;
}

function mapYouTubeVideo(
  item: YouTubeSearchItem,
  details: YouTubeVideoItem | undefined,
): TrackverseBeat {
  const videoId = item.id?.videoId ?? "";
  const title = decodeHtml(item.snippet?.title ?? "Untitled beat");
  const description = item.snippet?.description ?? "";
  const tags = getTags(title, description);

  return {
    id: videoId,
    title,
    producer: decodeHtml(item.snippet?.channelTitle ?? "YouTube creator"),
    mood: tags[0] ?? "YouTube",
    bpm: extractBpm(`${title} ${description}`),
    key: "--",
    tags,
    plays: formatCount(Number(details?.statistics?.viewCount ?? 0)),
    price: "YouTube",
    source: "YouTube",
    color: colors[numberFromId(videoId) % colors.length],
    permalinkUrl: `https://www.youtube.com/watch?v=${videoId}`,
    artworkUrl:
      item.snippet?.thumbnails?.high?.url ??
      item.snippet?.thumbnails?.medium?.url ??
      item.snippet?.thumbnails?.default?.url ??
      null,
    durationMs: parseIsoDuration(details?.contentDetails?.duration),
    access: details?.status?.embeddable === false ? "not_embeddable" : "embeddable",
    mediaType: "youtube",
    videoId,
    embedUrl: `https://www.youtube.com/embed/${videoId}?playsinline=1&rel=0`,
  };
}

function getTags(title: string, description: string) {
  const text = `${title} ${description}`.toLowerCase();
  const candidates = [
    ["drill", "Drill"],
    ["trap", "Trap"],
    ["boom bap", "Boom bap"],
    ["boombap", "Boom bap"],
    ["melo", "Melo rap"],
    ["melodic", "Melo rap"],
    ["afro", "Afro trap"],
    ["rnb", "RnB"],
    ["r&b", "RnB"],
    ["piano", "Piano"],
    ["guitar", "Guitar"],
    ["free", "Free beat"],
    ["instrumental", "Instrumental"],
    ["type beat", "Type beat"],
  ];
  const matched = candidates
    .filter(([needle]) => text.includes(needle))
    .map(([, label]) => label);

  return [...new Set(matched.length > 0 ? matched : ["Type beat"])].slice(0, 6);
}

function extractBpm(text: string) {
  const match = text.match(/\b([6-9]\d|1[0-9]{2}|2[0-2]\d)\s?bpm\b/i);

  return match ? Number(match[1]) : null;
}

function parseIsoDuration(duration: string | undefined) {
  if (!duration) {
    return 0;
  }

  const match = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);

  if (!match) {
    return 0;
  }

  const [, hours = "0", minutes = "0", seconds = "0"] = match;

  return (
    Number(hours) * 60 * 60 * 1000 +
    Number(minutes) * 60 * 1000 +
    Number(seconds) * 1000
  );
}

function decodeHtml(value: string) {
  return value
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function numberFromId(id: string) {
  return id.split("").reduce((total, char) => total + char.charCodeAt(0), 0);
}

function formatCount(value: number) {
  if (!value) {
    return "0";
  }

  return new Intl.NumberFormat("en", {
    maximumFractionDigits: 1,
    notation: "compact",
  })
    .format(value)
    .toLowerCase();
}

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function isPlaceholder(value: string) {
  return /^(xxx|your_|ton_|la_vraie|\.{3})/i.test(value.trim());
}

async function readResponseBody(response: Response) {
  const text = await response.text();

  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}
