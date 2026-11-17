# Train the multi-layer GCN, run the hidden-film test against the baselines, export.
#   julia --project=backend backend/bin/train.jl synthetic [--dim 32] [--hops 2] [--epochs 60] [--ablations]
#   julia --project=backend backend/bin/train.jl amazon --dim 64 --epochs 30 --ablations
# Writes results/<data>_report.md, results/<data>_metrics.json and models/<data>.json.
# The synthetic model also gets copied into the apps, frontend/model/ and webpage/public/model/.
include("cli.jl")
using Umix, JSON3, Printf, Dates

opts, pos = parse_args(ARGS)
data = isempty(pos) ? "synthetic" : pos[1]
ds = load_dataset(joinpath(ROOT, "data", "processed", "$data.json"))
print(summary_string(ds))

mcfg = ModelConfig(dim = argint(opts, "dim", 32), hops = argint(opts, "hops", 2),
                   fusion = Symbol(get(opts, "fusion", "attention")), use_tags = !argflag(opts, "no-tags"))
tcfg = TrainConfig(epochs = argint(opts, "epochs", 150), lr = argfloat(opts, "lr", 0.02),
                   batch = argint(opts, "batch", 256), weight_decay = argfloat(opts, "wd", 3e-3),
                   item_drop = argfloat(opts, "drop", 0.3), patience = argint(opts, "patience", 6),
                   eval_every = argint(opts, "eval-every", 5), pop_init = !argflag(opts, "no-pop-init"),
                   seed = argint(opts, "seed", 1))

println("\ntraining the multi-layer GCN  ", mcfg)
t0 = time()
model = train(ds, mcfg, tcfg; name = "Multi-layer GCN (ours)")
train_secs = time() - t0
scorers = Any[ScorePopular(ds), ScoreTags(ds), ScoreItemKNN(ds)]
ablations = []
if argflag(opts, "ablations")
    for (nm, c) in [("  ablation, no graph (hops = 0)", ModelConfig(mcfg.dim, 0, mcfg.fusion, mcfg.use_tags, mcfg.att_hidden)),
                    ("  ablation, mean instead of attention", ModelConfig(mcfg.dim, mcfg.hops, :mean, mcfg.use_tags, mcfg.att_hidden))]
        println("\ntraining", nm)
        push!(ablations, train(ds, c, tcfg; name = strip(nm)))
    end
end
push!(scorers, ScoreModel(model))
append!(scorers, ScoreModel.(ablations))

println("\nhidden-film test on $(length(users_in(ds, :test))) test users")
rows = evaluate_all(ds, scorers)
table = metrics_table(rows)
println(table)
# paired check on the same test users, is the gap bigger than the noise?
te = users_in(ds, :test)
paired = [Umix.paired_difference(scorers[end - length(ablations)], s, ds, te) for s in scorers if s !== scorers[end - length(ablations)]]
pair_lines = [@sprintf("* vs %s, NDCG@10 difference %+.4f (95%% CI %+.4f to %+.4f)", p["b"], p["diff"], p["lo"], p["hi"]) for p in paired]
foreach(println, pair_lines)

mkpath(joinpath(ROOT, "results"))
summary = Dict("data" => data, "date" => string(Dates.today()), "config" => string(mcfg), "train" => string(tcfg),
               "train_seconds" => round(train_secs; digits = 1), "rows" => rows, "paired" => paired,
               "layer_weights" => Umix.layer_weights(model.θ), "history" => model.history)
open(io -> JSON3.write(io, summary), joinpath(ROOT, "results", "$(data)_metrics.json"), "w")
open(joinpath(ROOT, "results", "$(data)_report.md"), "w") do io
    println(io, "# Hidden-film test, $data data\n")
    println(io, "Run on $(Dates.today()) with $(length(users_in(ds, :test))) test users. Each one only shows their music and visual saves, and we check where their real films land.\n")
    println(io, "```\n", summary_string(ds), "```\n")
    println(io, table)
    println(io, "\nPaired check for $(model.name) on the same test users (full maps). If the interval stays above zero, the gap is bigger than the noise.\n")
    foreach(l -> println(io, l), pair_lines)
    w = Umix.layer_weights(model.θ)
    @printf(io, "\nLearned layer weights in the graph are music %.2f, visual %.2f and film %.2f (1.00 each would be equal)\n", w[1], w[2], w[3])
    @printf(io, "\nTraining took %.0f seconds with %s\n", train_secs, string(mcfg))
end

# keep the test numbers inside the exported file so the app can show them
best = rows[findfirst(r -> r["method"] == model.name, rows)]
pop = rows[1]
metrics = Dict("test_users" => best["full"]["users"], "recall@10" => best["full"]["recall@10"], "ndcg@10" => best["full"]["ndcg@10"],
               "popularity_recall@10" => pop["full"]["recall@10"])
path = export_model(joinpath(ROOT, "models", "$data.json"), model; dataset = data, metrics)
println("exported $path")
if data == "synthetic"
    # the app model lives in two places, the plain app (frontend/) and the React site (webpage/)
    for app in (joinpath(ROOT, "frontend", "model", "umix-model.json"), joinpath(ROOT, "webpage", "public", "model", "umix-model.json"))
        isdir(dirname(dirname(app))) || continue
        mkpath(dirname(app))
        cp(path, app; force = true)
        println("copied to $app")
    end
end
