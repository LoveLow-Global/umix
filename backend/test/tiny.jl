# A tiny made-up dataset for the tests, so they run in seconds without the Amazon download.
# People belong to one of a few taste groups, and each group likes its own items in every layer,
# so there is real cross-layer signal for the model to find. Not used by the app.
using Umix, Random
const U = Umix

function tiny_dataset(; people = 800, seed = 3)
    rng = Xoshiro(seed)
    sizes = Dict(:music => 40, :film => 50, :style => 30)
    K, T = 5, 8
    pref = Dict(l => [shuffle(rng, 1:sizes[l])[1:8] for _ in 1:K] for l in LAYERS)
    kinds = Dict(:music => [""], :film => ["Film", "Series"], :style => ["w", "m", "u"])
    mk(l, i, cold) = U.Item(cold ? "$l-cold-$i" : "$l-$i", cold ? "Rare $l $i" : "$(titlecase(string(l))) $i", "", "",
                            rand(rng, kinds[l]), [mod1(i, T), mod1(i + 3, T)], "", cold ? 500 : 0)
    items = Dict(l => [mk(l, i, false) for i in 1:sizes[l]] for l in LAYERS)
    cold = Dict(l => [mk(l, i, true) for i in 1:5] for l in LAYERS)
    inter = Dict(l => [Int[] for _ in 1:people] for l in LAYERS)
    for p in 1:people
        c = rand(rng, 1:K)
        ls = rand(rng) < 0.5 ? collect(LAYERS) : shuffle(rng, collect(LAYERS))[1:2]
        for l in ls
            picks = [rand(rng) < 0.85 ? rand(rng, pref[l][c]) : rand(rng, 1:sizes[l]) for _ in 1:rand(rng, 3:7)]
            inter[l][p] = sort(unique(picks))
        end
    end
    U.Dataset("tiny", items, cold, Dict(l => ["$l tag $k" for k in 1:T] for l in LAYERS), Dict(l => [1, 2, 3, 4] for l in LAYERS),
              ["p$p" for p in 1:people], inter, U.random_split(people, rng))
end
