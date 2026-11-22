# Training with the hidden-layer setup, which copies what the app does.
#
# Every epoch, the training people get split into folds. The people of one fold play new users.
# They stay out of the graph, and for each of them one layer gets hidden (sometimes only half of
# it), and the model has to find the hidden saves from what's left. The other folds build the graph.

Base.@kwdef struct TrainConfig
    epochs::Int = 30
    lr::Float64 = 0.005
    weight_decay::Float64 = 1e-4
    batch::Int = 1024          # people per target layer in one step
    folds::Int = 4
    warm::Float64 = 0.3        # share of cases that keep half of the target layer as input
    drop::Float64 = 0.2        # each input is dropped with this chance
    tagonly::Float64 = 0.15    # each input is shown only through its tags with this chance
    eval_every::Int = 1
    patience::Int = 3
    val_people::Int = 4000
    seed::Int = 1
    backend::Symbol = :enzyme  # or :mooncake
end

"A trained model: the network, its weights, and the graph of all training people."
struct Model
    net::UmixNet
    ps::Any
    graph::Graph
    cfg::ModelConfig
    name::String
    epoch::Int
end
item_vectors(m::Model) = item_vectors(m.net, m.ps, m.graph)

autodiff_backend(b::Symbol) = b == :enzyme ? AutoEnzyme() : b == :mooncake ? AutoMooncake(; config = nothing) : error("unknown backend $b")

"""
    train(ds, mcfg, tcfg; name, log) -> Model

Fits the network on the training people and keeps the weights with the best NDCG@10 on the
validation people.
"""
function train(ds::Dataset, mcfg::ModelConfig = ModelConfig(), tcfg::TrainConfig = TrainConfig();
               name = "Multi-layer GCN (ours)", log = stdout)
    rng = Xoshiro(tcfg.seed)
    net = UmixNet(ds, mcfg)
    ps, st = Lux.setup(rng, net)
    tr = users_in(ds, :train)
    for l in LAYERS   # start every item's bias at its (centered) log popularity
        p = Base.log.(fans(ds, l, tr) .+ 1f0)
        ps.bias[l] .= p .- mean(p)
    end
    ts = Lux.Training.TrainState(net, ps, st, AdamW(tcfg.lr, (0.9, 0.999), tcfg.weight_decay))
    ad = autodiff_backend(tcfg.backend)
    full = build_graph(ds, tr)
    val = users_in(ds, :val)
    val = val[1:min(end, tcfg.val_people)]
    best, best_ps, best_epoch, bad = -Inf, deepcopy(ts.parameters), 0, 0
    println(log, "training $name with $mcfg, $(length(tr)) training people, $(tcfg.backend)")
    for epoch in 1:tcfg.epochs
        t0, tot, steps = time(), 0.0, 0
        order = shuffle(rng, tr)
        folds = [order[f:tcfg.folds:end] for f in 1:tcfg.folds]
        for f in 1:tcfg.folds
            g = build_graph(ds, reduce(vcat, folds[[k for k in 1:tcfg.folds if k != f]]))
            for chunk in Iterators.partition(folds[f], 3 * tcfg.batch)
                cases = Dict(l => Tuple{Dict{Symbol,Vector{Tuple{Int,Bool}}},Vector{Int}}[] for l in LAYERS)
                for u in chunk
                    t = rand(rng, layers_of(ds, u))
                    warm = rand(rng) < tcfg.warm && length(ds.inter[t][u]) >= 4
                    push!(cases[t], person_case(ds, u, t, rng; cross = !warm, drop = tcfg.drop, tagonly = tcfg.tagonly))
                end
                x = (graph = g, music = make_sub(net, ds, cases[:music], :music), film = make_sub(net, ds, cases[:film], :film),
                     style = make_sub(net, ds, cases[:style], :style))
                _, loss, _, ts = Lux.Training.single_train_step!(ad, batch_loss, x, ts)
                tot += loss
                steps += 1
            end
        end
        @printf(log, "epoch %3d  loss %.4f  (%d steps, %.0f s)\n", epoch, tot / max(steps, 1), steps, time() - t0)
        flush(log)
        if epoch % tcfg.eval_every == 0 || epoch == tcfg.epochs
            score = val_ndcg(net, ts.parameters, ds, full, val)
            @printf(log, "          val ndcg@10 %.4f\n", score)
            if score > best
                best, best_ps, best_epoch, bad = score, deepcopy(ts.parameters), epoch, 0
            else
                bad += 1
                bad >= tcfg.patience && (println(log, "stopping early, best epoch $best_epoch"); break)
            end
        end
    end
    Model(net, best_ps, full, mcfg, name, best_epoch)
end

"mean NDCG@10 over every (person, hidden layer) case of `people`"
function val_ndcg(net::UmixNet, ps, ds::Dataset, g::Graph, people)
    Z = item_vectors(net, ps, g)
    tot, n = 0.0, 0
    for t in LAYERS
        cases = hidden_layer_cases(ds, people, t)
        for part in Iterators.partition(cases, 2048)
            S = sub_scores(net, ps, Z, make_sub(net, ds, [(c.given, c.hidden) for c in part], t), t)
            for (b, c) in enumerate(part)
                tot += ndcg_at(view(S, :, b), c.hidden, 10)
                n += 1
            end
        end
    end
    tot / max(n, 1)
end
