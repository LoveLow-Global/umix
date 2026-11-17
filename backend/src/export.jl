# Exporting the trained model as one JSON file, and running it from that file.
#
# The heavy part (the graph propagation) already happened during training, so the file
# only needs the final item vectors plus the small shared user-tower network. That way
# the exact same file runs here in Julia (the API) and in the browser (engine.js), which
# also means the web app can be a static site on Vercel. Both sides use the same math,
# and test/runtests.jl plus scripts/check_parity.mjs check that they agree.

const EXPORT_FORMAT = "umix-mlgcn/1"

rows(M::AbstractMatrix; digits = 5) = [round.(Float64.(M[i, :]); digits) for i in 1:size(M, 1)]
roundv(v; digits = 5) = round.(Float64.(vec(v)); digits)

function export_dict(m::Model; dataset = "", metrics = nothing, match_temperature = 2.0)
    θ = m.θ
    w = layer_weights(θ)
    item_obj(it) = Dict("id" => it.id, "kind" => it.kind, "title" => it.title, "by" => it.by, "tags" => it.tags)
    return Dict(
        "format" => EXPORT_FORMAT,
        "name" => m.name,
        "dataset" => dataset,
        "created" => string(Dates.now()),
        "config" => Dict("dim" => m.cfg.dim, "hops" => m.cfg.hops, "fusion" => String(m.cfg.fusion), "use_tags" => m.cfg.use_tags),
        "layer_weights" => Dict("music" => w[1], "visual" => w[2], "film" => w[3]),
        "tags" => m.tags,
        "items" => Dict(String(d) => item_obj.(m.items[d]) for d in DOMAINS),
        "emb" => Dict(String(d) => rows(m.emb[d]) for d in DOMAINS),
        "film_bias" => roundv(θ.bf),
        "fusion" => Dict("Wa" => rows(θ.Wa), "ba" => roundv(θ.ba), "qa" => roundv(θ.qa),
                         "W1" => rows(θ.W1), "b1" => roundv(θ.b1), "W2" => rows(θ.W2), "b2" => roundv(θ.b2)),
        "match_temperature" => match_temperature,
        "metrics" => metrics,
    )
end

function export_model(path::AbstractString, m::Model; kwargs...)
    mkpath(dirname(path))
    open(path, "w") do io
        JSON3.write(io, export_dict(m; kwargs...))
    end
    return path
end

# ---------- running an exported model ----------

"An exported model loaded back from JSON (Float64, same numbers the browser sees)."
struct ExportedModel
    name::String
    dataset::String
    fusion::Symbol
    items::Dict{Symbol,Vector{Item}}
    index::Dict{String,Tuple{Symbol,Int}}
    emb::Dict{Symbol,Matrix{Float64}}
    bf::Vector{Float64}
    Wa::Matrix{Float64}
    ba::Vector{Float64}
    qa::Vector{Float64}
    W1::Matrix{Float64}
    b1::Vector{Float64}
    W2::Matrix{Float64}
    b2::Vector{Float64}
    layer_weights::Dict{String,Float64}
    temperature::Float64
    metrics::Any
    raw::String
end

tomat(rows) = isempty(rows) ? zeros(0, 0) : permutedims(reduce(hcat, [Float64.(collect(r)) for r in rows]))

function load_exported(path::AbstractString)
    raw = read(path, String)
    o = JSON3.read(raw)
    String(o.format) == EXPORT_FORMAT || error("unknown model format $(o.format)")
    items = Dict(d => [Item(String(x.id), d, String(x.kind), String(x.title), String(x.by), String.(x.tags))
                       for x in o.items[d]] for d in DOMAINS)
    index = Dict{String,Tuple{Symbol,Int}}()
    for d in DOMAINS, (i, it) in enumerate(items[d])
        index[it.id] = (d, i)
    end
    f = o.fusion
    return ExportedModel(String(o.name), String(o.dataset), Symbol(o.config.fusion), items, index,
        Dict(d => tomat(o.emb[d]) for d in DOMAINS), Float64.(o.film_bias),
        tomat(f.Wa), Float64.(f.ba), Float64.(f.qa), tomat(f.W1), Float64.(f.b1), tomat(f.W2), Float64.(f.b2),
        Dict(String(k) => Float64(v) for (k, v) in pairs(o.layer_weights)), Float64(o.match_temperature),
        get(o, :metrics, nothing), raw)
