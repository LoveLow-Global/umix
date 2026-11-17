# The model

## Which one we picked

We talked about two options.

1. A multi-layer GNN, where every domain is its own graph layer.
2. One graph where each node carries several features (one per domain), and a small neural network that is the same for every node mixes them.

We ended up doing both in one model, because they fit together pretty naturally. The graph is multi-layer (one layer for music, one for visual and fashion, one for film and TV, with the same user nodes in all three). On top of it, every user's per-layer summaries go through one small shared network that decides how much each layer counts. That shared network is option 2.

It is GCN based. The propagation is the LightGCN version of a GCN (He et al., 2020), which drops the weight matrices and nonlinearities inside the propagation because they mostly hurt for recommendation.

## How it works

```
                 music layer          visual layer          film layer
               songs ── users ──── pictures, clothes ──── users ── films
                          \___________ same user nodes ___________/

step 1  start vectors      e0(item) = id vector + mean of its tag vectors
step 2  propagate K times  user  <- w_music * mean(music items) + w_visual * mean(visual items) + w_film * mean(films)
                           item  <- mean(users who saved it)          (both means are GCN normalized)
                           final item vector = average of rounds 0..K
step 3  new user           p_music  = mean of the final vectors of their saved songs
                           p_visual = mean of the final vectors of their saved pictures and clothes
                           a = softmax over layers of  q . tanh(Wa p + ba)      (attention, same for everyone)
                           z = a_music p_music + a_visual p_visual
                           z = z + W2 relu(W1 z + b1) + b2                       (small residual MLP)
step 4  score              score(film) = z . film vector + film bias
```

A few details that matter

* **Tags are shared across layers.** "night" is one vector whether it is on a song or a film. That gives the model a head start bridging layers, and it also means a brand new item with tags still gets a vector.
* **Normalization per layer.** Each layer is normalized with its own degrees (1 over the square root of user degree times item degree). On top of that the three layer weights `w` are learned (softmax, so they always add up to 3). The poster called this multi-media weighting, so songs that get saved a ton can't drown out films.
* **The user tower is inductive.** New people are never in the graph. We only need the final item vectors, then step 3 runs for anyone. That's why the app can run it in the browser.

## Training (the hidden-film setup)

The app always meets new people. So training copies that.

* Every epoch the training users get cut into 4 parts. One part at a time plays "new users". They are kept out of the graph, their music and visual saves go through the user tower, and their films are the answers. The other 3 parts build the graph.
* Without this the model would cheat. A user's own films would flow into their songs' vectors through the graph, and the model would learn to read them back.
* Some saves of the "new users" get hidden at random (30% on synthetic, 50% on Amazon) so the model also works for small maps.
* Loss is softmax cross entropy over every film (the multinomial likelihood from Mult-VAE, Liang et al., 2018).
* The film bias starts at log popularity, so the model starts out as "recommend popular films" and only has to learn the personal part on top.
* Adam with decoupled weight decay, and we keep the epoch with the best validation NDCG@10.

## The hidden-film test

For every test user we only look at their music and visual saves, rank every film, and check where their real films landed. Test users never touch training.

* recall@k is the share of their films that made the top k (out of k or how many films they have, whichever is smaller)
* ndcg@k is like recall but a hit near the top counts more
* hit@k is whether at least one of their films made the top k
* "small map" means we only show the model 3 saves per layer, like someone who just finished onboarding

Baselines

* Popularity, the most saved films for everyone
* Tag overlap, the design prototype's fake engine (count shared mood tags)
* Item-kNN, films that were saved together with your songs and pictures, cosine scaled

## Results

### Synthetic maps (500 test maps, 75 films)

| method | recall@10 | ndcg@10 | hit@10 | small map ndcg@10 |
|---|---|---|---|---|
| Popularity | 0.253 | 0.238 | 0.874 | 0.238 |
| Tag overlap (prototype engine) | 0.248 | 0.230 | 0.866 | 0.211 |
| Item-kNN (co-saves) | 0.360 | 0.357 | 0.932 | 0.346 |
| **Multi-layer GCN (ours)** | **0.421** | **0.438** | **0.960** | 0.354 |
| ablation, no graph | 0.424 | 0.437 | 0.966 | 0.357 |
| ablation, mean instead of attention | 0.419 | 0.438 | 0.954 | 0.366 |

The GCN beats item-kNN by about 23% on NDCG@10 for full maps and a little on small maps. The prototype's tag matching does about as well as just showing popular films, because tags can't see the hidden scenes. On this data the graph and the attention add basically nothing. Every item here is saved by hundreds of maps, so plain item vectors already learn fine without a graph.

A note on the fake data. My first version made the hidden scenes almost random compared to the mood tags. The GCN still won the test, but its picks looked random to a person (Marie Antoinette for a rainy library map). Since the user test asks people to rate how well each film fits the mood, I made scenes follow the moods (scenes are now sub-moods inside an archetype). Picks look right now, like Little Women and Gilmore Girls for a cozy autumn map, or Drive and Cowboy Bebop for Nightcall.

