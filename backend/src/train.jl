# Training with the hidden-film setup.
#
# The app always meets NEW people: someone shows up with songs and pictures, and we have
# to guess films without them being in the graph. So training copies that. Each epoch the
# training users get cut into `folds` parts. One part at a time plays "new users": they
# are kept out of the graph, their music + visual saves go through the user tower, and
# their films are the answers. The other parts make the graph. Without this, a user's
# own films would leak into the item vectors through the graph and the model would cheat.

Base.@kwdef struct TrainConfig
    epochs::Int = 150
    lr::Float64 = 0.02
    weight_decay::Float64 = 3e-3
    batch::Int = 256
    folds::Int = 4
    item_drop::Float64 = 0.3    # hide some saves of the "new users" so small maps work too
    eval_every::Int = 5
    patience::Int = 6           # stop after this many checks without a better val score
    pop_init::Bool = true       # start the film bias at log popularity
    seed::Int = 1
end

"""
    train(ds, mcfg, tcfg; name, log) -> Model

Keeps the parameters with the best validation NDCG@10.
"""
function train(ds::Dataset, mcfg::ModelConfig = ModelConfig(), tcfg::TrainConfig = TrainConfig();
               name = "mlgcn", log = println)
    rng = MersenneTwister(tcfg.seed)
    θ = init_params(rng, ds, mcfg)
    if tcfg.pop_init
        # start the film bias at log popularity, so the model begins as "popular films"
        # and only has to learn what is personal on top of that
        p = Base.log.(film_popularity(ds) .+ 1f0)   # `log` here is the printer keyword
        θ.bf .= p .- sum(p) / length(p)
    end
    X = tag_features(ds)
    opt = Optimisers.setup(Optimisers.AdamW(tcfg.lr, (0.9, 0.999), tcfg.weight_decay), θ)
    tr = users_in(ds, :train)
    va = users_in(ds, :val)
    full = build_graph(ds, tr)
    best = (score = -Inf, θ = deepcopy(θ), epoch = 0)
    bad = 0
    history = Dict{String,Any}[]
    for ep in 1:tcfg.epochs
        t0 = time()
        perm = shuffle(rng, tr)
        parts = [perm[k:tcfg.folds:end] for k in 1:tcfg.folds]
        total, nb = 0.0, 0
        for k in 1:tcfg.folds
            graph_users = reduce(vcat, [parts[j] for j in 1:tcfg.folds if j != k])
            g = build_graph(ds, graph_users)
            for b in Iterators.partition(shuffle(rng, parts[k]), tcfg.batch)
                M, mask = source_input(ds, b; drop = tcfg.item_drop, rng)
                Y = target_matrix(ds, b)
                l, gr = Zygote.withgradient(p -> batch_loss(p, X, g, M, mask, Y, mcfg), θ)
                opt, θ = Optimisers.update!(opt, θ, gr[1])
                total += l
                nb += 1
            end
        end
        rec = Dict{String,Any}("epoch" => ep, "loss" => total / nb, "seconds" => time() - t0)
        if ep % tcfg.eval_every == 0 || ep == tcfg.epochs
            emb = item_embeddings(θ, X, full, mcfg)
            m = Model(name, mcfg, θ, emb, ds.items, ds.tags, history)
            val = evaluate(ScoreModel(m), ds, va)
            rec["val_ndcg@10"] = val["ndcg@10"]
            rec["val_recall@10"] = val["recall@10"]
            if val["ndcg@10"] > best.score
                best = (score = val["ndcg@10"], θ = deepcopy(θ), epoch = ep)
                bad = 0
            else
                bad += 1
            end
            w = layer_weights(θ)
            log(@sprintf("  epoch %3d  loss %.4f  val ndcg@10 %.4f  recall@10 %.4f  layers m/v/f %.2f/%.2f/%.2f  (%.1fs)",
                ep, rec["loss"], val["ndcg@10"], val["recall@10"], w[1], w[2], w[3], rec["seconds"]))
        end
        push!(history, rec)
        bad >= tcfg.patience && (log("  stopping early, best epoch was $(best.epoch)"); break)
    end
    return finalize_model(name, best.θ, ds, mcfg, history)
end
