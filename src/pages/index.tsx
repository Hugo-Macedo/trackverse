import Head from "next/head";
import localFont from "next/font/local";
import {
  ChangeEvent,
  CSSProperties,
  useEffect,
  useReducer,
  useState,
} from "react";
import type { TrackverseBeat } from "@/lib/beats";
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

type SearchState = {
  beats: TrackverseBeat[];
  selectedBeatId: string | null;
  isLoading: boolean;
  searchError: string | null;
};

type SearchAction =
  | { type: "start" }
  | { type: "success"; tracks: TrackverseBeat[] }
  | { type: "error"; message: string }
  | { type: "select"; id: string };

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
  const [{ beats, selectedBeatId, isLoading, searchError }, dispatchSearch] =
    useReducer(searchReducer, {
      beats: [],
      selectedBeatId: null,
      isLoading: true,
      searchError: null,
    });
  const [likedBeatIds, setLikedBeatIds] = useState<string[]>([]);
  const [playlistBeatIds, setPlaylistBeatIds] = useState<string[]>([]);
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
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

    dispatchSearch({ type: "start" });

    fetch(`/api/youtube/search?${params.toString()}`, {
      signal: controller.signal,
    })
      .then(async (response) => {
        const payload = (await response.json()) as SearchResponse;

        if (!response.ok) {
          throw new Error(payload.error ?? "Recherche YouTube impossible.");
        }

        return payload.tracks ?? [];
      })
      .then((tracks) => {
        dispatchSearch({ type: "success", tracks });
      })
      .catch((error: Error) => {
        if (controller.signal.aborted) {
          return;
        }

        dispatchSearch({ type: "error", message: error.message });
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
              <p className={styles.kicker}>youtube beat search</p>
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
                    onClick={() => dispatchSearch({ type: "select", id: beat.id })}
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
                  <p>{searchError ?? "Aucune prod trouvee sur YouTube"}</p>
                  {searchError && (
                    <small>
                      Verifie ta cle YouTube dans `.env.local`, puis
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
                  {selectedBeat.mediaType === "youtube" && selectedBeat.embedUrl ? (
                    <iframe
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                      allowFullScreen
                      className={styles.youtubePlayer}
                      key={selectedBeat.id}
                      src={selectedBeat.embedUrl}
                      title={selectedBeat.title}
                    />
                  ) : (
                    <audio
                      className={styles.audio}
                      controls
                      key={selectedBeat.id}
                      preload="none"
                    >
                      <source src={selectedBeat.audioUrl} />
                    </audio>
                  )}
                  <a
                    className={styles.sourceLink}
                    href={selectedBeat.permalinkUrl}
                    rel="noreferrer"
                    target="_blank"
                  >
                    Voir la prod sur {selectedBeat.source}
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

function searchReducer(state: SearchState, action: SearchAction): SearchState {
  switch (action.type) {
    case "start":
      return {
        ...state,
        isLoading: true,
        searchError: null,
      };
    case "success":
      return {
        beats: action.tracks,
        selectedBeatId: action.tracks.some(
          (track) => track.id === state.selectedBeatId,
        )
          ? state.selectedBeatId
          : action.tracks[0]?.id ?? null,
        isLoading: false,
        searchError: null,
      };
    case "error":
      return {
        beats: [],
        selectedBeatId: null,
        isLoading: false,
        searchError: action.message,
      };
    case "select":
      return {
        ...state,
        selectedBeatId: action.id,
      };
    default:
      return state;
  }
}
