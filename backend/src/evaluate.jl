# The hidden-film test, plus the baselines we compare against.
#
# For every val/test user we only look at their music and visual saves, rank every film,
# and check where their real (hidden) films landed.
#   recall@k  share of their films that made the top k (out of min(k, how many they have))
#   ndcg@k    same idea but a hit near the top counts more
#   hit@k     did at least one of their films make the top k

"""
    ranking_metrics(S, truth; ks = (10, 20)) -> Dict

`S` is users x films, `truth[r]` is the list of real films for row r.
"""
function ranking_metrics(S::AbstractMatrix, truth::AbstractVector; ks = (10, 20))
    nf = size(S, 2)
    out = Dict{String,Float64}()
    rows = [r for r in eachindex(truth) if !isempty(truth[r])]
    tops = [partialsortperm(view(S, r, :), 1:min(maximum(ks), nf); rev = true) for r in rows]
    for k in ks
        rec = ndcg = hit = 0.0
        for (j, r) in enumerate(rows)
            t = Set(truth[r])
            h, dcg = 0, 0.0
            for (pos, f) in enumerate(view(tops[j], 1:min(k, nf)))
                if f in t
                    h += 1
                    dcg += 1 / log2(pos + 1)
                end
            end
            idcg = sum(1 / log2(p + 1) for p in 1:min(k, length(t)))
            rec += h / min(k, length(t))
            ndcg += dcg / idcg
            hit += h > 0
        end
        n = max(1, length(rows))
        out["recall@$k"] = rec / n
        out["ndcg@$k"] = ndcg / n
        out["hit@$k"] = hit / n
    end
    out["users"] = length(rows)
    return out
end

# ---------- scorers: anything that turns music + visual saves into film scores ----------

abstract type Scorer end

"How many training users saved each film."
function film_popularity(ds::Dataset)
    p = zeros(Float32, nitems(ds, :film))
    for u in users_in(ds, :train), f in ds.inter[:film][u]
        p[f] += 1
    end
    return p
end

struct ScorePopular <: Scorer
    pop::Vector{Float32}
end
ScorePopular(ds::Dataset) = ScorePopular(film_popularity(ds))
label(::ScorePopular) = "Popularity"
scores(s::ScorePopular, lm, lv) = repeat(transpose(s.pop), length(lm))

"The designer's fake engine: count shared mood tags, popularity breaks ties."
struct ScoreTags <: Scorer
    Xm::SparseMatrixCSC{Float32,Int}
    Xv::SparseMatrixCSC{Float32,Int}
    Xf::SparseMatrixCSC{Float32,Int}
    pop::Vector{Float32}
end
function ScoreTags(ds::Dataset)
    bin(X) = (Y = copy(X); Y.nzval .= 1; Y)
    p = film_popularity(ds)
    ScoreTags(bin(tag_matrix(ds, :music)), bin(tag_matrix(ds, :visual)), bin(tag_matrix(ds, :film)), p ./ max(1, maximum(p)))
end
label(::ScoreTags) = "Tag overlap (prototype engine)"
function scores(s::ScoreTags, lm, lv)
    Bm = mean_matrix(lm, size(s.Xm, 1)) .> 0
    Bv = mean_matrix(lv, size(s.Xv, 1)) .> 0
    U = Float32.(Bm) * s.Xm .+ Float32.(Bv) * s.Xv      # users x tags, how often each tag shows up
    return Matrix(U * transpose(s.Xf)) .+ 1f-3 .* transpose(s.pop)
end

"Cross-domain item-kNN: films that were saved together with your songs/pictures, cosine scaled."
struct ScoreItemKNN <: Scorer
    Cm::SparseMatrixCSC{Float32,Int}
    Cv::SparseMatrixCSC{Float32,Int}
    pop::Vector{Float32}
end
function ScoreItemKNN(ds::Dataset)
    tr = users_in(ds, :train)
    R = Dict(d => interaction_matrix(ds, d, tr) for d in DOMAINS)
    pf = vec(sum(R[:film]; dims = 1))
    cos(Rs) = begin
        C = transpose(Rs) * R[:film]
        ps = vec(sum(Rs; dims = 1))
        Diagonal(Float32[x > 0 ? 1 / sqrt(x) : 0 for x in ps]) * C * Diagonal(Float32[x > 0 ? 1 / sqrt(x) : 0 for x in pf])
    end
    ScoreItemKNN(cos(R[:music]), cos(R[:visual]), pf ./ max(1, maximum(pf)))
