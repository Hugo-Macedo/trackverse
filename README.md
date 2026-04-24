# trackverse

Application Next.js pour connecter artistes, ingenieurs son et beatmakers autour de prods, playlists, textes et sessions d'enregistrement.

## MVP actuel

- Catalogue de prods recupere depuis l'API SoundCloud.
- Recherche de sons par mot-cle et theme via `/api/soundcloud/search`.
- Selection d'une prod et lecteur audio via `/api/soundcloud/tracks/:id/stream`.
- Likes et ajout en playlist en local state.
- Bloc d'ecriture artiste avec compteur de mots.
- Mode Artiste / Inge son.
- Panneau de session avec etat REC.
- Interface mobile-first avec navigation basse.
- Base PWA avec manifest, icone et service worker.
- Direction artistique noire/violette sans background graffiti lourd.

## Integration SoundCloud

L'application utilise le flow SoundCloud Client Credentials cote serveur. Ajoute les credentials dans `.env.local` :

```bash
SOUNDCLOUD_CLIENT_ID=xxx
SOUNDCLOUD_CLIENT_SECRET=xxx
```

Optionnellement, tu peux fournir un token deja genere :

```bash
SOUNDCLOUD_ACCESS_TOKEN=xxx
```

Endpoints disponibles :

- `GET /api/soundcloud/search?q=drill&theme=Trap%20sombre&limit=24`
- `GET /api/soundcloud/tracks/:id/stream`

Les resultats SoundCloud sont normalises en format Trackverse pour le front. Attention : "gratuit" ici veut dire streamable depuis SoundCloud, pas automatiquement libre de droits pour une exploitation commerciale.

## Lancer le projet

```bash
npm install
npm run dev
```

Puis ouvrir [http://localhost:3000](http://localhost:3000).

## Scripts

```bash
npm run dev
npm run build
npm run start
npm run lint
```

## Workflow MR

Je peux preparer les branches, relire les diffs, lancer lint/build, corriger les retours et te donner le contenu pret a mettre en merge request. Le merge effectif dependra de l'acces Git distant et des droits CI disponibles dans ton environnement.
