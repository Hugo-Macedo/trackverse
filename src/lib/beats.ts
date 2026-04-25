export type TrackverseSource = "SoundCloud" | "YouTube";

export type TrackverseBeat = {
  id: string;
  title: string;
  producer: string;
  mood: string;
  bpm: number | null;
  key: string;
  tags: string[];
  plays: string;
  price: string;
  source: TrackverseSource;
  color: string;
  permalinkUrl: string;
  artworkUrl: string | null;
  durationMs: number;
  access: string;
  mediaType: "audio" | "youtube";
  audioUrl?: string;
  videoId?: string;
  embedUrl?: string;
};