end

"User vector and layer attention for one map, given item indices per source layer."
function user_vector(em::ExportedModel, mus::Vector{Int}, vis::Vector{Int})
    d = size(em.emb[:film], 2)
    P = zeros(2, d)
    mask = zeros(2)
    for (k, (lst, dom)) in enumerate(((mus, :music), (vis, :visual)))
        isempty(lst) && continue
        mask[k] = 1
        P[k, :] = vec(sum(em.emb[dom][lst, :]; dims = 1)) ./ length(lst)
    end
    a = if em.fusion == :attention
        logits = [dot(em.qa, tanh.(transpose(em.Wa) * P[k, :] .+ em.ba)) + (mask[k] - 1) * 1e4 for k in 1:2]
        e = exp.(logits .- maximum(logits))
        e ./ sum(e)
    else
        mask ./ max(sum(mask), 1)
    end
    zbar = a[1] .* P[1, :] .+ a[2] .* P[2, :]
    z = zbar .+ transpose(em.W2) * max.(transpose(em.W1) * zbar .+ em.b1, 0) .+ em.b2
    return z, a
end

film_scores(em::ExportedModel, z) = em.emb[:film] * z .+ em.bf

"Split a list of item ids into music and visual indices (unknown ids and films are left out)."
function source_lists(em::ExportedModel, ids)
    mus, vis = Int[], Int[]
    for id in ids
        haskey(em.index, id) || continue
        d, i = em.index[id]
        d == :music && !(i in mus) && push!(mus, i)
        d == :visual && !(i in vis) && push!(vis, i)
    end
    return mus, vis
end

"""
    recommend(em, ids; k = 12, exclude = String[]) -> Dict

Top films/TV for a map holding `ids`. Each pick says which saved item pushed it up the
most (`because`, found by taking that item out and seeing how much the score drops).
"""
function recommend(em::ExportedModel, ids::AbstractVector; k::Int = 12, exclude = String[])
    mus, vis = source_lists(em, ids)
    z, a = user_vector(em, mus, vis)
    s = film_scores(em, z)
    films = em.items[:film]
    banned = Set(String.(vcat(collect(ids), collect(exclude))))
    order = [f for f in sortperm(s; rev = true) if !(films[f].id in banned)]
    top = order[1:min(k, length(order))]
    smax = isempty(order) ? 0.0 : s[order[1]]
    # leave-one-out: score of each film without each saved item
    sources = vcat([(:music, i) for i in mus], [(:visual, i) for i in vis])
    without = map(sources) do (dom, i)
        m2 = dom == :music ? filter(!=(i), mus) : mus
        v2 = dom == :visual ? filter(!=(i), vis) : vis
        film_scores(em, first(user_vector(em, m2, v2)))
    end
    recs = map(top) do f
        because, shared = nothing, String[]
        if !isempty(sources)
            drops = [s[f] - w[f] for w in without]
            j = argmax(drops)
            src = em.items[sources[j][1]][sources[j][2]]
            because = src.id
            shared = [t for t in films[f].tags if t in src.tags]
        end
        Dict("id" => films[f].id, "score" => round(s[f]; digits = 4),
             "match" => round(clamp(exp((s[f] - smax) / em.temperature), 0.12, 1.0); digits = 3),
             "because" => because, "shared" => shared)
    end
    return Dict("recs" => recs, "weights" => Dict("music" => round(a[1]; digits = 3), "visual" => round(a[2]; digits = 3)),
                "used" => Dict("music" => length(mus), "visual" => length(vis)))
end
