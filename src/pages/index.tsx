import Head from "next/head";
import localFont from "next/font/local";
import {
  ChangeEvent,
  CSSProperties,
  FormEvent,
  useEffect,
  useMemo,
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

const STORAGE_USERS_KEY = "trackverse.users.v1";
const STORAGE_SESSION_KEY = "trackverse.session.v1";
const STORAGE_LIBRARY_KEY = "trackverse.library.v1";

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

type AppTab = "home" | "library" | "profile";
type AuthMode = "signup" | "login";
type UserRole = "artist" | "creator";

type TrackverseUser = {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  soundCloudHandle: string;
  soundCloudConnected: boolean;
  createdAt: string;
};

type Playlist = {
  id: string;
  name: string;
  trackIds: string[];
  createdAt: string;
};

type LibraryState = {
  likedBeatIds: string[];
  savedBeatIds: string[];
  playlists: Playlist[];
  drafts: Record<string, string>;
  beatCache: Record<string, TrackverseBeat>;
};

const roleOptions: Array<{
  value: UserRole;
  label: string;
  description: string;
}> = [
  {
    value: "artist",
    label: "Artiste",
    description: "Trouver des prods, ecrire et garder tes sessions.",
  },
  {
    value: "creator",
    label: "Createur son",
    description: "Beatmaker, producteur ou inge son qui depose ses prods.",
  },
];

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
  const [hasHydrated, setHasHydrated] = useState(false);
  const [users, setUsers] = useState<TrackverseUser[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [authMode, setAuthMode] = useState<AuthMode>("signup");
  const [authMessage, setAuthMessage] = useState<string | null>(null);
  const [signupName, setSignupName] = useState("");
  const [signupEmail, setSignupEmail] = useState("");
  const [signupRole, setSignupRole] = useState<UserRole>("artist");
  const [loginEmail, setLoginEmail] = useState("");
  const [activeTab, setActiveTab] = useState<AppTab>("home");
  const [activeTheme, setActiveTheme] = useState("Tous");
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [newPlaylistName, setNewPlaylistName] = useState("");
  const [openPlaylistId, setOpenPlaylistId] = useState<string | null>(null);
  const [playlistTargetId, setPlaylistTargetId] = useState("");
  const [saveStatus, setSaveStatus] = useState<string | null>(null);
  const [library, setLibrary] = useState<LibraryState>(createEmptyLibrary);
  const [{ beats, selectedBeatId, isLoading, searchError }, dispatchSearch] =
    useReducer(searchReducer, {
      beats: [],
      selectedBeatId: null,
      isLoading: false,
      searchError: null,
    });

  const currentUser = useMemo(
    () => users.find((user) => user.id === currentUserId) ?? null,
    [currentUserId, users],
  );

  const selectedBeat =
    (selectedBeatId
      ? beats.find((beat) => beat.id === selectedBeatId) ??
        library.beatCache[selectedBeatId]
      : null) ??
    beats[0] ??
    null;

  const selectedDraft = selectedBeat
    ? library.drafts[selectedBeat.id] ?? createDraftIntro(selectedBeat)
    : "";

  const likedBeats = getBeatList(library.likedBeatIds, library.beatCache);
  const savedBeats = getBeatList(library.savedBeatIds, library.beatCache);
  const selectedPlaylist =
    library.playlists.find((playlist) => playlist.id === openPlaylistId) ??
    library.playlists[0] ??
    null;
  const selectedPlaylistBeats = selectedPlaylist
    ? getBeatList(selectedPlaylist.trackIds, library.beatCache)
    : [];
  const draftCount = Object.values(library.drafts).filter((draft) =>
    draft.trim(),
  ).length;

  useEffect(() => {
    let isMounted = true;

    window.requestAnimationFrame(() => {
      if (!isMounted) {
        return;
      }

      const storedUsers = readStoredValue<TrackverseUser[]>(STORAGE_USERS_KEY, []);
      const storedLibrary = normalizeLibrary(
        readStoredValue<Partial<LibraryState>>(STORAGE_LIBRARY_KEY, {}),
      );
      const storedSession = window.localStorage.getItem(STORAGE_SESSION_KEY);

      setUsers(storedUsers);
      setLibrary(storedLibrary);

      if (storedSession && storedUsers.some((user) => user.id === storedSession)) {
        setCurrentUserId(storedSession);
      }

      setHasHydrated(true);
    });

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!hasHydrated) {
      return;
    }

    window.localStorage.setItem(STORAGE_USERS_KEY, JSON.stringify(users));
  }, [hasHydrated, users]);

  useEffect(() => {
    if (!hasHydrated) {
      return;
    }

    if (currentUserId) {
      window.localStorage.setItem(STORAGE_SESSION_KEY, currentUserId);
      return;
    }

    window.localStorage.removeItem(STORAGE_SESSION_KEY);
  }, [currentUserId, hasHydrated]);

  useEffect(() => {
    if (!hasHydrated) {
      return;
    }

    window.localStorage.setItem(STORAGE_LIBRARY_KEY, JSON.stringify(library));
  }, [hasHydrated, library]);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setDebouncedQuery(query.trim());
    }, 350);

    return () => window.clearTimeout(timeoutId);
  }, [query]);

  useEffect(() => {
    if (!currentUser) {
      return;
    }

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
        setLibrary((current) => cacheTracks(current, tracks));
      })
      .catch((error: Error) => {
        if (controller.signal.aborted) {
          return;
        }

        dispatchSearch({ type: "error", message: error.message });
      });

    return () => controller.abort();
  }, [activeTheme, currentUser, debouncedQuery]);

  const handleSignup = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const name = signupName.trim();
    const email = normalizeEmail(signupEmail);

    if (!name || !email) {
      setAuthMessage("Ajoute un nom et un email pour creer ton espace.");
      return;
    }

    if (users.some((user) => user.email === email)) {
      setAuthMessage("Ce compte existe deja. Passe en connexion.");
      setAuthMode("login");
      setLoginEmail(email);
      return;
    }

    const newUser: TrackverseUser = {
      id: createId("user"),
      name,
      email,
      role: signupRole,
      soundCloudHandle: "",
      soundCloudConnected: false,
      createdAt: new Date().toISOString(),
    };

    setUsers((current) => [...current, newUser]);
    setCurrentUserId(newUser.id);
    setActiveTab("home");
    setAuthMessage(null);
  };

  const handleLogin = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const email = normalizeEmail(loginEmail);
    const user = users.find((storedUser) => storedUser.email === email);

    if (!user) {
      setAuthMessage("Compte introuvable en local. Cree un espace d'abord.");
      setAuthMode("signup");
      setSignupEmail(email);
      return;
    }

    setCurrentUserId(user.id);
    setActiveTab("home");
    setAuthMessage(null);
  };

  const updateCurrentUser = (
    partialUser: Partial<Omit<TrackverseUser, "id" | "createdAt">>,
  ) => {
    if (!currentUser) {
      return;
    }

    setUsers((current) =>
      current.map((user) =>
        user.id === currentUser.id ? { ...user, ...partialUser } : user,
      ),
    );
  };

  const toggleLike = (beat: TrackverseBeat) => {
    setLibrary((current) => ({
      ...cacheTracks(current, [beat]),
      likedBeatIds: toggleId(current.likedBeatIds, beat.id),
    }));
  };

  const toggleSave = (beat: TrackverseBeat) => {
    setLibrary((current) => ({
      ...cacheTracks(current, [beat]),
      savedBeatIds: toggleId(current.savedBeatIds, beat.id),
    }));
  };

  const createPlaylist = (name: string) => {
    const trimmedName = name.trim();

    if (!trimmedName) {
      return null;
    }

    const playlist: Playlist = {
      id: createId("playlist"),
      name: trimmedName,
      trackIds: [],
      createdAt: new Date().toISOString(),
    };

    setLibrary((current) => ({
      ...current,
      playlists: [playlist, ...current.playlists],
    }));
    setOpenPlaylistId(playlist.id);
    setPlaylistTargetId(playlist.id);
    setNewPlaylistName("");

    return playlist.id;
  };

  const handleCreatePlaylist = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    createPlaylist(newPlaylistName);
  };

  const addBeatToPlaylist = (beat: TrackverseBeat, playlistId: string) => {
    setLibrary((current) => {
      const cached = cacheTracks(current, [beat]);

      return {
        ...cached,
        playlists: cached.playlists.map((playlist) =>
          playlist.id === playlistId
            ? {
                ...playlist,
                trackIds: playlist.trackIds.includes(beat.id)
                  ? playlist.trackIds
                  : [beat.id, ...playlist.trackIds],
              }
            : playlist,
        ),
      };
    });
  };

  const addSelectedBeatToPlaylist = () => {
    if (!selectedBeat) {
      return;
    }

    let targetId = playlistTargetId || library.playlists[0]?.id || null;

    if (!targetId) {
      targetId = createPlaylist("Premiere playlist");
    }

    if (!targetId) {
      return;
    }

    addBeatToPlaylist(selectedBeat, targetId);
    setOpenPlaylistId(targetId);
    setSaveStatus("Prod ajoutee a la playlist.");
  };

  const removeBeatFromPlaylist = (playlistId: string, beatId: string) => {
    setLibrary((current) => ({
      ...current,
      playlists: current.playlists.map((playlist) =>
        playlist.id === playlistId
          ? {
              ...playlist,
              trackIds: playlist.trackIds.filter((trackId) => trackId !== beatId),
            }
          : playlist,
      ),
    }));
  };

  const handleDraftChange = (event: ChangeEvent<HTMLTextAreaElement>) => {
    if (!selectedBeat) {
      return;
    }

    const value = event.target.value;

    setLibrary((current) => ({
      ...cacheTracks(current, [selectedBeat]),
      drafts: {
        ...current.drafts,
        [selectedBeat.id]: value,
      },
    }));
  };

  const saveCurrentText = () => {
    if (!selectedBeat) {
      return;
    }

    setLibrary((current) => ({
      ...cacheTracks(current, [selectedBeat]),
      drafts: {
        ...current.drafts,
        [selectedBeat.id]: selectedDraft,
      },
    }));
    setSaveStatus("Texte sauvegarde dans ta bibliotheque.");
  };

  const exportCurrentText = () => {
    if (!selectedBeat || !selectedDraft.trim()) {
      setSaveStatus("Ajoute du texte avant l'export.");
      return;
    }

    const fileName = `${slugify(selectedBeat.title)}-trackverse.txt`;
    const textFile = [
      `Trackverse session`,
      `Prod: ${selectedBeat.title}`,
      `Source: ${selectedBeat.permalinkUrl}`,
      "",
      selectedDraft,
    ].join("\n");
    const blob = new Blob([textFile], { type: "text/plain;charset=utf-8" });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");

    link.href = url;
    link.download = fileName;
    link.click();
    window.URL.revokeObjectURL(url);
    setSaveStatus("Fichier texte exporte.");
  };

  const openBeatInStudio = (beat: TrackverseBeat) => {
    setLibrary((current) => cacheTracks(current, [beat]));
    dispatchSearch({ type: "select", id: beat.id });
    setActiveTab("home");
  };

  const resetSearch = () => {
    setActiveTheme("Tous");
    setQuery("");
  };

  const showAuth = (mode: AuthMode) => {
    setAuthMode(mode);
    setAuthMessage(null);
    window.requestAnimationFrame(() => {
      document.getElementById("auth")?.scrollIntoView({ behavior: "smooth" });
    });
  };

  return (
    <>
      <Head>
        <title>trackverse | Studio mobile pour artistes</title>
        <meta
          name="description"
          content="Trackverse connecte artistes et createurs son autour de prods, playlists, textes et sessions."
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
          <button
            className={styles.logo}
            onClick={() => (currentUser ? setActiveTab("home") : showAuth("signup"))}
            type="button"
          >
            <span>track</span>verse
          </button>

          {currentUser ? (
            <div className={styles.topbarActions}>
              <span className={styles.roleBadge}>{getRoleLabel(currentUser.role)}</span>
              <button
                className={styles.linkButton}
                onClick={() => setActiveTab("profile")}
                type="button"
              >
                Profil
              </button>
            </div>
          ) : (
            <div className={styles.topbarActions}>
              <button
                className={styles.linkButton}
                onClick={() => showAuth("login")}
                type="button"
              >
                Connexion
              </button>
              <button
                className={styles.primaryButton}
                onClick={() => showAuth("signup")}
                type="button"
              >
                Inscription
              </button>
            </div>
          )}
        </header>

        {!currentUser ? (
          <main className={styles.landingShell}>
            <section className={styles.hero}>
              <div className={styles.heroCopy}>
                <p className={styles.kicker}>studio mobile pour sessions rap</p>
                <h1>La prod, le texte et la session dans la meme poche.</h1>
                <p>
                  Trackverse aide les artistes a trouver une prod, ecrire dessus,
                  ranger leurs coups de coeur et garder chaque texte lie au son.
                </p>
                <div className={styles.heroActions}>
                  <button
                    className={styles.primaryButton}
                    onClick={() => showAuth("signup")}
                    type="button"
                  >
                    Creer mon espace
                  </button>
                  <button
                    className={styles.secondaryButton}
                    onClick={() => showAuth("login")}
                    type="button"
                  >
                    Compte existant
                  </button>
                </div>
              </div>

              <div className={styles.phonePreview} aria-label="Apercu trackverse">
                <div className={styles.phoneHeader}>
                  <span />
                  <strong>Session nuit</strong>
                  <small>142 bpm</small>
                </div>
                <div className={styles.phoneScreen}>
                  <div className={styles.miniBeat}>
                    <span>Drill</span>
                    <strong>Piano sombre type beat</strong>
                    <small>YouTube search</small>
                  </div>
                  <div className={styles.miniLine} />
                  <div className={styles.miniLine} />
                  <div className={styles.miniLine} />
                  <p>
                    Je pose dans le booth, lumiere violette sur la vitre...
                  </p>
                </div>
              </div>
            </section>

            <section className={styles.featureGrid} aria-label="Fonctionnalites">
              <article className={styles.featureCard}>
                <span>01</span>
                <h2>Recherche de prods</h2>
                <p>Filtre par style, theme ou mot-cle, puis ecoute avec le player.</p>
              </article>
              <article className={styles.featureCard}>
                <span>02</span>
                <h2>Ecriture liee a la prod</h2>
                <p>Chaque texte reste accroche au son selectionne dans ton espace.</p>
              </article>
              <article className={styles.featureCard}>
                <span>03</span>
                <h2>Likes et playlists</h2>
                <p>Range les prods enregistrees, aimees et organisees par projet.</p>
              </article>
              <article className={styles.featureCard}>
                <span>04</span>
                <h2>Profil createur son</h2>
                <p>Un role clair pour beatmakers, producteurs et ingenieurs son.</p>
              </article>
            </section>

            <section className={styles.authSection} id="auth">
              <div>
                <p className={styles.kicker}>acces local mvp</p>
                <h2>Entre dans ton espace Trackverse</h2>
                <p>
                  Pour le moment, ton compte et ta bibliotheque sont sauvegardes
                  dans ce navigateur. La connexion SoundCloud arrive ensuite via
                  OAuth.
                </p>
              </div>

              <form
                className={styles.authPanel}
                onSubmit={authMode === "signup" ? handleSignup : handleLogin}
              >
                <div className={styles.authTabs} aria-label="Mode d'acces">
                  <button
                    className={authMode === "signup" ? styles.activeTabButton : ""}
                    onClick={() => setAuthMode("signup")}
                    type="button"
                  >
                    Inscription
                  </button>
                  <button
                    className={authMode === "login" ? styles.activeTabButton : ""}
                    onClick={() => setAuthMode("login")}
                    type="button"
                  >
                    Connexion
                  </button>
                </div>

                {authMode === "signup" ? (
                  <>
                    <label className={styles.field}>
                      <span>Nom public</span>
                      <input
                        autoComplete="name"
                        onChange={(event) => setSignupName(event.target.value)}
                        placeholder="ex: Hugo"
                        type="text"
                        value={signupName}
                      />
                    </label>
                    <label className={styles.field}>
                      <span>Email</span>
                      <input
                        autoComplete="email"
                        onChange={(event) => setSignupEmail(event.target.value)}
                        placeholder="toi@email.com"
                        type="email"
                        value={signupEmail}
                      />
                    </label>
                    <div className={styles.rolePicker}>
                      {roleOptions.map((role) => (
                        <button
                          className={
                            signupRole === role.value ? styles.selectedRole : ""
                          }
                          key={role.value}
                          onClick={() => setSignupRole(role.value)}
                          type="button"
                        >
                          <strong>{role.label}</strong>
                          <span>{role.description}</span>
                        </button>
                      ))}
                    </div>
                  </>
                ) : (
                  <label className={styles.field}>
                    <span>Email</span>
                    <input
                      autoComplete="email"
                      onChange={(event) => setLoginEmail(event.target.value)}
                      placeholder="toi@email.com"
                      type="email"
                      value={loginEmail}
                    />
                  </label>
                )}

                {authMessage && <p className={styles.authMessage}>{authMessage}</p>}

                <button className={styles.primaryButton} type="submit">
                  {authMode === "signup" ? "Creer mon compte" : "Me connecter"}
                </button>
              </form>
            </section>
          </main>
        ) : (
          <>
            <main className={styles.shell}>
              {activeTab === "home" && (
                <>
                  <section className={styles.searchPanel} id="discover">
                    <div>
                      <p className={styles.kicker}>accueil prod finder</p>
                      <h1>Trouve ta prod</h1>
                    </div>
                    <label className={styles.searchBox} htmlFor="beat-search">
                      <span>Search</span>
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

                  <section
                    className={styles.themeRail}
                    aria-label="Themes de recherche"
                  >
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
                    <section
                      className={styles.catalogue}
                      aria-label="Catalogue de prods"
                    >
                      <div className={styles.listHeader}>
                        <p>{isLoading ? "Recherche..." : `${beats.length} prods`}</p>
                        <span>{library.likedBeatIds.length} likes</span>
                      </div>

                      {beats.map((beat) => (
                        <BeatCard
                          beat={beat}
                          isLiked={library.likedBeatIds.includes(beat.id)}
                          isSaved={library.savedBeatIds.includes(beat.id)}
                          isSelected={selectedBeat?.id === beat.id}
                          key={beat.id}
                          onLike={() => toggleLike(beat)}
                          onOpen={() => openBeatInStudio(beat)}
                          onSave={() => toggleSave(beat)}
                        />
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
                          <button onClick={resetSearch} type="button">
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
                                {selectedBeat.producer} ·{" "}
                                {selectedBeat.bpm ?? "--"} BPM · {selectedBeat.key}
                              </span>
                            </div>
                          </div>

                          {selectedBeat.mediaType === "youtube" &&
                          selectedBeat.embedUrl ? (
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

                          <div className={styles.studioActions}>
                            <a
                              className={styles.sourceLink}
                              href={selectedBeat.permalinkUrl}
                              rel="noreferrer"
                              target="_blank"
                            >
                              Voir sur {selectedBeat.source}
                            </a>
                            <button
                              className={
                                library.savedBeatIds.includes(selectedBeat.id)
                                  ? styles.actionActive
                                  : ""
                              }
                              onClick={() => toggleSave(selectedBeat)}
                              type="button"
                            >
                              Enregistrer
                            </button>
                          </div>

                          <div className={styles.playlistAttach}>
                            {library.playlists.length > 0 && (
                              <select
                                aria-label="Playlist cible"
                                onChange={(event) =>
                                  setPlaylistTargetId(event.target.value)
                                }
                                value={
                                  playlistTargetId || library.playlists[0]?.id || ""
                                }
                              >
                                {library.playlists.map((playlist) => (
                                  <option key={playlist.id} value={playlist.id}>
                                    {playlist.name}
                                  </option>
                                ))}
                              </select>
                            )}
                            <button onClick={addSelectedBeatToPlaylist} type="button">
                              Ajouter a une playlist
                            </button>
                          </div>

                          <div className={styles.tags}>
                            {selectedBeat.tags.map((tag) => (
                              <span key={tag}>#{tag}</span>
                            ))}
                          </div>
                        </>
                      ) : (
                        <div className={styles.emptyPlayer}>
                          <p>{isLoading ? "Recherche en cours..." : "Choisis une prod"}</p>
                        </div>
                      )}

                      <div className={styles.writer} id="write">
                        <div className={styles.panelHeader}>
                          <p>Texte</p>
                          <span>
                            {selectedDraft.trim().split(/\s+/).filter(Boolean).length}{" "}
                            mots
                          </span>
                        </div>
                        <textarea
                          aria-label="Texte de l'artiste"
                          disabled={!selectedBeat}
                          onChange={handleDraftChange}
                          placeholder="Pose ton couplet ici..."
                          value={selectedDraft}
                        />
                        <div className={styles.textTools}>
                          <button
                            disabled={!selectedBeat}
                            onClick={saveCurrentText}
                            type="button"
                          >
                            Sauvegarder
                          </button>
                          <button
                            disabled={!selectedBeat}
                            onClick={exportCurrentText}
                            type="button"
                          >
                            Export .txt
                          </button>
                        </div>
                      </div>

                      <div className={styles.session}>
                        <div>
                          <p>Session texte</p>
                          <span>
                            {saveStatus ??
                              `${draftCount} textes sauvegardes en local`}
                          </span>
                        </div>
                      </div>
                    </section>
                  </section>
                </>
              )}

              {activeTab === "library" && (
                <section className={styles.libraryGrid}>
                  <div className={styles.libraryPanel}>
                    <div className={styles.libraryHeader}>
                      <div>
                        <p className={styles.kicker}>bibliotheque</p>
                        <h1>Tes prods</h1>
                      </div>
                      <span>
                        {savedBeats.length} enregistrees · {likedBeats.length} likes
                      </span>
                    </div>

                    <form
                      className={styles.playlistForm}
                      onSubmit={handleCreatePlaylist}
                    >
                      <input
                        onChange={(event) => setNewPlaylistName(event.target.value)}
                        placeholder="Nom de playlist"
                        value={newPlaylistName}
                      />
                      <button type="submit">Creer</button>
                    </form>

                    <div className={styles.playlistList}>
                      {library.playlists.map((playlist) => (
                        <button
                          className={
                            selectedPlaylist?.id === playlist.id
                              ? styles.activePlaylist
                              : ""
                          }
                          key={playlist.id}
                          onClick={() => setOpenPlaylistId(playlist.id)}
                          type="button"
                        >
                          <strong>{playlist.name}</strong>
                          <span>{playlist.trackIds.length} prods</span>
                        </button>
                      ))}
                    </div>

                    {library.playlists.length === 0 && (
                      <div className={styles.emptyState}>
                        <p>Creer une playlist pour ranger tes prods par projet.</p>
                      </div>
                    )}
                  </div>

                  <div className={styles.libraryPanel}>
                    <div className={styles.libraryHeader}>
                      <div>
                        <p className={styles.kicker}>
                          {selectedPlaylist ? selectedPlaylist.name : "selection"}
                        </p>
                        <h2>Ouvrir et ecrire</h2>
                      </div>
                    </div>

                    <div className={styles.libraryList}>
                      {selectedPlaylistBeats.map((beat) => (
                        <SmallBeatRow
                          beat={beat}
                          key={beat.id}
                          onListen={() => openBeatInStudio(beat)}
                          onRemove={
                            selectedPlaylist
                              ? () =>
                                  removeBeatFromPlaylist(selectedPlaylist.id, beat.id)
                              : undefined
                          }
                          onWrite={() => openBeatInStudio(beat)}
                        />
                      ))}

                      {selectedPlaylist && selectedPlaylistBeats.length === 0 && (
                        <div className={styles.emptyState}>
                          <p>Ajoute une prod depuis Accueil pour remplir la playlist.</p>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className={styles.libraryPanel}>
                    <div className={styles.libraryHeader}>
                      <div>
                        <p className={styles.kicker}>likes</p>
                        <h2>Coups de coeur</h2>
                      </div>
                    </div>
                    <div className={styles.libraryList}>
                      {likedBeats.map((beat) => (
                        <SmallBeatRow
                          beat={beat}
                          key={beat.id}
                          onListen={() => openBeatInStudio(beat)}
                          onWrite={() => openBeatInStudio(beat)}
                        />
                      ))}

                      {likedBeats.length === 0 && (
                        <div className={styles.emptyState}>
                          <p>Les prods likees apparaitront ici.</p>
                        </div>
                      )}
                    </div>
                  </div>
                </section>
              )}

              {activeTab === "profile" && (
                <section className={styles.profileGrid}>
                  <div className={styles.profilePanel}>
                    <p className={styles.kicker}>profil</p>
                    <h1>{currentUser.name}</h1>
                    <p>
                      {getRoleLabel(currentUser.role)} · {currentUser.email}
                    </p>

                    <div className={styles.profileForm}>
                      <label className={styles.field}>
                        <span>Nom public</span>
                        <input
                          onChange={(event) =>
                            updateCurrentUser({ name: event.target.value })
                          }
                          value={currentUser.name}
                        />
                      </label>
                      <label className={styles.field}>
                        <span>Email</span>
                        <input
                          onChange={(event) =>
                            updateCurrentUser({
                              email: normalizeEmail(event.target.value),
                            })
                          }
                          type="email"
                          value={currentUser.email}
                        />
                      </label>
                      <div className={styles.rolePicker}>
                        {roleOptions.map((role) => (
                          <button
                            className={
                              currentUser.role === role.value
                                ? styles.selectedRole
                                : ""
                            }
                            key={role.value}
                            onClick={() => updateCurrentUser({ role: role.value })}
                            type="button"
                          >
                            <strong>{role.label}</strong>
                            <span>{role.description}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div
                    className={`${styles.profilePanel} ${
                      currentUser.soundCloudConnected ? styles.syncActive : ""
                    }`}
                  >
                    <p className={styles.kicker}>soundcloud sync</p>
                    <h2>Connecter ton SoundCloud</h2>
                    <p>
                      Garde le handle maintenant. La vraie synchro utilisera
                      une authentification SoundCloud cote serveur des que Trackverse
                      a les droits.
                    </p>
                    <label className={styles.field}>
                      <span>Handle SoundCloud</span>
                      <input
                        onChange={(event) =>
                          updateCurrentUser({
                            soundCloudHandle: event.target.value,
                          })
                        }
                        placeholder="@tonblaze"
                        value={currentUser.soundCloudHandle}
                      />
                    </label>
                    <button
                      className={styles.primaryButton}
                      onClick={() =>
                        updateCurrentUser({
                          soundCloudConnected: !currentUser.soundCloudConnected,
                        })
                      }
                      type="button"
                    >
                      {currentUser.soundCloudConnected
                        ? "SoundCloud connecte"
                        : "Preparer la connexion"}
                    </button>
                  </div>

                  <div className={styles.profilePanel}>
                    <p className={styles.kicker}>stockage local</p>
                    <h2>Ton espace</h2>
                    <div className={styles.statsGrid}>
                      <span>
                        <strong>{savedBeats.length}</strong>
                        prods
                      </span>
                      <span>
                        <strong>{library.playlists.length}</strong>
                        playlists
                      </span>
                      <span>
                        <strong>{draftCount}</strong>
                        textes
                      </span>
                    </div>
                    <button
                      className={styles.secondaryButton}
                      onClick={() => {
                        setCurrentUserId(null);
                        setActiveTab("home");
                      }}
                      type="button"
                    >
                      Deconnexion
                    </button>
                  </div>
                </section>
              )}
            </main>

            <nav className={styles.bottomNav} aria-label="Navigation mobile">
              <button
                className={activeTab === "home" ? styles.activeNav : ""}
                onClick={() => setActiveTab("home")}
                type="button"
              >
                Accueil
              </button>
              <button
                className={activeTab === "library" ? styles.activeNav : ""}
                onClick={() => setActiveTab("library")}
                type="button"
              >
                Biblio
              </button>
              <button
                className={activeTab === "profile" ? styles.activeNav : ""}
                onClick={() => setActiveTab("profile")}
                type="button"
              >
                Profil
              </button>
            </nav>
          </>
        )}
      </div>
    </>
  );
}

type BeatCardProps = {
  beat: TrackverseBeat;
  isLiked: boolean;
  isSaved: boolean;
  isSelected: boolean;
  onLike: () => void;
  onOpen: () => void;
  onSave: () => void;
};

function BeatCard({
  beat,
  isLiked,
  isSaved,
  isSelected,
  onLike,
  onOpen,
  onSave,
}: BeatCardProps) {
  return (
    <article className={`${styles.beatCard} ${isSelected ? styles.selectedBeat : ""}`}>
      <button className={styles.beatMain} onClick={onOpen} type="button">
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
          className={isLiked ? styles.actionActive : ""}
          onClick={onLike}
          type="button"
          aria-label={`Liker ${beat.title}`}
        >
          Like
        </button>
        <button
          className={isSaved ? styles.actionActive : ""}
          onClick={onSave}
          type="button"
          aria-label={`Enregistrer ${beat.title}`}
        >
          Save
        </button>
      </div>
    </article>
  );
}

type SmallBeatRowProps = {
  beat: TrackverseBeat;
  onListen: () => void;
  onRemove?: () => void;
  onWrite: () => void;
};

function SmallBeatRow({ beat, onListen, onRemove, onWrite }: SmallBeatRowProps) {
  return (
    <article className={styles.smallBeat}>
      <div>
        <strong>{beat.title}</strong>
        <span>
          {beat.producer} · {beat.source}
        </span>
      </div>
      <div className={styles.smallBeatActions}>
        <button onClick={onListen} type="button">
          Ecouter
        </button>
        <button onClick={onWrite} type="button">
          Ecrire
        </button>
        {onRemove && (
          <button onClick={onRemove} type="button">
            Retirer
          </button>
        )}
      </div>
    </article>
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

function createEmptyLibrary(): LibraryState {
  return {
    likedBeatIds: [],
    savedBeatIds: [],
    playlists: [],
    drafts: {},
    beatCache: {},
  };
}

function normalizeLibrary(value: Partial<LibraryState>): LibraryState {
  return {
    ...createEmptyLibrary(),
    ...value,
    likedBeatIds: Array.isArray(value.likedBeatIds) ? value.likedBeatIds : [],
    savedBeatIds: Array.isArray(value.savedBeatIds) ? value.savedBeatIds : [],
    playlists: Array.isArray(value.playlists) ? value.playlists : [],
    drafts: value.drafts ?? {},
    beatCache: value.beatCache ?? {},
  };
}

function readStoredValue<T>(key: string, fallback: T): T {
  try {
    const rawValue = window.localStorage.getItem(key);

    return rawValue ? (JSON.parse(rawValue) as T) : fallback;
  } catch {
    return fallback;
  }
}

function cacheTracks(library: LibraryState, tracks: TrackverseBeat[]) {
  const nextCache = { ...library.beatCache };

  tracks.forEach((track) => {
    nextCache[track.id] = track;
  });

  return {
    ...library,
    beatCache: nextCache,
  };
}

function getBeatList(ids: string[], beatCache: Record<string, TrackverseBeat>) {
  return ids
    .map((id) => beatCache[id])
    .filter((beat): beat is TrackverseBeat => Boolean(beat));
}

function toggleId(list: string[], id: string) {
  return list.includes(id) ? list.filter((item) => item !== id) : [id, ...list];
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function createId(prefix: string) {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return `${prefix}-${crypto.randomUUID()}`;
  }

  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function createDraftIntro(beat: TrackverseBeat) {
  return `Prod: ${beat.title}\n\n`;
}

function getRoleLabel(role: UserRole) {
  return role === "artist" ? "Artiste" : "Createur son";
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 64);
}
