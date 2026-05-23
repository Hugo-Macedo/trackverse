# Trackverse Makefile

.PHONY: install dev start precommit build

install:
	npm install

# Installe et démarre le projet en mode développement.
# Si à terme tu as un serveur backend séparé, tu peux remplacer cette commande par une commande de démarrage multi-processus.
up: install dev

dev:
	npm run dev

start:
	npm run dev

build:
	npm run build

precommit:
	npm run lint
	npm run test:run
