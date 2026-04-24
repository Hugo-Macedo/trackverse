// Next.js API route support: https://nextjs.org/docs/api-routes/introduction
import type { NextApiRequest, NextApiResponse } from "next";

type Data = {
  name: string;
  status: string;
  nextIntegrations: string[];
};

export default function handler(
  req: NextApiRequest,
  res: NextApiResponse<Data>,
) {
  res.status(200).json({
    name: "trackverse",
    status: "MVP mobile-first PWA avec endpoints SoundCloud",
    nextIntegrations: ["auth roles", "playlists persistantes", "sessions audio"],
  });
}
