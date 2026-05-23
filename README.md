# trackverse

Trackverse est une application Next.js mobile-first qui aide artistes, beatmakers et ingénieurs du son à trouver des "prods" (beats), écrire des textes associés, organiser des playlists et préparer des sessions d'enregistrement.

## Aperçu

- Catalogue de prods récupéré côté serveur depuis YouTube Data API (fallback SoundCloud).
- Recherche par mot‑clé et thème depuis la page d'accueil.
- Lecture via embed YouTube ou stream SoundCloud selon la source.
- Sauvegarde locale des likes, prods enregistrées, playlists et brouillons d'écriture.
- PWA basique : `manifest.webmanifest`, icônes, et enregistrement de `sw.js` en production.

## Badges

![Build](https://img.shields.io/badge/build-passing-brightgreen) ![Tests](https://img.shields.io/badge/tests-passing-brightgreen) ![License](https://img.shields.io/badge/license-MIT-blue)

## Table des matières

- Installation
- Variables d'environnement
- Commandes utiles
- Tests, lint et format
- PWA & mobile-first
- CI / Déploiement
- Base de données & Auth
- Contribuer

## Installation

Prérequis : Node 20, npm

À partir de la racine du dépôt :

```bash
npm install
make dev
```

Démarrer seulement en dev :

```bash
npm run dev
```

## Variables d'environnement

Copie le modèle et complète les valeurs sensibles :

```bash
cp .env.example .env.local
# puis édite .env.local
```

Variables importantes (extrait) :

- `YOUTUBE_API_KEY` — clé YouTube Data API v3
- `SOUNDCLOUD_CLIENT_ID` / `SOUNDCLOUD_CLIENT_SECRET` — optionnel
- `DATABASE_URL` — URL PostgreSQL (Prisma / Supabase)
- `NEXTAUTH_URL` — URL publique (ex. https://example.com)
- `NEXTAUTH_SECRET` — secret pour NextAuth/Session

## Commandes utiles

- `npm run dev` : lancement en développement
- `npm run build` : build production
- `npm run start` : start production (Next.js)
- `npm run lint` : eslint
- `npm run lint:fix` : eslint --fix
- `npm run format` : prettier --write
- `npm run test:run` : vitest run
- `make precommit` : exécute `lint` puis `test:run`

## Tests, lint et format

- `ESLint` (config Next + Prettier) et `Prettier` pour le formatage.
- Tests unitaires avec `Vitest` et `@testing-library/react`.

Vérifications locales rapides :

```bash
npm run lint && npm run test:run
```

## PWA & mobile-first

- La base PWA est prête : le manifeste est en `public/manifest.webmanifest` et `sw.js` est présent.
- L'expérience est conçue mobile-first (UI responsive, navigation basse).

## CI / Déploiement

- GitHub Actions : CI lancée sur `push` et `pull_request` vers `main`.
- Déploiement en production : uniquement déclenché lorsqu'un tag `v*` est poussé sur `main` (job `deploy`).
- `VERCEL_TOKEN` doit être ajouté en secret GitHub Actions, pas dans `.env.local`.
- Pour déployer sur Vercel automatiquement, ajoute `VERCEL_TOKEN`, `VERCEL_ORG_ID` et `VERCEL_PROJECT_ID` dans les secrets GitHub.

Créer et pousser un tag de release :

```bash
git tag v1.0.0
git push origin v1.0.0
```

## Base de données & Auth (préconisations)

- Recommandé : PostgreSQL + `Prisma` pour ORM / migrations, ou `Supabase` comme solution managée.
- Auth recommandée : `NextAuth.js` (email / OAuth) ou services tiers (`Clerk`, `Auth0`) si besoin.

Si tu choisis Prisma :

```bash
npm install prisma --save-dev
npx prisma init
npx prisma migrate dev --name init
```

## Contribuer

- Fork → branche feature → PR vers `main`.
- Avant PR : `npm run lint` et `npm run test:run`.

## Licence

MIT

---

J'ai mis à jour le fichier README pour fournir des instructions claires et actionnables. Dis‑moi si tu veux que j'ajoute :

- un guide d'installation Prisma + schema d'exemple,
- l'intégration `NextAuth` prête à l'emploi,
- ou le job Vercel complet dans la CI (requiert `VERCEL_TOKEN`).

Fichier mis à jour : [README.md](README.md)
