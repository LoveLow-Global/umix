# um!x alpha website

The um!x alpha app as a React + Vite site. It is set up like our other sites, so Vercel can put it online.

## Develop

```bash
npm install
npm run dev
```

Then open http://localhost:5173. The trained model runs right in the browser, so nothing else has to run.

## Edit content

* Screens are in [`src/screens/`](src/screens), one file per part of the app (onboarding, map, full map, Discover, bubbles, account and settings).
* Bottom sheets, menus and the toast are in [`src/components/Sheets.jsx`](src/components/Sheets.jsx). The facilitator panel is in [`src/components/Facilitator.jsx`](src/components/Facilitator.jsx).
* Sample people, quiz questions and cover colors live in [`src/data.js`](src/data.js).
* App state and the film picks are in [`src/store.js`](src/store.js). Everything a tap can do is in [`src/actions.js`](src/actions.js).
* Styles are in [`src/index.css`](src/index.css), the designer's stylesheet.
* The user test log (every keep and skip on a film, with the model's rank) is in [`src/testlog.js`](src/testlog.js). The facilitator panel downloads it. How to run the test is in the main [README](../README.md#running-the-user-test).
* `src/engine.js` and `public/model/umix-model.json` are copies. They come from `../frontend` before every `npm run dev` and `npm run build`, and `make train` writes the model here too. Edit `frontend/js/engine.js` instead of the copy.

## Deploy

The site is deployed on Vercel from the GitHub repo. When you import the repo on Vercel, set **Root Directory** to `webpage` and keep everything else as Vercel suggests (Vite, `npm run build`, output in `dist`). After that every push to `main` makes a new production deploy.

The model runs in the browser, so the site needs no server. If the Julia server ever gets hosted somewhere, add an environment variable called `VITE_UMIX_API` with its address in the Vercel project settings, and the app asks that server first.
