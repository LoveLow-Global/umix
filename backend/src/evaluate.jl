# The hidden-layer test, plus the baselines we compare against.
#
# For every test person and every layer they have, that whole layer gets hidden. A method sees
# everything else they saved, ranks every item of the hidden layer, and we check where the
# hidden saves landed.
#   ndcg@k    hits near the top count more (1.0 = perfect)
#   recall@k  share of their hidden saves in the top k (out of min(k, how many they have))
#   hit@k     did at least one hidden save make the top k

"every (person, hidden layer `t`) case: what's given (all their other layers) and what's hidden"
hidden_layer_cases(ds::Dataset, people, t::Symbol) = [
    (u = u,
     given = Dict(l => [(i, false) for i in ds.inter[l][u]] for l in LAYERS if l != t && !isempty(ds.inter[l][u])),
     hidden = ds.inter[t][u],
     combo = join([string(l) for l in LAYERS if l != t && !isempty(ds.inter[l][u])], "+"))
    for u in people if !isempty(ds.inter[t][u])]

"ndcg@10, recall@10, hit@10, ndcg@20, recall@20 of one ranking"
function case_metrics(s::AbstractVector, hidden)
    t = Set(hidden)
    top = partialsortperm(s, 1:min(20, length(s)); rev = true)
    out = Dict{String,Float64}()
    for k in (10, 20)
        h, dcg = 0, 0.0
        for (p, i) in enumerate(view(top, 1:min(k, length(top))))
            i in t && (h += 1; dcg += 1 / log2(p + 1))
        end
        out["ndcg@$k"] = dcg / sum(1 / log2(p + 1) for p in 1:min(k, length(t)))
        out["recall@$k"] = h / min(k, length(t))
        k == 10 && (out["hit@10"] = Float64(h > 0))
    end
    out
end
ndcg_at(s::AbstractVector, hidden, k) = case_metrics(s, hidden)["ndcg@$k"]

# ---------- methods ----------

abstract type Scorer end

"the trained network"
struct ScoreModel <: Scorer
    m::Model
    label::String
    Z::Any
end
ScoreModel(m::Model, label = m.name) = ScoreModel(m, label, item_vectors(m))
scores(s::ScoreModel, ds, cases, t) =
    sub_scores(s.m.net, s.m.ps, s.Z, make_sub(s.m.net, ds, [(c.given, c.hidden) for c in cases], t), t)

"how many training people saved each item, the same list for everyone"
struct ScorePopular <: Scorer
    pop::Dict{Symbol,Vector{Float32}}
end
ScorePopular(ds::Dataset) = ScorePopular(Dict(l => Float32.(fans(ds, l, users_in(ds, :train))) for l in LAYERS))
scores(s::ScorePopular, ds, cases, t) = repeat(s.pop[t], 1, length(cases))

"""
Item-kNN across layers: an item scores by how often training people saved it next to each thing
this person gave, scaled like a cosine (co-saves / sqrt(fans of both)). Popularity breaks ties.
"""
struct ScoreKNN <: Scorer
    R::Dict{Symbol,SparseMatrixCSC{Float32,Int}}
    inv::Dict{Symbol,Vector{Float32}}
    pop::Dict{Symbol,Vector{Float32}}
end
function ScoreKNN(ds::Dataset)
    tr = users_in(ds, :train)
    R = Dict(l => interaction_matrix(ds, l, tr) for l in LAYERS)
    f = Dict(l => vec(sum(R[l]; dims = 1)) for l in LAYERS)
    ScoreKNN(R, Dict(l => Float32[x > 0 ? 1 / sqrt(x) : 0 for x in f[l]] for l in LAYERS), f)
end
function scores(s::ScoreKNN, ds, cases, t)
    B = length(cases)
    S = zeros(Float32, size(s.R[t], 2), B)
    for l in LAYERS
        I, J = Int[], Int[]
        for (b, c) in enumerate(cases), (i, _) in get(c.given, l, Tuple{Int,Bool}[])
            push!(I, i); push!(J, b)
        end
        isempty(I) && continue
        X = sparse(I, J, s.inv[l][I], size(s.R[l], 2), B)
        S .+= Matrix(transpose(s.R[t]) * (s.R[l] * X))
    end
    S .* s.inv[t] .+ 1f-7 .* s.pop[t]
end

label(s::ScoreModel) = s.label
label(::ScorePopular) = "Popularity"
label(::ScoreKNN) = "Item-kNN across layers"

# ---------- running the test ----------

"""
    evaluate_all(ds, scorers; split = :test) -> Dict

For each target layer: the cases, and every method's per-case metrics (same cases for all, so
methods can be compared person by person).
"""
function evaluate_all(ds::Dataset, scorers::Vector; split = :test, batch = 2048)
    people = users_in(ds, split)
    res = Dict{Symbol,Any}()
    for t in LAYERS
        cases = hidden_layer_cases(ds, people, t)
        per = Dict{String,Dict{String,Vector{Float64}}}()
        for s in scorers
            m = Dict{String,Vector{Float64}}()
            for part in Iterators.partition(cases, batch)
                S = scores(s, ds, part, t)
                for (b, c) in enumerate(part), (k, v) in case_metrics(view(S, :, b), c.hidden)
                    push!(get!(m, k, Float64[]), v)
                end
            end
            per[label(s)] = m
        end
        res[t] = (cases = cases, per = per)
    end
    res
end

"mean of a metric over the cases whose given layers are `combo` (or all cases)"
function mean_metric(r, method, metric; combo = nothing)
    v = r.per[method][metric]
    idx = combo === nothing ? eachindex(v) : [i for (i, c) in enumerate(r.cases) if c.combo == combo]
    isempty(idx) ? NaN : mean(v[idx])
end

"paired difference of NDCG@10, method a minus b, mean and 95% interval over the same cases"
function paired(r, a, b; metric = "ndcg@10", combo = nothing)
    d = r.per[a][metric] .- r.per[b][metric]
    idx = combo === nothing ? eachindex(d) : [i for (i, c) in enumerate(r.cases) if c.combo == combo]
    x = d[idx]
    m, se = mean(x), std(x) / sqrt(length(x))
    (diff = m, lo = m - 1.96se, hi = m + 1.96se, n = length(x))
end
