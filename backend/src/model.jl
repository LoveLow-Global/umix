# The multi-layer GCN.
#
# Graph: users (or maps) in the middle, three item layers around them (music, visual,
# film). A user node is the same node in every layer, so taste can travel from one
# layer to another through the people who saved things in both.
#
# Step 1  start vectors   e0(item) = id vector + mean of its tag vectors (tags are shared
#                         across layers, so "night" means the same thing for a song and a film)
# Step 2  propagate       for k = 1..K
#                           user  <- sum over layers of  w_layer * (normalized mean of its items)
#                           item  <- normalized mean of the users who saved it
#                         final item vector = average of e0..eK (LightGCN style)
#                         w_layer is learned ("multi-media weighting", so songs that get saved a
#                         lot cannot drown out films)
# Step 3  user tower      a NEW user is not in the graph. We average the vectors of what they
#                         saved in each source layer (music, visual), then one small shared
#                         network decides how much each layer counts (attention) and mixes them
#                         (residual MLP). Same network for every node.
# Step 4  score           score(user, film) = user vector . film vector + film bias

Base.@kwdef struct ModelConfig
    dim::Int = 32
    hops::Int = 2                 # GCN rounds on the multi-layer graph, 0 means no graph at all
    fusion::Symbol = :attention   # :attention or :mean
    use_tags::Bool = true
    att_hidden::Int = 16
end

"Normalized multi-layer graph built from a set of users. A is users x items, At is its transpose."
struct LayerGraph{M}
    A::NamedTuple{(:music, :visual, :film),Tuple{M,M,M}}
    At::NamedTuple{(:music, :visual, :film),Tuple{M,M,M}}
end

function build_graph(ds::Dataset, users::AbstractVector{Int})
    mats = map(DOMAINS) do d
        R = interaction_matrix(ds, d, users)
        du = vec(sum(R; dims = 2))
        di = vec(sum(R; dims = 1))
        su = Float32[x > 0 ? 1 / sqrt(x) : 0 for x in du]
        si = Float32[x > 0 ? 1 / sqrt(x) : 0 for x in di]
        An = Diagonal(su) * R * Diagonal(si)
        (An, sparse(transpose(An)))
    end
    A = NamedTuple{DOMAINS}(first.(mats))
    At = NamedTuple{DOMAINS}(last.(mats))
    return LayerGraph(A, At)
end

tag_features(ds::Dataset) = NamedTuple{DOMAINS}(map(d -> tag_matrix(ds, d), DOMAINS))

"""
Sparse (constant) times dense. The default autodiff rule would also build the gradient
for the sparse side as a dense users x items matrix, which blows up on real data. The
graph is fixed, so we only pass the gradient through to the dense side.
"""
spmul(A::SparseMatrixCSC, X::AbstractMatrix) = A * X
function rrule(::typeof(spmul), A::SparseMatrixCSC, X::AbstractMatrix)
    spmul_pullback(Δ) = (NoTangent(), NoTangent(), transpose(A) * unthunk(Δ))
    return A * X, spmul_pullback
end

glorot(rng, a, b) = Float32(sqrt(6 / (a + b))) .* (2 .* rand(rng, Float32, a, b) .- 1)

function init_params(rng::AbstractRNG, ds::Dataset, cfg::ModelConfig)
    d, h = cfg.dim, cfg.att_hidden
    s = 0.1f0
    return (
        E_music = s .* randn(rng, Float32, nitems(ds, :music), d),
        E_visual = s .* randn(rng, Float32, nitems(ds, :visual), d),
        E_film = s .* randn(rng, Float32, nitems(ds, :film), d),
        T = s .* randn(rng, Float32, max(1, length(ds.tags)), d),
        β = zeros(Float32, 3),
        Wa = glorot(rng, d, h), ba = zeros(Float32, 1, h), qa = glorot(rng, h, 1),
        W1 = glorot(rng, d, d), b1 = zeros(Float32, 1, d),
        W2 = 0.1f0 .* glorot(rng, d, d), b2 = zeros(Float32, 1, d),
        bf = zeros(Float32, nitems(ds, :film)),
    )
end

"How much each layer counts when users gather from their items (sums to 3, equal = 1 each)."
layer_weights(θ) = softmax(θ.β) .* 3f0

"Item vectors after K rounds on the graph `g`. Returns (music = n x d, visual = ..., film = ...)."
function item_embeddings(θ, X, g::LayerGraph, cfg::ModelConfig)
    e0m = cfg.use_tags ? θ.E_music .+ spmul(X.music, θ.T) : θ.E_music
    e0v = cfg.use_tags ? θ.E_visual .+ spmul(X.visual, θ.T) : θ.E_visual
    e0f = cfg.use_tags ? θ.E_film .+ spmul(X.film, θ.T) : θ.E_film
    cfg.hops == 0 && return (music = e0m, visual = e0v, film = e0f)
    w = layer_weights(θ)
    cm, cv, cf = e0m, e0v, e0f
    am, av, af = e0m, e0v, e0f
    for _ in 1:cfg.hops
        H = w[1] .* spmul(g.A.music, cm) .+ w[2] .* spmul(g.A.visual, cv) .+ w[3] .* spmul(g.A.film, cf)
        cm = spmul(g.At.music, H)
        cv = spmul(g.At.visual, H)
        cf = spmul(g.At.film, H)
        am = am .+ cm
        av = av .+ cv
        af = af .+ cf
    end
    c = 1f0 / (cfg.hops + 1)
    return (music = am .* c, visual = av .* c, film = af .* c)