### Amazon (real people)

755 test people, 15,378 films and series. Full table in `results/amazon_report.md`.

| method | recall@10 | ndcg@10 | hit@10 | small map ndcg@10 |
|---|---|---|---|---|
| Popularity | 0.0121 | 0.0117 | 0.083 | 0.0117 |
| Tag overlap (prototype engine) | 0.0121 | 0.0117 | 0.083 | 0.0117 |
| Item-kNN (co-purchases) | 0.0068 | 0.0074 | 0.046 | 0.0041 |
| **Multi-layer GCN (ours)** | **0.0153** | **0.0152** | **0.109** | **0.0150** |
| ablation, no graph | 0.0136 | 0.0129 | 0.091 | 0.0121 |
| ablation, mean instead of attention | 0.0158 | 0.0154 | 0.113 | 0.0144 |

Paired check on the same test people (NDCG@10, ours minus the other one, with a 95% interval)

* vs popularity, +0.0035 (+0.0004 to +0.0066)
* vs item-kNN, +0.0078 (+0.0030 to +0.0126)
* vs no graph, +0.0023 (-0.0006 to +0.0053)
* vs mean instead of attention, -0.0002 (-0.0015 to +0.0010)

Everything scores way lower than on synthetic data, because there are 15K films and buying a CD is noisy taste data. Tag overlap equals popularity here because Amazon genres are different per layer, so no tags are shared. Item-kNN falls below popularity because co-purchases across layers are super sparse. The GCN is the only method that beats popularity, by about 30%. The graph points the right way on real data (0.0152 vs 0.0129) but that gap is not significant with 755 people, so we can't claim it yet. A bigger test set or a few seeds would settle it.

Settings for Amazon came from a small sweep on the validation set. Three rounds of propagation, 64 dims, learning rate 0.005, 30% save dropout, checking validation every epoch. The model peaks after only 2 to 4 epochs and then overfits, and the popularity warm start was worth about 8% on validation. Different settings landed within about 10% of each other, which is about the same size as the noise between runs, so I stopped tuning there.

## Why the app runs the model in the browser

After training, the graph part is done and baked into the item vectors. What is left for a new map is a few small matrix products. `backend/src/export.jl` writes the item vectors and the user tower weights to one JSON file (about 100 KB for the demo). Then

* `frontend/js/engine.js` runs it in the browser, which works on a static host like Vercel
* `backend/src/server.jl` runs the same file in Julia behind `POST /api/recommend`

`scripts/check_parity.mjs` checks the two agree. Right now 60 out of 60 random maps give the same picks, scores and explanations.

## Explanations

Each pick comes with a `because` item. We take every saved item off the map one at a time and see how much the pick's score drops. The save with the biggest drop is the reason. The app turns it into "People who saved X also kept this", plus any mood tags they share.

## What I'd do next

* Train on real um!x saves from the user test, instead of fake maps
* Let films on a map count as input too (right now only music and visual steer the picks)
* Add maps as their own node type (users, maps, items), like the poster's step 1, once people have more than one map
* For Amazon, try a pretrained text encoder on item titles so new items get decent vectors from day one
* Run the 10 person user test from the poster and compare the ratings with the hidden-film numbers

## References

* He, X., Deng, K., Wang, X., Li, Y., Zhang, Y., & Wang, M. (2020). LightGCN. Simplifying and powering graph convolution network for recommendation. SIGIR 2020.
* Hou, Y., Li, J., He, Z., Yan, A., Chen, X., & McAuley, J. (2024). Bridging language and items for retrieval and recommendation. arXiv 2403.03952 (Amazon Reviews 2023).
* Kipf, T. N., & Welling, M. (2017). Semi-supervised classification with graph convolutional networks. ICLR 2017.
* Liang, D., Krishnan, R. G., Hoffman, M. D., & Jebara, T. (2018). Variational autoencoders for collaborative filtering. WWW 2018.
* Liu, M., Li, J., Li, G., & Pan, P. (2020). Cross domain recommendation via bi-directional transfer graph collaborative filtering networks. CIKM 2020.
* Man, T., Shen, H., Jin, X., & Cheng, X. (2017). Cross-domain recommendation. An embedding and mapping approach. IJCAI 2017.
* Wang, X., Ji, H., Shi, C., Wang, B., Ye, Y., Cui, P., & Yu, P. S. (2019). Heterogeneous graph attention network. WWW 2019.
* Ying, R., He, R., Chen, K., Eksombatchai, P., Hamilton, W. L., & Leskovec, J. (2018). Graph convolutional neural networks for web-scale recommender systems. KDD 2018.
* Zhao, C., Li, C., & Fu, C. (2019). Cross-domain recommendation via preference propagation GraphNet. CIKM 2019.
