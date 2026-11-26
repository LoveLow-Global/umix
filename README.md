# um!x

um!x puts your music, films and style on one map. You tell it a few artists and films you love, and a graph neural network trained on real Amazon shoppers guesses the rest, like what you'd wear. Everything in it is real data, and the model runs in your browser.

Class project for Introduction to Social Computing (Yonsei, fall 2026), by Hyun Jun Cho, Jihyung Kim and Goeun Ju.

## Run the website

You need Node 22 or newer. The trained model is already in `webpage/public/model`, so this works right away.

```bash
make web
```

Then open http://localhost:5173. More about the website is in [webpage/README.md](webpage/README.md).

## Rebuild the data and the model

You need Julia 1.12 for this part.

| command | what it does | time |
|---|---|---|
| `make setup` | installs the Julia and website packages | a few minutes, first time only |
| `make amazon` | downloads Amazon Reviews 2023 (streams about 5 GB, keeps about 600 MB) | about 30 min |
| `make data` | turns it into artists, titles and brand + type, and who saved what | under 1 min |
| `make train` | trains the model plus the ablations, runs the hidden-layer test, writes the report and exports the website files | a few hours |
| `make train-quick` | the same without the ablations | about an hour |
| `make test` | Julia tests, then checks the browser engine gives the same picks as Julia | about 2 min |
| `make user-test` | report on the user test answers in `results/user_test/` | seconds |

## What's in here

```
umix/
├── backend/                Julia package "Umix"
│   ├── src/
│   │   ├── data.jl         dataset shapes
│   │   ├── entities.jl     Amazon products become artists, titles and brand + type
│   │   ├── amazon.jl       ratings, dense core, train/val/test split
│   │   ├── model.jl        the multi-layer graph network (Lux)
│   │   ├── train.jl        training with Enzyme, the hidden-layer setup
│   │   ├── evaluate.jl     the hidden-layer test and the baselines
│   │   ├── export.jl       writes the website's model files, and runs them like the browser does
│   │   └── usertest.jl     reads the keeps and skips saved in the user test
│   ├── bin/                scripts behind the Makefile
│   └── test/               Julia tests, with a tiny made-up dataset for speed
├── webpage/                the website (React + Vite), this is what goes on Vercel
│   ├── src/pages/          one file per page
│   ├── src/lib/engine.js   runs the model in the browser
│   └── public/model/       the trained model and its catalogue
├── data/                   downloads and the built dataset (git ignored)
├── results/                test reports
├── docs/data.md            the data, in detail
├── docs/model.md           the model, in detail
└── scripts/                the Amazon download and the browser vs Julia check
```

## How it works

1. **Real data.** Amazon Reviews 2023 has the same people's CDs, movies and clothes. A 4 or 5 star rating counts as a save. We keep 105,526 people who saved things in at least two of the three areas. More in [docs/data.md](docs/data.md).
2. **Things people name.** CDs become artists, DVD editions become one title, products become a brand plus a type. Tags come from Amazon's own labels, which is how Taylor Swift gets linked to Pop and Country.
3. **One graph, three layers.** Music, film and style share the same people, so taste can travel from songs to clothes through people who saved both. Message passing runs LightGCN style with a learned weight per layer.
4. **Any layer from the others.** For a new person, we average what they gave per layer, mix their layers with attention, and a small head per layer scores every item. Skip a layer during onboarding and the model guesses it. More in [docs/model.md](docs/model.md).
5. **Honest test.** Training hides one layer of a person and asks the model to find it from the rest. The test does the same on people the model never saw.

## Results

The hidden-layer test hides one whole layer of a test person (10,553 people the model never saw) and checks where their real saves land among every item of that layer. NDCG@10, higher is better. Full tables with 95% intervals are in [results/amazon_report.md](results/amazon_report.md).

| hidden layer | popularity | item-kNN | no graph | tags only | GCN (ours) |
|---|---|---|---|---|---|
| music | 0.0452 | 0.0308 | 0.0632 | 0.0647 | **0.0675** |
| film and TV | 0.0206 | 0.0092 | 0.0248 | 0.0255 | **0.0260** |
| style | 0.0506 | 0.0111 | 0.0547 | 0.0552 | **0.0552** |
| style from music + film | 0.0680 | 0.0311 | 0.0736 | 0.0722 | **0.0748** |

* The model beats popularity in every layer, and the paired intervals stay above zero (music +0.022, film +0.005, style +0.005).
* The graph clearly helps music and film. For style it adds nothing measurable over the version without it.
* Plain co-purchase counting (item-kNN) is worse than popularity here, the data is too sparse across layers.

## Running the user test

The model guesses, real people tell us if the guesses are any good. The website saves every keep and skip on a pick, with where the model ranked it, so nobody has to take notes. All of it stays in the browser on that device.

**On the day.** Open `/test` on the device people will use. It shows the tester number and how many answers are saved. Press "Start the next tester" between people, which clears the app and gives the next person a new number while the answers stay. At the end press Download JSON, plus Download CSV if you want a spreadsheet. If people test on their own phones, each phone downloads its own file.

**After.** Put the JSON files in `results/user_test/` and run

```bash
make user-test
```

It writes `results/user_test_report.md`. The main number pairs every pick a tester kept with every pick they skipped in the same layer, and counts how often the model ranked the kept one higher. 50% means the ranking tells us nothing and 100% would be perfect. `results/user_test/` is git ignored, since it holds raw answers from real people.

## Put it online

The code lives at https://github.com/LoveLow-Global/umix. Vercel builds `webpage/` from it. In the Vercel project, Root Directory is `webpage` and the rest is what Vercel suggests. Every push to `main` deploys again. `make train` writes the new model into `webpage/public/model/`, so after retraining just commit and push.

## Known limits

* Amazon buyers aren't Spotify listeners. CD buyers skew older, so classic rock is big and newer artists are rare (many are in the search list though).
* A purchase isn't taste. People buy gifts and basics.
* Amazon has no age or gender. The model can't use them. The clothes section only filters style picks, and age is only kept for the study.
* The test answers only show what people kept or skipped. Picks they never tapped don't count either way.
* Covers and product photos load from Amazon's image links, fine for a class prototype but not for a real launch.

## References

LightGCN (He et al., 2020) for the message passing, PinSage (Ying et al., 2018) and PPGN (Zhao et al., 2019) for graph networks across domains, EMCDR (Man et al., 2017) for cross-domain cold start, Mult-VAE (Liang et al., 2018) for the loss. Built with Lux.jl and Enzyme. Data from Amazon Reviews 2023 (Hou et al., 2024). Full list in [docs/model.md](docs/model.md#references).
