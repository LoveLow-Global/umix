# um!x alpha

um!x puts your taste on one map. This alpha does one thing for real. It looks at the songs and the pictures and clothes on your map, then guesses films and series you'd like, using a multi-layer graph neural network trained in Julia.

Class project for IID2019 Introduction to Social Computing (Yonsei, fall 2026), by Hyun Jun Cho, Jihyung Kim and Goeun Ju.

## Run it

You need Julia 1.10 or newer (we use 1.12), and Node 22 or newer for the React site and the parity check.

```bash
make setup
```

```bash
make serve
```

Then open http://localhost:8080. That runs the Julia API and serves the web app. The trained model is already in `frontend/model/umix-model.json`, so it works right away.

No Julia? The app also runs by itself, with the model running in the browser.

```bash
make static
```

Then open http://localhost:8090.

The React version, the one that goes on Vercel, is in `webpage/`.

```bash
make web
```

Then open http://localhost:5173. It looks and works the same as the plain version, and it gives the same picks.

Press the `` ` `` key (or tap the flower logo three times) to open the facilitator panel. It shows which engine is running and has jump links, a reset button and a switch between the Julia API and the browser engine.

### Retrain or rebuild things

| command | what it does | time |
|---|---|---|
| `make synthetic` | builds 5,000 fake maps on the demo catalogue | seconds |
| `make train` | trains on them, runs the hidden-film test, updates the app model | about 1 min |
| `make amazon` | downloads and builds the real Amazon dataset (streams about 500 MB, keeps about 60 MB) | about 5 min |
| `make train-amazon` | trains and tests on the Amazon data | about 10 min |
| `make test` | Julia tests, then checks the browser engine gives the exact same picks as Julia | under 1 min |
| `make web-build` | builds the React site into `webpage/dist`, the same way Vercel does | seconds |
| `make user-test` | reports on the user test answers in `results/user_test/` | seconds |

The server needs an interactive thread (`julia --threads=1,1`), the Makefile already does that.

## What's in here

```
umix/
├── backend/                Julia package "Umix"
│   ├── src/
│   │   ├── data.jl         dataset shape shared by everything
│   │   ├── catalog.jl      reads the demo catalogue
│   │   ├── synth.jl        fake maps for the demo catalogue
│   │   ├── amazon.jl       real data from Amazon Reviews 2023
│   │   ├── model.jl        the multi-layer GCN
│   │   ├── train.jl        training with the hidden-film setup
│   │   ├── evaluate.jl     hidden-film test and baselines
│   │   ├── export.jl       model to JSON, and running it from JSON
│   │   ├── server.jl       HTTP API (also serves the web app)
│   │   └── usertest.jl     reads the keeps and skips saved in the user test
│   ├── bin/                scripts behind the Makefile
│   └── test/runtests.jl
├── frontend/               the app (plain HTML, CSS and JS modules)
│   ├── index.html
│   ├── css/app.css         design prototype styles plus a few additions
│   ├── js/engine.js        runs the model, in the browser or through the API (no DOM code)
│   ├── js/app.js           screens, based on the design prototype
│   └── model/umix-model.json
├── webpage/                the same app in React + Vite, this is what goes on Vercel
│   ├── src/screens/        one file per part of the app
│   ├── src/store.js        app state and the film picks
│   └── public/model/       copy of the trained model
├── data/
│   ├── catalog/            songs, visual saves, films and TV with mood tags (edit freely)
│   ├── processed/          built datasets
│   └── raw/                downloads (git ignored)
├── models/                 exported models
├── results/                hidden-film test reports
├── docs/model.md           how the model works, in more detail
├── docs/data.md            what data I looked for and what we used
└── scripts/                Amazon download, Julia vs browser check
```

## How it works

Short version. The full thing is in [docs/model.md](docs/model.md).

1. **One graph, three layers.** Music, visual/fashion, and film/TV are separate layers. The same user nodes sit in all three, so taste can travel from one layer to another through people who saved things in both.
2. **Propagate.** A few rounds of GCN message passing (LightGCN style) over the layers. Each layer is normalized on its own and gets a learned weight, so a layer people save a ton of can't drown out the others.
3. **Read a new map.** A new user is never in the graph. We average the vectors of their songs, and of their pictures and clothes, and one small shared network (attention plus a small MLP, same weights for everyone) mixes them into one taste vector.
4. **Score films.** Dot product with every film vector plus a film bias. Each pick also gets a reason, the saved item that pushes it up the most.

Training copies what the app does. In every epoch some training users play "new users". They are kept out of the graph, and the model has to find their hidden films from their songs and pictures only.

## Results

The hidden-film test hides each test user's films, shows the model only their music and visual saves, and checks where the real films land. Full tables are in [results/](results). Numbers here are NDCG@10, higher is better.

**Synthetic maps** (500 test maps, 75 films and series)

| method | NDCG@10 | recall@10 |
|---|---|---|
| Popularity | 0.238 | 0.253 |
| Tag overlap (the prototype's fake engine) | 0.230 | 0.248 |
| Item-kNN on co-saves | 0.357 | 0.360 |
| **Multi-layer GCN (ours)** | **0.438** | **0.421** |

The GCN beats item-kNN by +0.081 NDCG@10 (95% interval +0.066 to +0.096) on the same test maps.

**Amazon, real people** (755 test users, 15,378 films and series)

| method | NDCG@10 | recall@10 | hit@10 |
|---|---|---|---|
| Popularity | 0.0117 | 0.0121 | 0.083 |
| Tag overlap (no tags are shared across layers here, so it equals popularity) | 0.0117 | 0.0121 | 0.083 |
| Item-kNN on co-purchases | 0.0074 | 0.0068 | 0.046 |
| GCN with the graph turned off (ablation) | 0.0129 | 0.0136 | 0.091 |
| **Multi-layer GCN (ours)** | **0.0152** | **0.0153** | **0.109** |

Real data is way harder (15K films to pick from, and buying a CD is noisy taste data), so every number is much lower. Here is what I'd actually claim.

* The GCN beats popularity on real people by about 30%. A paired check on the same test users gives +0.0035 NDCG@10 with a 95% interval of +0.0004 to +0.0066, so it's real but small.
* It beats item-kNN clearly (+0.0078, interval +0.0030 to +0.0126). Plain co-purchase counting is too sparse across layers and does worse than popularity.
* The graph seems to help on real data (0.0152 vs 0.0129 without it), but with 755 test users that gap isn't significant yet. On the synthetic maps the graph adds nothing, because every item there is saved by hundreds of maps.
* Attention vs a plain average of the layers makes no difference on either dataset.

## The data

There's no public dataset where the same people saved music, fashion or visual stuff, and films. The closest real thing is Amazon Reviews 2023, where one reviewer id spans CDs & Vinyl, Clothing, Shoes & Jewelry, and Movies & TV. 13,087 people rated all three, and 7,553 are left after cleaning. That is what `make amazon` builds.

The app itself runs on synthetic maps over a hand-made catalogue with mood tags (64 songs, 62 visual saves, 75 films and series), because the app needs items people actually recognize. Synthetic results show the pipeline works, not that real people act like this. All of it is in [docs/data.md](docs/data.md).

## What changed from the design prototype

The screens and the look are the designer's. These parts changed.

* Only three layers (music, visual/fashion, film/TV). Books and "things" are out for the alpha, fashion pieces are in.
* Film and TV picks come from the trained model, not from counting shared tags.
* Every pick explains itself ("People who saved Small cafés also kept this"), and Discover shows how much songs vs pictures counted for your map.
* Onboarding makes one map (pilot finding 01), shows a short "how to read your map" sheet (finding 02), and linked apps only bring in a few top items (finding 03).
* The quiz answers are real catalogue items, so they actually land on your map and steer the picks.
* The facilitator panel can't fake recommendations anymore. It shows which engine runs and the test numbers instead.
* Fixed the map layout putting all suggestion rings on one spot when a map has fewer saves than suggestions, and the reset button covering the tab bar on phones.

Still sample data, like in the prototype. Other people's maps ("Maps like yours", followers) and the linked Spotify and Pinterest accounts.

## Running the user test

The plan is simple. The model guesses films from someone's songs, pictures and clothes, and then real people tell us if the guesses are any good. The React site saves every keep and skip on a film, so nobody has to take notes. For each answer it saves

* kept, skipped, or removed after keeping
* where it happened (the rings on the map, today's pick, a Discover row, search, bubbles and so on)
* how the model ranked that film for the person's map right then, where rank 1 is its top pick
* what was on the map at that moment

All of it stays in the browser on that device. Nothing gets sent anywhere, and the welcome screen tells testers we note their keeps and skips.

**On the day.** Open the facilitator panel (the `` ` `` key, or tap the flower logo three times). Its User test part shows the tester number and how many answers are saved. Press Reset prototype between testers, which also gives the next person a new number, and the answers stay. At the end press Download JSON, plus Download CSV if you want a spreadsheet. If people test on their own phones, each phone downloads its own file.

