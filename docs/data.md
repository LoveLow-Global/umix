# Data

## What we needed

For the alpha we want to guess film and TV taste from music taste and visual or fashion taste. To train that, we need the same people's saves in all three. That is the hard part. Lots of datasets have one of these layers, and a few have two, but almost nobody has all three for the same people.

## What I looked at

| Dataset | Music | Visual / fashion | Film / TV | Same people across them | Verdict |
|---|---|---|---|---|---|
| Amazon Reviews 2023 (McAuley Lab, UCSD) | CDs & Vinyl | Clothing, Shoes & Jewelry | Movies & TV | yes, one reviewer id across categories | **used** |
| Douban (movie, music, book) | yes | no | yes | yes | no fashion or visual layer |
| Wiki-MID (Twitter interests mapped to Wikipedia pages) | yes | not that I could find | yes | yes | interests, not saves, and no clear fashion domain |
| TEDS 18-year questionnaire (UK twins) | yes | 8 fashion styles | no | yes | no film, access needs an application |
| MovieLens, Spotify Million Playlist, H&M, Polyvore | one each | one each | one each | no | single domain, can't teach cross-domain taste |

So Amazon was the only public option that has all three layers for the same people. It is not perfect (more on that below), but it is real.

## The real dataset (Amazon)

`scripts/fetch_amazon.sh` does the downloading. It grabs the small 5-core rating files for music and film (about 21 MB and 111 MB), then streams the fashion ratings (about 400 MB) and only keeps rows for people who already showed up in music and film. It also streams the metadata files and only keeps titles and categories for items those people touched. Nothing huge is stored.

`backend/bin/prep_amazon.jl` then turns that into a dataset.

* A 4 or 5 star rating counts as "saved". Lower ratings get dropped.
* Then a dense core, repeated until nothing changes. Every person needs at least 2 music saves, 2 fashion saves and 4 film saves. Every item needs at least 4 people (3 for fashion, because fashion items almost never repeat).
* Genre tags come from the Amazon category lists, minus stuff about stores, formats and deals.
* People get split 80 / 10 / 10 into train, validation and test.

What came out

| | count |
|---|---|
| people with 4-5 star ratings in all three layers | 13,087 |
| people after the dense core | 7,553 (6,043 train, 755 val, 755 test) |
| albums | 7,796 items, 62,314 saves, 8.3 per person |
| fashion items | 8,205 items, 45,852 saves, 6.1 per person |
| films and TV | 15,378 items, 126,032 saves, 16.7 per person |
| genre tags | 109 |

Things to keep in mind

* Amazon is about buying stuff, not saving a mood. A CD someone bought for their dad still counts.
* Fashion is really sparse. Out of about 102K fashion items these people rated, 73K were rated by only one of them.
* Fashion items have no titles in our copy. The fashion metadata file is about 4 GB. Run `FASHION_META=1 bash scripts/fetch_amazon.sh` if you want them.
* The data is for research use. Don't put the raw files in the repo (they are in `.gitignore`) and cite Hou et al. (2024) if we report numbers.

## The synthetic maps (for the app)

The real Amazon items are not what the app shows. The app uses a hand-made catalogue with mood tags, like the design prototype. So for the app model we made fake maps on top of that catalogue.

The catalogue is in `data/catalog`, one file per layer, easy to edit.

* `music.txt` has 64 songs
* `visual.txt` has 62 visual saves (30 images and 32 fashion pieces)
* `film.txt` has 75 films and series
* 40 mood tags, the designer's set plus dark, vintage, glam, minimal, cozy, street and nature

`backend/src/synth.jl` makes 5,000 maps. Each map gets

1. a taste mix over 10 archetypes (rainy library, neon night, loud summer and so on), mostly leaning on one or two of them
2. one hidden "scene". Items have scenes too and a scene reaches across layers, so a scene has its songs, its pictures and its films. Tags never show scenes.
3. a popularity bump for some items

Then it picks songs, visual saves and films that score high on all of that, with some randomness.

Why the hidden scenes? Without them, matching tags would explain everything and a graph model would have nothing to learn. With them, the only way to get the scene right is to notice what gets saved together, which is the whole point of the social computing idea in the poster (co-saves as a signal).

Be honest about what this means. Results on synthetic maps show the pipeline works and that the model can pick up co-save patterns. They do not show that real people behave like this. When um!x has real saves from the user test, those should replace the fake maps. `make_synthetic` and `load_amazon` both return the same `Dataset` shape, so a loader for real um!x saves just needs to do the same.
