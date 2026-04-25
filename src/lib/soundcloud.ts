import type { TrackverseBeat } from "@/lib/beats";

const API_BASE_URL = "https://api.soundcloud.com";
const TOKEN_URL = "https://secure.soundcloud.com/oauth/token";
const TOKEN_REFRESH_MARGIN_MS = 60_000;

type TokenResponse = {
  access_token?: string;
  expires_in?: number;
  refresh_token?: string;
};

type TokenCache = {
  accessToken: string;
  expiresAt: number;
};

type SoundCloudUser = {
  username?: string;
  permalink_url?: string;
};

type SoundCloudTrack = {
  id?: number | string;
  title?: string;
  user?: SoundCloudUser;
  genre?: string;
  tag_list?: string;
  bpm?: number | null;
  key_signature?: string | null;
  playback_count?: number;
  permalink_url?: string;
  artwork_url?: string | null;
  duration?: number;
  access?: string;
  downloadable?: boolean;
  streamable?: boolean;
};

type SoundCloudCollectionResponse = {
  collection?: SoundCloudTrack[];
  next_href?: string | null;
};

type SoundCloudStreamPayload = {
  location?: string;
  url?: string;
  transcodings?: Array<{
    url?: string;
    format?: {
      protocol?: string;
    };
  }>;
  [key: string]: unknown;
};

export type SearchSoundCloudTracksParams = {
  q?: string;
  theme?: string;
  limit?: number;
  bpmFrom?: number;
  bpmTo?: number;
};

export type SearchSoundCloudTracksResult = {
  tracks: TrackverseBeat[];
  nextHref: string | null;
  query: string;
};

export class SoundCloudConfigError extends Error {
  statusCode = 503;
}

export class SoundCloudApiError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public details?: unknown,
  ) {
    super(message);
  }
}

let tokenCache: TokenCache | null = null;

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

export async function searchSoundCloudTracks({
  q,
  theme,
  limit = 24,
  bpmFrom,
  bpmTo,
}: SearchSoundCloudTracksParams): Promise<SearchSoundCloudTracksResult> {
  const cleanTheme = theme && theme !== "Tous" ? theme.trim() : "";
  const query = buildSearchQuery(q, cleanTheme);
  const params = new URLSearchParams({
    q: query,
    access: "playable",
    linked_partitioning: "true",
    limit: String(clamp(limit, 1, 50)),
  });

  if (Number.isFinite(bpmFrom)) {
    params.set("bpm[from]", String(bpmFrom));
  }

  if (Number.isFinite(bpmTo)) {
    params.set("bpm[to]", String(bpmTo));
  }

  const data = await requestSoundCloudJson<SoundCloudCollectionResponse | SoundCloudTrack[]>(
    `/tracks?${params.toString()}`,
  );
  const collection = Array.isArray(data) ? data : data.collection ?? [];

  return {
    tracks: collection
      .filter((track) => track.id && track.title)
      .map((track) => mapSoundCloudTrack(track)),
    nextHref: Array.isArray(data) ? null : data.next_href ?? null,
    query,
  };
}

export async function getSoundCloudStreamUrl(trackId: string): Promise<string> {
  const response = await requestSoundCloud(`/tracks/${encodeURIComponent(trackId)}/stream`, {
    headers: {
      accept: "*/*",
    },
    redirect: "manual",
  });

  if (response.status >= 300 && response.status < 400) {
    const location = response.headers.get("location");

    if (location) {
      return location;
    }
  }

  if (response.ok) {
    const contentType = response.headers.get("content-type") ?? "";

    if (contentType.includes("application/json")) {
      const payload = (await response.json()) as SoundCloudStreamPayload;
      const url = getUrlFromStreamPayload(payload);

      if (url) {
        return url;
      }
    }

    if (response.url && response.url !== `${API_BASE_URL}/tracks/${trackId}/stream`) {
      return response.url;
    }
  }

  const details = await readResponseBody(response);
  throw new SoundCloudApiError(
    "Impossible de recuperer le stream SoundCloud pour ce track.",
    response.status || 502,
    details,
  );
}

function getUrlFromStreamPayload(payload: SoundCloudStreamPayload) {
  const progressiveUrl = payload.transcodings?.find(
    (transcoding) => transcoding.format?.protocol === "progressive",
  )?.url;
  const firstTranscodingUrl = payload.transcodings?.find(
    (transcoding) => transcoding.url,
  )?.url;
  const firstDirectUrl = Object.values(payload).find(
    (value): value is string =>
      typeof value === "string" && value.startsWith("http"),
  );

  return payload.location ?? payload.url ?? progressiveUrl ?? firstTranscodingUrl ?? firstDirectUrl;
}

async function requestSoundCloudJson<T>(path: string): Promise<T> {
  const response = await requestSoundCloud(path);

  if (!response.ok) {
    const details = await readResponseBody(response);
    throw new SoundCloudApiError(
      "SoundCloud a refuse la requete.",
      response.status,
      details,
    );
  }

  return response.json() as Promise<T>;
}