**After.** Put the JSON files in `results/user_test/` and run

```bash
make user-test
```

It writes `results/user_test_report.md`. The main number pairs every film a tester kept with every film the same tester skipped, and counts how often the model ranked the kept one higher. 50% means the ranking tells us nothing and 100% would be perfect. The report also has keep rates by where the pick came from, and how often the top 3 suggestions got kept. "Outside your bubble" shows the model's lowest picks, so it works as a built-in comparison.

`results/user_test/` is git ignored, since it holds raw answers from real people.

## Put it online

The code lives at https://github.com/LoveLow-Global/umix. The site that goes online is `webpage/`, a React + Vite app. Vercel builds it from GitHub, and the model runs in each visitor's browser, so there's no server to pay for.

To connect Vercel, pick Add New on vercel.com, then Project, and import `LoveLow-Global/umix`. Set Root Directory to `webpage`, keep the rest as Vercel suggests, and press Deploy.

After that every push to `main` deploys again. `make train` writes the new model into `webpage/public/model/` as well, so after retraining just commit and push.

* Vercel can't run Julia. If we want the Julia API live, host `backend/bin/serve.jl` somewhere like Render, Fly.io or a lab machine, then set `VITE_UMIX_API` to its address in the Vercel project settings. CORS is already open.
* The plain version in `frontend/` stays. The Julia server serves it on http://localhost:8080 and the parity check tests its engine. Both apps use the same `engine.js` and the same model file, and `make test` checks both copies of the engine against Julia.
* More about the React code is in [webpage/README.md](webpage/README.md).

## Known limits

* The app model learned from fake maps. Real um!x saves from the user test should replace them.
* Films kept on a map stay on the map, but only songs, pictures and clothes steer the picks for now.
* Custom items that aren't in the catalogue don't steer anything (the app says so).
* On Amazon, fashion items have no titles in our copy (the fashion metadata file is about 4 GB).
* Only the React site saves user test answers. The plain version in `frontend/` doesn't.
* The test answers only show what people kept or skipped. Films they never tapped aren't counted either way.

## References

The model builds on PinSage (Ying et al., 2018) and PPGN (Zhao et al., 2019) from the poster, LightGCN (He et al., 2020) for the propagation, and the cross-domain cold start idea from EMCDR (Man et al., 2017). The real data is Amazon Reviews 2023 (Hou et al., 2024). Full list in [docs/model.md](docs/model.md#references).
