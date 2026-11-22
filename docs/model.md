# The model

A multi-layer graph neural network written in Lux, trained with Enzyme. The code is in `backend/src/model.jl` and `backend/src/train.jl`, and the browser runs the same math in `webpage/src/lib/engine.js`.

## The idea

Taste in one area says something about taste in another. Someone who buys Taylor Swift and watches Little Women probably wears different things than someone who buys Metallica and watches John Wick. The model learns those links from people who saved things in more than one area, then uses them for someone new.

## The graph

One graph with three layers, music, film and style. Items sit in their own layer, and the same people sit in all three. A person is linked to everything they saved.

Each item starts as two things added together.

* its own learned vector of 64 numbers (its ID vector)
* the average of its tag vectors (genres, types, brands)

Then message passing, LightGCN style, runs two rounds. Item vectors go to the people who saved them and back. When vectors go to people, each layer gets a learned weight, so a layer people save a lot in can't drown out the others. Each layer is also normalized on its own. An item's final vector is the average over the rounds. This is how a Taylor Swift fan's clothes end up near Taylor Swift.

## A new person

A new person is never in the graph. That's on purpose, since the app has to work for someone who just showed up.

1. Each thing they gave becomes a vector. An item in the graph uses its final vector. A rare item from the search list, or a genre chip, uses the average of its tag vectors.
2. Their inputs get averaged per layer, so there is one vector for each layer they filled in.
3. Attention mixes those layer vectors. A small shared network scores each layer and a softmax over the given layers turns the scores into weights. This is the "how your layers counted" bar on the map page.
4. Each target layer has a small head (a residual two-layer network) that turns the mix into a taste vector for that layer.
5. An item's score is its vector times the taste vector, plus a popularity bias for that item.

Each pick also says why. We take one input away at a time, and the input whose removal lowers the pick's score the most is the reason ("Because you like Taylor Swift").

## Training

Training copies what the app does. Every epoch, training people get split into 4 folds. One fold plays new people and stays out of the graph. The other three build the graph.

For each new person, one of their layers gets hidden.
* Most of the time the whole layer is hidden. That's the "skip style, we'll guess it" case.
* About 30% of the time only half of it is hidden and the other half is input. That teaches "more like this" picks for a layer they filled in.
* Each input can be dropped (20%) or shown only through its tags (15%). The tags-only part teaches the model to handle rare items and genre chips.

The loss is softmax cross-entropy over every item of the hidden layer, like Mult-VAE. All three target layers train in the same step, so message passing runs once per step. Gradients come from Enzyme through `Lux.Training` (Mooncake also works, `--backend mooncake`). The optimizer is AdamW. Item biases start at their log popularity. Training keeps the weights with the best validation NDCG@10 and stops after 3 epochs without getting better.

## The test

For every test person and every layer they have, that whole layer gets hidden. A method sees everything else they saved and ranks every item of the hidden layer. Then we check where their real saves landed, with NDCG@10, recall@10 and hit@10.

The baselines are
* **popularity**, the same list for everyone
* **item-kNN across layers**, which scores an item by how often training people saved it next to each thing this person gave, scaled like a cosine

With `--ablations` two more versions train. One has no graph (zero rounds of message passing), and one has tags only (no ID vectors). Every comparison is paired on the same cases, with a 95% interval. The latest numbers are in `results/amazon_report.md`.

## In the browser

`backend/src/export.jl` writes `webpage/public/model/`. Item vectors are stored as 8-bit numbers with one scale per item, which keeps the download small. Everything else is 32-bit. The JS engine runs the steps above, and `make parity` checks it gives the same picks, scores, reasons and layer weights as the Julia version.

## References

* He et al. 2020, LightGCN. The message passing.
* Ying et al. 2018, PinSage, and Zhao et al. 2019, PPGN. Graph networks for recommendation across domains.
* Man et al. 2017, EMCDR. Cross-domain cold start, mapping taste from one domain to another.
* Liang et al. 2018, Variational autoencoders for collaborative filtering (Mult-VAE). The multinomial loss.
* Pal 2023, Lux.jl. Moses and Churavy 2020, Enzyme.
* Hou et al. 2024, Bridging language and items for retrieval and recommendation. The Amazon Reviews 2023 dataset.
