# The multi-layer graph network, written as a Lux layer and trained with Enzyme.
#
# Items of the three layers share one graph through the people who saved them. Each round of
# message passing (LightGCN style) moves item vectors to people and back, with a learned weight
# per layer, so taste can travel from songs to clothes through people who saved both.
# A new person is never in the graph. We average the vectors of what they gave per layer, mix the
# layers they gave with attention, and a small head per target layer turns that into a taste
# vector. A score is the dot product with an item's vector, plus that item's popularity bias.
# webpage/src/lib/engine.js does the exact same math in the browser.

Base.@kwdef struct ModelConfig
    dim::Int = 64
    hops::Int = 2
    att_hidden::Int = 32
    use_ids::Bool = true      # false: items are only their tags (an ablation)
end

const LayerMats = NamedTuple{LAYERS,NTuple{3,SparseMatrixCSC{Float32,Int}}}
per_layer(f) = NamedTuple{LAYERS}(map(f, LAYERS))

"The graph: normalized person-by-item matrices `A` (and transposes `At`) of the graph people, per layer."
struct Graph
    A::LayerMats
    At::LayerMats
end

"""
Builds the graph of `users`. Each layer is normalized on its own (D_person^-1/2 R D_item^-1/2),
so a layer people save a lot in can't drown out the others.
"""
function build_graph(ds::Dataset, users::AbstractVector{Int})
    A = per_layer() do l
        R = interaction_matrix(ds, l, users)
        du, di = vec(sum(R; dims = 2)), vec(sum(R; dims = 1))
        su = Float32[d > 0 ? 1 / sqrt(d) : 0 for d in du]
        si = Float32[d > 0 ? 1 / sqrt(d) : 0 for d in di]
        sparse(Diagonal(su) * R * Diagonal(si))
    end
    Graph(A, per_layer(l -> sparse(transpose(A[l]))))
end

"The network. `XT` holds each layer's tags-by-items matrix (each item's tags sum to 1)."
struct UmixNet <: Lux.AbstractLuxLayer
    n::NamedTuple{LAYERS,NTuple{3,Int}}
    nt::NamedTuple{LAYERS,NTuple{3,Int}}
    XT::LayerMats
    cfg::ModelConfig
end

function UmixNet(ds::Dataset, cfg::ModelConfig)
    UmixNet(per_layer(l -> nitems(ds, l)), per_layer(l -> ntags(ds, l)),
            per_layer(l -> sparse(transpose(tag_matrix(ds, l)))), cfg)
end

function Lux.initialparameters(rng::AbstractRNG, m::UmixNet)
    d, h = m.cfg.dim, m.cfg.att_hidden
    r(a...) = 0.1f0 .* randn(rng, Float32, a...)
    g(o, i) = sqrt(2f0 / (o + i)) .* randn(rng, Float32, o, i)
    (E = per_layer(l -> r(d, m.n[l])),
     G = per_layer(l -> r(d, m.nt[l])),
     β = zeros(Float32, 3),
     att = (W = g(h, d), b = zeros(Float32, h), q = r(h)),
     heads = per_layer(l -> (W1 = g(d, d), b1 = zeros(Float32, d), W2 = 0.01f0 .* randn(rng, Float32, d, d), b2 = zeros(Float32, d))),
     bias = per_layer(l -> zeros(Float32, m.n[l])))
end
Lux.initialstates(::AbstractRNG, ::UmixNet) = NamedTuple()

"how much each layer counts in message passing (3 x softmax, so 1.0 each would be equal)"
layer_weights(ps) = 3f0 .* softmax(ps.β)

"each layer's starting item vectors: ID vector plus tag vectors"
base_vectors(m::UmixNet, ps) = (
    music = m.cfg.use_ids ? ps.E.music .+ ps.G.music * m.XT.music : ps.G.music * m.XT.music,
    film = m.cfg.use_ids ? ps.E.film .+ ps.G.film * m.XT.film : ps.G.film * m.XT.film,
    style = m.cfg.use_ids ? ps.E.style .+ ps.G.style * m.XT.style : ps.G.style * m.XT.style)

"item vectors after `hops` rounds of message passing over the graph (the mean over all rounds)"
function item_vectors(m::UmixNet, ps, g::Graph)
    e = base_vectors(m, ps)
    m.cfg.hops == 0 && return e
    w = layer_weights(ps)
    cur, acc = e, e
    for _ in 1:m.cfg.hops
        H = w[1] .* (cur.music * g.At.music) .+ w[2] .* (cur.film * g.At.film) .+ w[3] .* (cur.style * g.At.style)
        cur = (music = H * g.A.music, film = H * g.A.film, style = H * g.A.style)
        acc = (music = acc.music .+ cur.music, film = acc.film .+ cur.film, style = acc.style .+ cur.style)
    end
    k = Float32(m.cfg.hops + 1)
    (music = acc.music ./ k, film = acc.film ./ k, style = acc.style ./ k)
end

"""
A batch of people for one target layer.
* `M[l]` (items x people) and `Q[l]` (tags x people) hold what each person gave in layer `l`.
  Items in the graph go in `M`, items shown only by their tags go in `Q`. A person's weights in
  one layer add up to 1, so their layer vector is the average of what they gave.
* `mask` (3 x people) says which layers each person gave anything in.
* `yidx` and `yw` point at the hidden saves inside the (items x people) score matrix.
"""
struct Sub
    M::LayerMats
    Q::LayerMats
    mask::Matrix{Float32}
    yidx::Vector{Int}
    yw::Vector{Float32}
    n::Int
