import Head from "next/head";
import localFont from "next/font/local";
import { ChangeEvent, CSSProperties, useEffect, useState } from "react";
import type { TrackverseBeat } from "@/lib/soundcloud";
import styles from "@/styles/Home.module.css";

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
  weight: "100 900",
});

const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
  weight: "100 900",
});

type SearchResponse = {
  tracks?: TrackverseBeat[];
  error?: string;
};

const themes = [
  "Tous",
  "Trap sombre",
  "Melo rap",
  "Drill",
  "Boom bap",
  "Afro trap",
  "Trap bounce",
  "RnB",
];

export default function Home() {
  const [activeTheme, setActiveTheme] = useState("Tous");
  const [selectedBeatId, setSelectedBeatId] = useState<string | null>(null);
  const [likedBeatIds, setLikedBeatIds] = useState<string[]>([]);
  const [playlistBeatIds, setPlaylistBeatIds] = useState<string[]>([]);
  const [beats, setBeats] = useState<TrackverseBeat[]>([]);
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [lyrics, setLyrics] = useState(
    "J'arrive dans le booth, lumiere violette sur la vitre...\n",
  );
  const [artistMode, setArtistMode] = useState(true);
  const [isRecording, setIsRecording] = useState(false);

  const selectedBeat =
    beats.find((beat) => beat.id === selectedBeatId) ?? beats[0] ?? null;

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setDebouncedQuery(query.trim());
    }, 350);

    return () => window.clearTimeout(timeoutId);
  }, [query]);

  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams({
      limit: "24",
      theme: activeTheme,
    });

    if (debouncedQuery) {
      params.set("q", debouncedQuery);
    }

    setIsLoading(true);
    setSearchError(null);

    fetch(`/api/soundcloud/search?${params.toString()}`, {
      signal: controller.signal,
    })
      .then(async (response) => {
        const payload = (await response.json()) as SearchResponse;

        if (!response.ok) {
          throw new Error(payload.error ?? "Recherche SoundCloud impossible.");
        }

        return payload.tracks ?? [];
      })
      .then((tracks) => {
        setBeats(tracks);
        setSelectedBeatId((currentId) =>
          tracks.some((track) => track.id === currentId)
            ? currentId
            : tracks[0]?.id ?? null,
        );
      })
      .catch((error: Error) => {
        if (controller.signal.aborted) {
          return;
        }

        setBeats([]);
        setSelectedBeatId(null);
        setSearchError(error.message);
      })
      .finally(() => {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      });

    return () => controller.abort();
  }, [activeTheme, debouncedQuery]);

  const toggleId = (list: string[], id: string) =>
    list.includes(id) ? list.filter((item) => item !== id) : [...list, id];

  const handleLyricsChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
    setLyrics(event.target.value);
  };

  return (
    <>
      <Head>
        <title>trackverse | Studio mobile pour artistes</title>
        <meta
          name="description"
          content="Trackverse connecte artistes, beatmakers et ingenieurs son autour de prods, playlists, textes et sessions."
        />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <meta name="theme-color" content="#05040a" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-title" content="trackverse" />
        <link rel="manifest" href="/manifest.webmanifest" />
        <link rel="icon" href="/icons/trackverse-icon.svg" type="image/svg+xml" />
        <link rel="apple-touch-icon" href="/icons/icon-192.png" />
      </Head>
      <div className={`${styles.page} ${geistSans.variable} ${geistMono.variable}`}>
        <header className={styles.topbar}>
          <a className={styles.logo} href="#discover" aria-label="Accueil trackverse">
            <span>track</span>verse
          </a>
          <div className={styles.roleSwitch} aria-label="Changer de role">
            <button
              className={artistMode ? styles.activeRole : ""}
              onClick={() => setArtistMode(true)}
              type="button"
            >
              Artiste
            </button>
            <button
              className={!artistMode ? styles.activeRole : ""}
              onClick={() => setArtistMode(false)}
              type="button"
            >
              Inge son
            </button>
          </div>
        </header>

        <main className={styles.shell}>
          <section className={styles.searchPanel} id="discover">
            <div>
              <p className={styles.kicker}>soundcloud live search</p>
              <h1>Trouve ta prod</h1>
            </div>
            <label className={styles.searchBox} htmlFor="beat-search">
              <span>⌕</span>
              <input
                autoComplete="off"
                id="beat-search"
                onChange={(event) => setQuery(event.target.value)}
                placeholder="drill, piano, 140 bpm..."
                type="search"
                value={query}
              />
            </label>
          </section>

          <section className={styles.themeRail} aria-label="Themes de recherche">
            {themes.map((theme) => (
              <button
                className={activeTheme === theme ? styles.activeTheme : ""}
                key={theme}
                onClick={() => setActiveTheme(theme)}
                type="button"
              >
                {theme}
              </button>
            ))}
          </section>

          <section className={styles.workspace}>
            <section className={styles.catalogue} aria-label="Catalogue de prods">
              <div className={styles.listHeader}>
                <p>{isLoading ? "Recherche..." : `${beats.length} prods`}</p>
                <span>{likedBeatIds.length} likes</span>
              </div>

              {beats.map((beat) => (
                <article
                  className={`${styles.beatCard} ${
                    selectedBeat?.id === beat.id ? styles.selectedBeat : ""
                  }`}
                  key={beat.id}
                >
                  <button
                    className={styles.beatMain}
                    onClick={() => setSelectedBeatId(beat.id)}
                    type="button"
                  >
                    <span
                      className={styles.cover}
                      style={{ "--cover-color": beat.color } as CSSProperties}
                    >
                      {beat.bpm ?? "--"}
                    </span>
                    <span className={styles.beatText}>
                      <strong>{beat.title}</strong>
                      <small>
                        {beat.producer} · {beat.mood}
                      </small>
                      <span className={styles.mobileTags}>
                        {beat.tags.slice(0, 3).map((tag) => (
                          <em key={tag}>#{tag}</em>
                        ))}
                      </span>
                    </span>
                  </button>
                  <div className={styles.beatMeta}>
                    <span>{beat.key}</span>
                    <span>{beat.plays}</span>
                    <span>{beat.source}</span>
                  </div>
                  <div className={styles.beatActions}>
                    <button
                      className={
                        likedBeatIds.includes(beat.id) ? styles.actionActive : ""
                      }
                      onClick={() => setLikedBeatIds(toggleId(likedBeatIds, beat.id))}
                      type="button"
                      aria-label={`Liker ${beat.title}`}
                    >
                      ♥
                    </button>
                    <button
                      className={
                        playlistBeatIds.includes(beat.id) ? styles.actionActive : ""
                      }
                      onClick={() =>
                        setPlaylistBeatIds(toggleId(playlistBeatIds, beat.id))
                      }
                      type="button"
                      aria-label={`Ajouter ${beat.title} a une playlist`}
                    >
                      +
                    </button>
                    <span>{beat.price}</span>
                  </div>
                </article>
              ))}

              {!isLoading && beats.length === 0 && (
                <div className={styles.emptyState}>
                  <p>{searchError ?? "Aucun son trouve sur SoundCloud"}</p>
                  {searchError && (
                    <small>
                      Verifie tes variables SoundCloud dans `.env.local`, puis
                      relance `npm run dev`.
                    </small>
                  )}
                  <button
                    onClick={() => {
                      setActiveTheme("Tous");
                      setQuery("");
                    }}
                    type="button"
                  >
                    Reset
                  </button>
                </div>
              )}
            </section>

            <section className={styles.studioPanel}>
              {selectedBeat ? (
                <>
                  <div className={styles.player}>
                    <div className={styles.vinyl} aria-hidden="true">
                      <span />
                    </div>
                    <div>
                      <p>Lecture</p>
                      <h2>{selectedBeat.title}</h2>
                      <span>
                        {selectedBeat.producer} · {selectedBeat.bpm ?? "--"} BPM ·{" "}
                        {selectedBeat.key}
                      </span>
                    </div>
                  </div>
                  <audio
                    className={styles.audio}
                    controls
                    key={selectedBeat.id}
                    preload="none"
                  >
                    <source src={selectedBeat.audioUrl} />
                  </audio>
                  <a
                    className={styles.sourceLink}
                    href={selectedBeat.permalinkUrl}
                    rel="noreferrer"
                    target="_blank"
                  >
                    Ecouter et crediter sur SoundCloud
                  </a>
                  <div className={styles.tags}>
                    {selectedBeat.tags.map((tag) => (
                      <span key={tag}>#{tag}</span>
                    ))}
                  </div>
                </>
              ) : (
                <div className={styles.emptyPlayer}>
                  <p>{isLoading ? "Connexion SoundCloud..." : "Choisis une prod"}</p>
                </div>
              )}

              <div className={styles.writer} id="write">
                <div className={styles.panelHeader}>
                  <p>Texte</p>
                  <span>{lyrics.trim().split(/\s+/).filter(Boolean).length} mots</span>
                </div>
                <textarea
                  aria-label="Texte de l'artiste"
                  onChange={handleLyricsChange}
                  placeholder="Pose ton couplet ici..."
                  value={lyrics}
                />
              </div>

              <div className={styles.session} id="session">
                <div>
                  <p>{artistMode ? "Session artiste" : "Session inge son"}</p>
                  <span>{playlistBeatIds.length} sons en playlist</span>
                </div>
                <button
                  className={isRecording ? styles.recording : ""}
                  onClick={() => setIsRecording(!isRecording)}
                  type="button"
                >
                  {isRecording ? "Stop" : "REC"}
                </button>
              </div>
            </section>
          </section>
        </main>

        <nav className={styles.bottomNav} aria-label="Navigation mobile">
          <a href="#discover">Search</a>
          <a href="#write">Write</a>
          <a href="#session">REC</a>
        </nav>
      </div>
    </>
  );
}
