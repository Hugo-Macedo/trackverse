import type { NextApiRequest, NextApiResponse } from "next";
import {
  searchSoundCloudTracks,
  SoundCloudApiError,
  SoundCloudConfigError,
} from "@/lib/soundcloud";

type SearchResponse = {
  tracks?: Awaited<ReturnType<typeof searchSoundCloudTracks>>["tracks"];
  nextHref?: string | null;
  meta?: {
    source: "SoundCloud";
    query: string;
    theme: string;
  };
  error?: string;
  details?: unknown;
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<SearchResponse>,
) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const theme = getStringQuery(req.query.theme) ?? "Tous";
  const q = getStringQuery(req.query.q);
  const limit = getNumberQuery(req.query.limit) ?? 24;
  const bpmFrom = getNumberQuery(req.query.bpmFrom);
  const bpmTo = getNumberQuery(req.query.bpmTo);

  try {
    const result = await searchSoundCloudTracks({
      q,
      theme,
      limit,
      bpmFrom,
      bpmTo,
    });

    res.setHeader("Cache-Control", "s-maxage=120, stale-while-revalidate=300");
    res.status(200).json({
      tracks: result.tracks,
      nextHref: result.nextHref,
      meta: {
        source: "SoundCloud",
        query: result.query,
        theme,
      },
    });
  } catch (error) {
    handleSoundCloudError(error, res);
  }
}

function handleSoundCloudError(
  error: unknown,
  res: NextApiResponse<SearchResponse>,
) {
  if (error instanceof SoundCloudConfigError) {
    res.status(error.statusCode).json({ error: error.message });
    return;
  }

  if (error instanceof SoundCloudApiError) {
    res.status(error.statusCode).json({
      error: error.message,
      details: error.details,
    });
    return;
  }

  res.status(500).json({ error: "Erreur SoundCloud inconnue." });
}

function getStringQuery(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function getNumberQuery(value: string | string[] | undefined) {
  const rawValue = getStringQuery(value);

  if (!rawValue) {
    return undefined;
  }

  const numberValue = Number(rawValue);

  return Number.isFinite(numberValue) ? numberValue : undefined;
}
