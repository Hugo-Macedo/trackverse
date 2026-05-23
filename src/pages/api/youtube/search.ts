import type { NextApiRequest, NextApiResponse } from "next";
import {
  searchYouTubeBeats,
  YouTubeApiError,
  YouTubeConfigError,
} from "@/lib/youtube";

type SearchResponse = {
  tracks?: Awaited<ReturnType<typeof searchYouTubeBeats>>["tracks"];
  nextPageToken?: string | null;
  meta?: {
    source: "YouTube";
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
  const limit = getNumberQuery(req.query.limit) ?? 18;

  try {
    const result = await searchYouTubeBeats({
      q,
      theme,
      limit,
    });

    res.setHeader("Cache-Control", "s-maxage=180, stale-while-revalidate=600");
    res.status(200).json({
      tracks: result.tracks,
      nextPageToken: result.nextPageToken,
      meta: {
        source: "YouTube",
        query: result.query,
        theme,
      },
    });
  } catch (error) {
    handleYouTubeError(error, res);
  }
}

function handleYouTubeError(error: unknown, res: NextApiResponse<SearchResponse>) {
  if (error instanceof YouTubeConfigError) {
    res.status(error.statusCode).json({ error: error.message });
    return;
  }

  if (error instanceof YouTubeApiError) {
    res.status(error.statusCode).json({
      error: error.message,
      details: error.details,
    });
    return;
  }

  res.status(500).json({ error: "Erreur YouTube inconnue." });
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
