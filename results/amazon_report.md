# Hidden-film test, amazon data

Run on 2026-11-16 with 755 test users. Each one only shows their music and visual saves, and we check where their real films land.

```
amazon: 7553 users (6043 train, 755 val, 755 test), 109 tags
  music    7796 items,    62314 saves, 8.3 per user
  visual   8205 items,    45852 saves, 6.1 per user
  film    15378 items,   126032 saves, 16.7 per user
```

| method | recall@10 | ndcg@10 | hit@10 | recall@20 | ndcg@20 | small map recall@10 | small map ndcg@10 |
|---|---|---|---|---|---|---|---|
| Popularity | 0.0121 | 0.0117 | 0.0834 | 0.0173 | 0.0146 | 0.0121 | 0.0117 |
| Tag overlap (prototype engine) | 0.0121 | 0.0117 | 0.0834 | 0.0173 | 0.0146 | 0.0121 | 0.0117 |
| Item-kNN (co-saves) | 0.0068 | 0.0074 | 0.0464 | 0.0074 | 0.0074 | 0.0045 | 0.0041 |
| Multi-layer GCN (ours) | 0.0153 | 0.0152 | 0.1086 | 0.0208 | 0.0174 | 0.0150 | 0.0150 |
| ablation, no graph (hops = 0) | 0.0136 | 0.0129 | 0.0914 | 0.0176 | 0.0147 | 0.0131 | 0.0121 |
| ablation, mean instead of attention | 0.0158 | 0.0154 | 0.1126 | 0.0206 | 0.0174 | 0.0142 | 0.0144 |

small map = at most 3 saves per source layer (music, visual)


Paired check for Multi-layer GCN (ours) on the same test users (full maps). If the interval stays above zero, the gap is bigger than the noise.

* vs Popularity, NDCG@10 difference +0.0035 (95% CI +0.0004 to +0.0066)
* vs Tag overlap (prototype engine), NDCG@10 difference +0.0035 (95% CI +0.0004 to +0.0066)
* vs Item-kNN (co-saves), NDCG@10 difference +0.0078 (95% CI +0.0030 to +0.0126)
* vs ablation, no graph (hops = 0), NDCG@10 difference +0.0023 (95% CI -0.0006 to +0.0053)
* vs ablation, mean instead of attention, NDCG@10 difference -0.0002 (95% CI -0.0015 to +0.0010)

Learned layer weights in the graph are music 0.99, visual 1.02 and film 0.99 (1.00 each would be equal)

Training took 41 seconds with ModelConfig(64, 3, :attention, true, 16)
