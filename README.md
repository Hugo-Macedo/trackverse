# trackverse

Application Next.js pour connecter artistes, ingenieurs son et beatmakers autour de prods, playlists, textes et sessions d'enregistrement.

## MVP actuel

- Catalogue de prods recupere depuis l'API YouTube Data.
- Recherche de prods par mot-cle et theme via `/api/youtube/search`.
- Selection d'une prod et lecture via embed YouTube.
- Likes et ajout en playlist en local state.
- Bloc d'ecriture artiste avec compteur de mots.
- Mode Artiste / Inge son.
- Panneau de session avec etat REC.
- Interface mobile-first avec navigation basse.
- Base PWA avec manifest, icone et service worker.
- Direction artistique noire/violette sans background graffiti lourd.

## Integration YouTube

L'application utilise YouTube Data API v3 cote serveur pour chercher des videos de type beat/instrumental. Ajoute une cle API dans `.env.local` :

```bash
YOUTUBE_API_KEY=xxx
```

Endpoint principal :

- `GET /api/youtube/search?q=drill&theme=Trap%20sombre&limit=18`

Les resultats YouTube sont normalises en format Trackverse pour le front. Attention : l'API ne garantit pas qu'une video est une prod libre de droits. On force une recherche orientee `type beat instrumental prod`, puis on affiche le lecteur YouTube officiel et le lien vers la video source.

## Integration SoundCloud optionnelle

Les endpoints SoundCloud restent disponibles si tu recuperes un jour des credentials :

- `GET /api/soundcloud/search?q=drill&theme=Trap%20sombre&limit=24`
- `GET /api/soundcloud/tracks/:id/stream`

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

Les pull requests vers `main` ou `develop` lancent la CI GitHub Actions :

- `npm ci`
- `npm run lint`
- `npm run build`

Sur Vercel, configure `main` comme branche de production pour declencher un deploy prod a chaque merge vers `main`.