end

"""
User tower. `M.music` and `M.visual` are (users x items) matrices whose rows average the
saved items, `mask` is (users x 2) with 1 where the user saved anything in that layer.
Returns the user vectors and the per-layer attention.
"""
function user_vectors(θ, emb, M, mask, cfg::ModelConfig)
    Pm = spmul(M.music, emb.music)
    Pv = spmul(M.visual, emb.visual)
    a = if cfg.fusion == :attention
        sm = tanh.(Pm * θ.Wa .+ θ.ba) * θ.qa
        sv = tanh.(Pv * θ.Wa .+ θ.ba) * θ.qa
        softmax(hcat(sm, sv) .+ (1f0 .- mask) .* -1f4; dims = 2)
    else
        mask ./ max.(sum(mask; dims = 2), 1f0)
    end
    zbar = a[:, 1] .* Pm .+ a[:, 2] .* Pv
    z = zbar .+ relu.(zbar * θ.W1 .+ θ.b1) * θ.W2 .+ θ.b2
    return z, a
end

film_scores(θ, emb, z) = z * transpose(emb.film) .+ transpose(θ.bf)

"Softmax cross-entropy over all films, averaged over the users in the batch."
function batch_loss(θ, X, g, M, mask, Y, cfg)
    emb = item_embeddings(θ, X, g, cfg)
    z, _ = user_vectors(θ, emb, M, mask, cfg)
    S = film_scores(θ, emb, z)
    return -sum(Y .* logsoftmax(S; dims = 2)) / size(S, 1)
end

# ---------- building inputs ----------

"Rows average the listed items: row r has 1/n at each of the n items in lists[r]."
function mean_matrix(lists::AbstractVector{<:AbstractVector{Int}}, n::Int)
    I, J, V = Int[], Int[], Float32[]
    for (r, l) in enumerate(lists), i in l
        push!(I, r); push!(J, i); push!(V, 1f0 / length(l))
    end
    return sparse(I, J, V, length(lists), n)
end

function thin(list::Vector{Int}, drop::Real, cap::Int, rng::AbstractRNG)
    v = list
    if drop > 0 && length(v) > 1
        v = [x for x in v if rand(rng) >= drop]
        isempty(v) && (v = [list[rand(rng, 1:length(list))]])
    end
    if cap > 0 && length(v) > cap
        v = v[randperm(rng, length(v))[1:cap]]
    end
    return v
end

"Source-layer input for some users. `drop` hides saves at random, `cap` keeps at most that many per layer."
function source_input(ds::Dataset, users::AbstractVector{Int}; drop = 0.0, cap = 0, rng = Random.default_rng())
    lm = [thin(ds.inter[:music][u], drop, cap, rng) for u in users]
    lv = [thin(ds.inter[:visual][u], drop, cap, rng) for u in users]
    return source_input(lm, lv, nitems(ds, :music), nitems(ds, :visual))
end
function source_input(lm, lv, nm::Int, nv::Int)
    M = (music = mean_matrix(lm, nm), visual = mean_matrix(lv, nv))
    mask = Float32[isempty(l) ? 0 : 1 for l in hcat(lm, lv)]
    return M, mask
end

"Rows are the users' film lists, scaled to sum to 1."
function target_matrix(ds::Dataset, users::AbstractVector{Int})
    Y = zeros(Float32, length(users), nitems(ds, :film))
    for (r, u) in enumerate(users)
        l = ds.inter[:film][u]
        for f in l
            Y[r, f] = 1f0 / length(l)
        end
    end
    return Y
end

# ---------- trained model ----------

"A trained model plus the item vectors computed on the full training graph."
struct Model
    name::String
    cfg::ModelConfig
    θ::NamedTuple
    emb::NamedTuple
    items::Dict{Symbol,Vector{Item}}
    tags::Vector{String}
    history::Vector{Dict{String,Any}}
end

function finalize_model(name, θ, ds::Dataset, cfg::ModelConfig, history)
    g = build_graph(ds, users_in(ds, :train))
    emb = item_embeddings(θ, tag_features(ds), g, cfg)
    return Model(name, cfg, θ, emb, ds.items, ds.tags, history)
end

"Film scores (users x films) for users given only their music and visual saves."
function score_users(m::Model, lm::AbstractVector, lv::AbstractVector)
    M, mask = source_input(lm, lv, length(m.items[:music]), length(m.items[:visual]))
    z, a = user_vectors(m.θ, m.emb, M, mask, m.cfg)
    return film_scores(m.θ, m.emb, z), a
end
