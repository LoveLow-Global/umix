# Hidden-layer test, Amazon data

Run on 2026-11-22 with 10553 test people. For each layer a test person has, that whole layer is hidden. A method sees everything else they saved, ranks every item of the hidden layer, and we check where their hidden saves land. Numbers are NDCG@10, higher is better.

```
amazon: 105526 people (84420 train, 10553 val, 10553 test)
  music    7087 items (+10000 search only),   189 tags,   420445 saves by  45978 people, 9.1 each
  film    18153 items (+10000 search only),    23 tags,   964007 saves by  90596 people, 10.6 each
  style   11541 items (+10000 search only),  1582 tags,   565306 saves by  84286 people, 6.7 each
  layers per person: film+style 59548, music+film 21240, music+style 14930, music+film+style 9808
```

## Predicting music (CDs & Vinyl)

| given | cases | Popularity | Item-kNN across layers | No graph (hops = 0) | Tags only (no item vectors) | Multi-layer GCN (ours) |
|---|---|---|---|---|---|---|
| film | 2050 | 0.0497 | 0.0408 | 0.0780 | 0.0786 | 0.0860 |
| style | 1529 | 0.0362 | 0.0071 | 0.0393 | 0.0434 | 0.0415 |
| film + style | 1008 | 0.0499 | 0.0463 | 0.0692 | 0.0688 | 0.0695 |
| **all** | 4587 | 0.0452 | 0.0308 | 0.0632 | 0.0647 | 0.0675 |

Recall@10 over all cases: Popularity 0.0470, Item-kNN across layers 0.0314, No graph (hops = 0) 0.0676, Tags only (no item vectors) 0.0681, Multi-layer GCN (ours) 0.0725.

Paired check of Multi-layer GCN (ours) on the same cases, NDCG@10 difference with a 95% interval:

* vs Popularity, +0.0223 (+0.0190 to +0.0256)
* vs Item-kNN across layers, +0.0367 (+0.0333 to +0.0401)
* vs No graph (hops = 0), +0.0044 (+0.0025 to +0.0063)
* vs Tags only (no item vectors), +0.0028 (+0.0007 to +0.0050)

## Predicting film and TV (Movies & TV)

| given | cases | Popularity | Item-kNN across layers | No graph (hops = 0) | Tags only (no item vectors) | Multi-layer GCN (ours) |
|---|---|---|---|---|---|---|
| style | 5966 | 0.0224 | 0.0034 | 0.0232 | 0.0248 | 0.0227 |
| music | 2050 | 0.0140 | 0.0219 | 0.0260 | 0.0240 | 0.0310 |
| music + style | 1008 | 0.0236 | 0.0174 | 0.0322 | 0.0327 | 0.0356 |
| **all** | 9024 | 0.0206 | 0.0092 | 0.0248 | 0.0255 | 0.0260 |

Recall@10 over all cases: Popularity 0.0228, Item-kNN across layers 0.0094, No graph (hops = 0) 0.0276, Tags only (no item vectors) 0.0283, Multi-layer GCN (ours) 0.0288.

Paired check of Multi-layer GCN (ours) on the same cases, NDCG@10 difference with a 95% interval:

* vs Popularity, +0.0054 (+0.0040 to +0.0068)
* vs Item-kNN across layers, +0.0168 (+0.0153 to +0.0184)
* vs No graph (hops = 0), +0.0011 (+0.0002 to +0.0021)
* vs Tags only (no item vectors), +0.0005 (-0.0006 to +0.0016)

## Predicting style (Clothing, Shoes & Jewelry)

| given | cases | Popularity | Item-kNN across layers | No graph (hops = 0) | Tags only (no item vectors) | Multi-layer GCN (ours) |
|---|---|---|---|---|---|---|
| film | 5966 | 0.0475 | 0.0078 | 0.0512 | 0.0518 | 0.0514 |
| music | 1529 | 0.0509 | 0.0106 | 0.0558 | 0.0569 | 0.0572 |
| music + film | 1008 | 0.0680 | 0.0311 | 0.0736 | 0.0722 | 0.0748 |
| **all** | 8503 | 0.0506 | 0.0111 | 0.0547 | 0.0552 | 0.0552 |

Recall@10 over all cases: Popularity 0.0585, Item-kNN across layers 0.0136, No graph (hops = 0) 0.0632, Tags only (no item vectors) 0.0647, Multi-layer GCN (ours) 0.0638.

Paired check of Multi-layer GCN (ours) on the same cases, NDCG@10 difference with a 95% interval:

* vs Popularity, +0.0047 (+0.0030 to +0.0063)
* vs Item-kNN across layers, +0.0441 (+0.0420 to +0.0463)
* vs No graph (hops = 0), +0.0005 (-0.0006 to +0.0017)
* vs Tags only (no item vectors), +0.0001 (-0.0011 to +0.0013)

Learned layer weights in message passing: music 0.97, film 1.15, style 0.88 (1.00 each would be equal).

Training took 380 seconds with ModelConfig(64, 2, 32, true) and enzyme. Best epoch 8.