end
label(::ScoreItemKNN) = "Item-kNN (co-saves)"
function scores(s::ScoreItemKNN, lm, lv)
    Bm = Float32.(mean_matrix(lm, size(s.Cm, 1)) .> 0)
    Bv = Float32.(mean_matrix(lv, size(s.Cv, 1)) .> 0)
    return Matrix(Bm * s.Cm .+ Bv * s.Cv) .+ 1f-4 .* transpose(s.pop)
end

struct ScoreModel <: Scorer
    m::Model
end
label(s::ScoreModel) = s.m.name
scores(s::ScoreModel, lm, lv) = first(score_users(s.m, lm, lv))

"""
    evaluate(scorer, ds, users; cap = 0, seed = 0) -> Dict

`cap > 0` keeps at most `cap` saves per source layer, like someone who just made a map.
"""
function evaluate(s::Scorer, ds::Dataset, users::AbstractVector{Int}; cap = 0, seed = 0, batch = 1024)
    rng = MersenneTwister(seed)
    lm = [thin(ds.inter[:music][u], 0, cap, rng) for u in users]
    lv = [thin(ds.inter[:visual][u], 0, cap, rng) for u in users]
    truth = [ds.inter[:film][u] for u in users]
    S = reduce(vcat, [scores(s, lm[r], lv[r]) for r in Iterators.partition(eachindex(users), batch)])
    return ranking_metrics(S, truth)
end

"NDCG@k for each user separately (users with no films are skipped), for paired comparisons."
function per_user_ndcg(s::Scorer, ds::Dataset, users::AbstractVector{Int}; k = 10, batch = 1024)
    us = [u for u in users if !isempty(ds.inter[:film][u])]
    lm = [ds.inter[:music][u] for u in us]
    lv = [ds.inter[:visual][u] for u in us]
    S = reduce(vcat, [scores(s, lm[r], lv[r]) for r in Iterators.partition(eachindex(us), batch)])
    out = zeros(length(us))
    for (r, u) in enumerate(us)
        t = Set(ds.inter[:film][u])
        top = partialsortperm(view(S, r, :), 1:min(k, size(S, 2)); rev = true)
        dcg = sum((f in t) / log2(p + 1) for (p, f) in enumerate(top))
        out[r] = dcg / sum(1 / log2(p + 1) for p in 1:min(k, length(t)))
    end
    return out
end

"""
Paired comparison of two scorers on the same users: mean NDCG@10 difference (a minus b)
with a 95% confidence interval (normal approximation over users).
"""
function paired_difference(a::Scorer, b::Scorer, ds::Dataset, users; k = 10)
    d = per_user_ndcg(a, ds, users; k) .- per_user_ndcg(b, ds, users; k)
    m, se = mean(d), std(d) / sqrt(length(d))
    return Dict("a" => label(a), "b" => label(b), "diff" => m, "lo" => m - 1.96se, "hi" => m + 1.96se, "users" => length(d))
end

"Run every scorer on the test users, with full maps and with small maps."
function evaluate_all(ds::Dataset, scorers::Vector; split = :test, small_cap = 3)
    us = users_in(ds, split)
    rows = Dict{String,Any}[]
    for s in scorers
        full = evaluate(s, ds, us)
        small = evaluate(s, ds, us; cap = small_cap, seed = 11)
        push!(rows, Dict("method" => label(s), "full" => full, "small" => small))
    end
    return rows
end

function metrics_table(rows; small_cap = 3)
    io = IOBuffer()
    println(io, "| method | recall@10 | ndcg@10 | hit@10 | recall@20 | ndcg@20 | small map recall@10 | small map ndcg@10 |")
    println(io, "|---|---|---|---|---|---|---|---|")
    for r in rows
        f, s = r["full"], r["small"]
        @printf(io, "| %s | %.4f | %.4f | %.4f | %.4f | %.4f | %.4f | %.4f |\n", r["method"],
            f["recall@10"], f["ndcg@10"], f["hit@10"], f["recall@20"], f["ndcg@20"], s["recall@10"], s["ndcg@10"])
    end
    println(io, "\nsmall map = at most $small_cap saves per source layer (music, visual)")
    return String(take!(io))
end