end

"one taste vector per person (dim x people), before the target head"
function person_vectors(m::UmixNet, ps, Z, s::Sub)
    p1 = Z.music * s.M.music .+ ps.G.music * s.Q.music
    p2 = Z.film * s.M.film .+ ps.G.film * s.Q.film
    p3 = Z.style * s.M.style .+ ps.G.style * s.Q.style
    a = ps.att
    sc(p) = transpose(a.q) * tanh.(a.W * p .+ a.b)
    S = vcat(sc(p1), sc(p2), sc(p3)) .+ (1f0 .- s.mask) .* -1f4
    α = softmax(S; dims = 1)
    α[1:1, :] .* p1 .+ α[2:2, :] .* p2 .+ α[3:3, :] .* p3
end

"the target layer's head: u = z + W2 relu(W1 z + b1) + b2"
head(hp, z) = z .+ hp.W2 * relu.(hp.W1 * z .+ hp.b1) .+ hp.b2

"scores of every item of the target layer (items x people)"
target_scores(Zt, bias, hp, z) = transpose(Zt) * head(hp, z) .+ bias

function sub_loss(m::UmixNet, ps, Z, s::Sub, Zt, bias, hp)
    S = target_scores(Zt, bias, hp, person_vectors(m, ps, Z, s))
    -sum(logsoftmax(S; dims = 1)[s.yidx] .* s.yw)
end

"""
The training loss of one step: softmax cross-entropy of the hidden saves, for the three target
layers together, so message passing runs once per step.
"""
function batch_loss(m::UmixNet, ps, st, x)
    Z = item_vectors(m, ps, x.graph)
    l1 = x.music.n > 0 ? sub_loss(m, ps, Z, x.music, Z.music, ps.bias.music, ps.heads.music) : 0f0
    l2 = x.film.n > 0 ? sub_loss(m, ps, Z, x.film, Z.film, ps.bias.film, ps.heads.film) : 0f0
    l3 = x.style.n > 0 ? sub_loss(m, ps, Z, x.style, Z.style, ps.bias.style, ps.heads.style) : 0f0
    (l1 + l2 + l3) / max(1, x.music.n + x.film.n + x.style.n), st, NamedTuple()
end

# ---------- building batches ----------

"""
What one person gives the model for one target layer.
`cross` hides the whole target layer. Otherwise half of it stays as input (warm picks).
`drop` drops inputs at random, `tagonly` shows some inputs only through their tags (like a rare
item or a genre chip in the app), `hidden` returns the saves to predict.
"""
function person_case(ds::Dataset, u::Int, t::Symbol, rng; cross = true, drop = 0.0, tagonly = 0.0)
    given = Dict{Symbol,Vector{Tuple{Int,Bool}}}()      # layer => (item, shown only by tags)
    hidden = ds.inter[t][u]
    for l in LAYERS
        items = copy(ds.inter[l][u])
        if l == t
            cross && continue
            shuffle!(rng, items)
            k = length(items) ÷ 2
            hidden, items = items[k+1:end], items[1:k]
        end
        keep = [i for i in items if rand(rng) >= drop]
        isempty(keep) && !isempty(items) && push!(keep, rand(rng, items))
        isempty(keep) || (given[l] = [(i, rand(rng) < tagonly && !isempty(ds.items[l][i].tags)) for i in keep])
    end
    given, hidden
end

"packs people's cases for target `t` into a Sub"
function make_sub(m::UmixNet, ds::Dataset, cases, t::Symbol)
    B = length(cases)
    mats = Dict{Symbol,Tuple{SparseMatrixCSC{Float32,Int},SparseMatrixCSC{Float32,Int}}}()
    mask = zeros(Float32, 3, B)
    for (li, l) in enumerate(LAYERS)
        I, J, V, TI, TJ, TV = Int[], Int[], Float32[], Int[], Int[], Float32[]
        XT = m.XT[l]
        for (b, (given, _)) in enumerate(cases)
            g = get(given, l, nothing)
            (g === nothing || isempty(g)) && continue
            mask[li, b] = 1
            w = 1f0 / length(g)
            for (i, tagsonly) in g
                if tagsonly
                    for k in nzrange(XT, i)
                        push!(TI, rowvals(XT)[k]); push!(TJ, b); push!(TV, w * nonzeros(XT)[k])
                    end
                else
                    push!(I, i); push!(J, b); push!(V, w)
                end
            end
        end
        mats[l] = (sparse(I, J, V, m.n[l], B), sparse(TI, TJ, TV, m.nt[l], B))
    end
    yidx, yw = Int[], Float32[]
    for (b, (_, hidden)) in enumerate(cases), i in hidden
        push!(yidx, (b - 1) * m.n[t] + i)
        push!(yw, 1f0 / length(hidden))
    end
    Sub(per_layer(l -> mats[l][1]), per_layer(l -> mats[l][2]), mask, yidx, yw, B)
end

"scores (items x people) of target `t` for a Sub, no gradients"
function sub_scores(m::UmixNet, ps, Z, s::Sub, t::Symbol)
    target_scores(Z[t], ps.bias[t], ps.heads[t], person_vectors(m, ps, Z, s))
end
