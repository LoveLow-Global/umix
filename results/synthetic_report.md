# Hidden-film test, synthetic data

Run on 2026-11-16 with 500 test users. Each one only shows their music and visual saves, and we check where their real films land.

```
synthetic: 5000 users (4000 train, 500 val, 500 test), 40 tags
  music      64 items,    44847 saves, 9.0 per user
  visual     62 items,    34984 saves, 7.0 per user
  film       75 items,    35057 saves, 7.0 per user
```

| method | recall@10 | ndcg@10 | hit@10 | recall@20 | ndcg@20 | small map recall@10 | small map ndcg@10 |
|---|---|---|---|---|---|---|---|
| Popularity | 0.2525 | 0.2382 | 0.8740 | 0.4291 | 0.3222 | 0.2525 | 0.2382 |
| Tag overlap (prototype engine) | 0.2484 | 0.2303 | 0.8660 | 0.4144 | 0.3094 | 0.2227 | 0.2111 |
| Item-kNN (co-saves) | 0.3600 | 0.3571 | 0.9320 | 0.5412 | 0.4427 | 0.3536 | 0.3462 |
| Multi-layer GCN (ours) | 0.4212 | 0.4379 | 0.9600 | 0.5660 | 0.5069 | 0.3564 | 0.3541 |
| ablation, no graph (hops = 0) | 0.4238 | 0.4366 | 0.9660 | 0.5638 | 0.5033 | 0.3601 | 0.3566 |
| ablation, mean instead of attention | 0.4187 | 0.4381 | 0.9540 | 0.5636 | 0.5065 | 0.3677 | 0.3660 |

small map = at most 3 saves per source layer (music, visual)


Paired check for Multi-layer GCN (ours) on the same test users (full maps). If the interval stays above zero, the gap is bigger than the noise.

* vs Popularity, NDCG@10 difference +0.1998 (95% CI +0.1795 to +0.2201)
* vs Tag overlap (prototype engine), NDCG@10 difference +0.2076 (95% CI +0.1878 to +0.2274)
* vs Item-kNN (co-saves), NDCG@10 difference +0.0808 (95% CI +0.0662 to +0.0955)
* vs ablation, no graph (hops = 0), NDCG@10 difference +0.0013 (95% CI -0.0079 to +0.0105)
* vs ablation, mean instead of attention, NDCG@10 difference -0.0002 (95% CI -0.0068 to +0.0064)

Learned layer weights in the graph are music 0.88, visual 1.56 and film 0.55 (1.00 each would be equal)

Training took 29 seconds with ModelConfig(32, 2, :attention, true, 16)
