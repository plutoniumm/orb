# Thin wrappers around the npm scripts (see package.json).

# regenerate data/planets.json from the JPL DE440 ephemeris (needs python3)
init:
	python3 index.py

# local dev server with hot reload
dev:
	npm run dev

# production build into ./dist
build:
	npm run build

# build and publish ./dist to GitHub Pages
deploy:
	npm run deploy
