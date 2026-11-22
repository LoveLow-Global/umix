# Trains the model, runs the hidden-layer test against the baselines, writes the report, and
# exports the files the website runs in the browser.
#   julia --project=backend backend/bin/train.jl [--dim 64] [--hops 2] [--epochs 30] [--lr 0.005]
#        [--batch 1024] [--backend enzyme|mooncake] [--ablations]
# Writes results/amazon_report.md, results/amazon_metrics.json, results/amazon_train.log and
# webpage/public/model/.
include("cli.jl")
using Umix, Printf, JSON3, Dates, Statistics

opts, _ = parse_args(ARGS)
ds = load_dataset(joinpath(ROOT, "data", "processed", "amazon.jls"))
mcfg = ModelConfig(dim = argint(opts, "dim", 64), hops = argint(opts, "hops", 2), att_hidden = argint(opts, "att", 32))
tcfg = TrainConfig(epochs = argint(opts, "epochs", 30), lr = argfloat(opts, "lr", 0.005), batch = argint(opts, "batch", 1024),
                   weight_decay = argfloat(opts, "wd", 1e-4), patience = argint(opts, "patience", 3),
                   backend = Symbol(get(opts, "backend", "enzyme")), seed = argint(opts, "seed", 1))
mkpath(joinpath(ROOT, "results"))
logf = open(joinpath(ROOT, "results", "amazon_train.log"), "w")
log = Tee(stdout, logf)
print(log, summary_string(ds))

t0 = time()
model = train(ds, mcfg, tcfg; log)
secs = time() - t0
scorers = Any[ScorePopular(ds), ScoreKNN(ds)]
if argflag(opts, "ablations")
    short = TrainConfig(tcfg.epochs, tcfg.lr, tcfg.weight_decay, tcfg.batch, tcfg.folds, tcfg.warm, tcfg.drop, tcfg.tagonly,
                        tcfg.eval_every, tcfg.patience, tcfg.val_people, tcfg.seed, tcfg.backend)
    push!(scorers, ScoreModel(train(ds, ModelConfig(mcfg.dim, 0, mcfg.att_hidden, true), short; name = "No graph (hops = 0)", log)))
    push!(scorers, ScoreModel(train(ds, ModelConfig(mcfg.dim, mcfg.hops, mcfg.att_hidden, false), short; name = "Tags only (no item vectors)", log)))
end
push!(scorers, ScoreModel(model))
res = evaluate_all(ds, scorers)
labels = [Umix.label(s) for s in scorers]
ours = model.name

# ---------- report ----------
names = Dict(:music => "music (CDs & Vinyl)", :film => "film and TV (Movies & TV)", :style => "style (Clothing, Shoes & Jewelry)")
io = IOBuffer()
ntest = length(users_in(ds, :test))
println(io, "# Hidden-layer test, Amazon data\n")
println(io, "Run on $(Dates.today()) with $ntest test people. For each layer a test person has, that whole layer is hidden. ",
        "A method sees everything else they saved, ranks every item of the hidden layer, and we check where their hidden saves land. ",
        "Numbers are NDCG@10, higher is better.\n")
println(io, "```\n", summary_string(ds), "```")
metrics = Dict{String,Any}("test_people" => ntest, "targets" => Dict{String,Any}())
for t in LAYERS
    r = res[t]
    combos = sort(unique(c.combo for c in r.cases); by = c -> -count(x -> x.combo == c, r.cases))
    println(io, "\n## Predicting $(names[t])\n")
    println(io, "| given | cases | ", join(labels, " | "), " |")
    println(io, "|---|---|", repeat("---|", length(labels)))
    for c in [combos; nothing]
        n = c === nothing ? length(r.cases) : count(x -> x.combo == c, r.cases)
        row = [@sprintf("%.4f", mean_metric(r, lab, "ndcg@10"; combo = c)) for lab in labels]
        println(io, "| ", c === nothing ? "**all**" : replace(c, "+" => " + "), " | $n | ", join(row, " | "), " |")
    end
    println(io, "\nRecall@10 over all cases: ", join(["$lab $(@sprintf("%.4f", mean_metric(r, lab, "recall@10")))" for lab in labels], ", "), ".\n")
    println(io, "Paired check of $ours on the same cases, NDCG@10 difference with a 95% interval:\n")
    for lab in labels
        lab == ours && continue
        p = paired(r, ours, lab)
        @printf(io, "* vs %s, %+.4f (%+.4f to %+.4f)\n", lab, p.diff, p.lo, p.hi)
    end
    metrics["targets"][string(t)] = Dict{String,Any}(lab => Dict("ndcg@10" => mean_metric(r, lab, "ndcg@10"), "recall@10" => mean_metric(r, lab, "recall@10"),
                                                              "hit@10" => mean_metric(r, lab, "hit@10")) for lab in labels)
    metrics["targets"][string(t)]["cases"] = length(r.cases)
end
w = Umix.layer_weights(model.ps)
@printf(io, "\nLearned layer weights in message passing: music %.2f, film %.2f, style %.2f (1.00 each would be equal).\n", w...)
@printf(io, "\nTraining took %.0f seconds with %s and %s. Best epoch %d.\n", secs, string(mcfg), string(tcfg.backend), model.epoch)
report = String(take!(io))
write(joinpath(ROOT, "results", "amazon_report.md"), report)
print(log, report)
open(io -> JSON3.pretty(io, metrics), joinpath(ROOT, "results", "amazon_metrics.json"), "w")

# ---------- website files ----------
stats = Dict("people" => length(ds.users), "saves" => Dict(string(l) => sum(length, ds.inter[l]) for l in LAYERS),
             "items" => Dict(string(l) => nitems(ds, l) for l in LAYERS))
headline = Dict(string(t) => Dict("ours" => metrics["targets"][string(t)][ours]["ndcg@10"],
                                  "popularity" => metrics["targets"][string(t)]["Popularity"]["ndcg@10"],
                                  "cases" => metrics["targets"][string(t)]["cases"]) for t in LAYERS)
path = export_model(joinpath(ROOT, "webpage", "public", "model"), model, ds; metrics = headline, stats)
println(log, "exported $path")
close(logf)
