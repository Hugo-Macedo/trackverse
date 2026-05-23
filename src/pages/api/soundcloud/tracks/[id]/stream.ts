import type { NextApiRequest, NextApiResponse } from "next";
import {
  getSoundCloudStreamUrl,
  SoundCloudApiError,
  SoundCloudConfigError,
} from "@/lib/soundcloud";

type StreamErrorResponse = {
  error: string;
  details?: unknown;
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<StreamErrorResponse>,
) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const trackId = getStringQuery(req.query.id);

  if (!trackId) {
    res.status(400).json({ error: "Missing SoundCloud track id." });
    return;
  }

  try {
    const streamUrl = await getSoundCloudStreamUrl(trackId);

    res.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate=600");
    res.redirect(302, streamUrl);
  } catch (error) {
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
}

function getStringQuery(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}
