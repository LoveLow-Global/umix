# um!x website

The um!x app as a React + Vite site, set up like our other sites so Vercel can put it online. The trained model runs in the browser, so there's no server.

## Develop

```bash
npm install
npm run dev
```

Then open http://localhost:5173.

## Pages

| URL | page |
|---|---|
| `/` | what um!x does |
| `/start` | onboarding, your name, which clothes you shop for, age range |
| `/start/music`, `/start/film`, `/start/style` | add what you like in each layer (search, most saved, genres) |
| `/start/ready` | the first guess for the layer you skipped |
| `/map` | your taste map |
| `/discover`, `/discover/music`, `/discover/film`, `/discover/style` | picks with reasons, keep or skip |
| `/item/<layer>/<id>` | one artist, title or style, and what goes with it |
| `/me` | your info and everything you gave us |
| `/about` | how the data and model work |
| `/test` | for the user test facilitator, not linked in the app |
| `/proto/` | the phone prototype (`proto/`). Its screens are the design mock; making a map and the map's suggestions run on the real model (`proto/real.js`). Keeps and skips go to the same test log as `/test` |

## Edit content

* Pages are in [`src/pages/`](src/pages), onboarding in [`src/pages/start/`](src/pages/start).
* Shared pieces (covers, tiles, the picker) are in [`src/components/`](src/components).
* What the person gave us is saved in [`src/lib/store.js`](src/lib/store.js), only on their device.
* [`src/lib/engine.js`](src/lib/engine.js) runs the model. [`src/lib/model.js`](src/lib/model.js) loads it and does search, [`src/lib/picks.js`](src/lib/picks.js) turns a person into picks.
* [`src/lib/testlog.js`](src/lib/testlog.js) saves keeps and skips for the user test.
* Styles are in [`src/index.css`](src/index.css).
* `public/model/` is written by `make train`. Don't edit it by hand.

## Deploy

The site is deployed on Vercel from the GitHub repo. In the Vercel project, Root Directory is `webpage` and everything else is what Vercel suggests (Vite, `npm run build`, output in `dist`). Every push to `main` makes a new deploy. `vercel.json` sends every URL to the app, so links like `/discover/style` work when opened directly.