async function requestSoundCloud(
  path: string,
  init: RequestInit = {},
): Promise<Response> {
  const token = await getSoundCloudAccessToken();
  const url = path.startsWith("http") ? path : `${API_BASE_URL}${path}`;
  const firstResponse = await fetchWithAuth(url, token, "OAuth", init);

  if (firstResponse.status !== 401) {
    return firstResponse;
  }

  return fetchWithAuth(url, token, "Bearer", init);
}

async function fetchWithAuth(
  url: string,
  token: string,
  scheme: "OAuth" | "Bearer",
  init: RequestInit,
) {
  const headers = new Headers(init.headers);

  if (!headers.has("accept")) {
    headers.set("accept", "application/json; charset=utf-8");
  }

  headers.set("Authorization", `${scheme} ${token}`);

  return fetch(url, {
    ...init,
    headers,
  });
}

async function getSoundCloudAccessToken(): Promise<string> {
  if (process.env.SOUNDCLOUD_ACCESS_TOKEN) {
    return process.env.SOUNDCLOUD_ACCESS_TOKEN;
  }

  if (tokenCache && tokenCache.expiresAt - TOKEN_REFRESH_MARGIN_MS > Date.now()) {
    return tokenCache.accessToken;
  }

  const clientId = process.env.SOUNDCLOUD_CLIENT_ID;
  const clientSecret = process.env.SOUNDCLOUD_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    throw new SoundCloudConfigError(
      "Credentials SoundCloud absents. Ajoute SOUNDCLOUD_CLIENT_ID et SOUNDCLOUD_CLIENT_SECRET dans .env.local.",
    );
  }

  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
  const response = await fetch(TOKEN_URL, {
    method: "POST",
    headers: {
      accept: "application/json; charset=utf-8",
      Authorization: `Basic ${credentials}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "client_credentials",
    }),
  });

  if (!response.ok) {
    const details = await readResponseBody(response);
    throw new SoundCloudApiError(
      "Impossible d'obtenir un token SoundCloud.",
      response.status,
      details,
    );
  }

  const payload = (await response.json()) as TokenResponse;

  if (!payload.access_token) {
    throw new SoundCloudApiError("Token SoundCloud invalide.", 502, payload);
  }

  tokenCache = {
    accessToken: payload.access_token,
    expiresAt: Date.now() + (payload.expires_in ?? 3600) * 1000,
  };

  return payload.access_token;
}

function buildSearchQuery(query: string | undefined, theme: string) {
  const cleanQuery = query?.trim();

  if (cleanQuery && theme) {
    return `${cleanQuery} ${theme}`;
  }

  if (cleanQuery) {
    return cleanQuery;
  }

  if (theme) {
    return `${theme} type beat instrumental`;
  }

  return "type beat instrumental";
}

function mapSoundCloudTrack(track: SoundCloudTrack): TrackverseBeat {
  const id = String(track.id);
  const tags = getTrackTags(track);
  const bpm = typeof track.bpm === "number" && Number.isFinite(track.bpm)
    ? Math.round(track.bpm)
    : null;
  const artworkUrl = track.artwork_url
    ? track.artwork_url.replace("large", "t500x500")
    : null;

  return {
    id,
    title: track.title ?? "Untitled",
    producer: track.user?.username ?? "SoundCloud creator",
    mood: track.genre || tags[0] || "SoundCloud",
    bpm,
    key: track.key_signature || "--",
    tags,
    plays: formatCount(track.playback_count),
    price: track.downloadable ? "Telechargeable" : "Stream",
    source: "SoundCloud",
    color: colors[numberFromId(id) % colors.length],
    audioUrl: `/api/soundcloud/tracks/${encodeURIComponent(id)}/stream`,
    permalinkUrl: track.permalink_url ?? "https://soundcloud.com",
    artworkUrl,
    durationMs: track.duration ?? 0,
    access: track.access ?? (track.streamable ? "playable" : "unknown"),
    mediaType: "audio",
  };
}

function getTrackTags(track: SoundCloudTrack) {
  const rawTags = track.tag_list?.match(/"[^"]+"|\S+/g) ?? [];
  const normalizedTags = rawTags.map((tag) => tag.replace(/^"|"$/g, ""));
  const tags = [track.genre, ...normalizedTags]
    .filter((tag): tag is string => Boolean(tag))
    .map((tag) => tag.trim())
    .filter(Boolean);

  return [...new Set(tags)].slice(0, 6);
}

function numberFromId(id: string) {
  return id.split("").reduce((total, char) => total + char.charCodeAt(0), 0);
}

function formatCount(value: number | undefined) {
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

async function readResponseBody(response: Response) {
  const text = await response.text();

  try {
    return JSON.parse(text) as unknown;
  } catch {
    return text;
  }
}
