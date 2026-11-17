# Synthetic maps for the demo catalogue.
#
# Nobody has released data where the same people saved songs, pictures/fashion AND films
# with mood tags, so for the app we fake it. The fake is built so we know what is going on:
#   * every map has a taste mix over 10 archetypes (like "rainy library" or "neon night")
#   * every map also belongs to one hidden "scene". Items have hidden scenes too, and a
#     scene reaches across domains (it has its songs, its pictures and its films). Tags
#     never show the scene, so the only way to learn it is from what gets saved together.
#   * some items are just more popular
# Tag overlap (the designer's fake engine) can catch the archetype part, popularity
# catches the popular part, and only a collaborative model (item-kNN or the GCN) can
# pick up the scenes. So if the GCN wins here, it won by learning from co-saves.

const ARCHETYPES = [
    ("rainy library", "rain quiet literary cafe calm melancholy cozy autumn"),
    ("neon night", "neon night city longing slow dark"),
    ("loud summer", "loud energy summer rock youth sea street"),
    ("slow and tender", "quiet slow tender memory everyday minimal calm"),
    ("dreamy", "dream fantasy warm nature tender quirky"),
    ("coming of age", "youth talky city quirky romance summer"),
    ("golden hour", "dusk romance warm longing summer travel"),
    ("wide open", "desert epic travel energy nature"),
    ("analog heart", "analog vintage memory warm storytelling autumn"),
    ("dark glam", "dark glam night melancholy neon energy"),
]

Base.@kwdef struct SynthConfig
    n_maps::Int = 5000
    n_scenes::Int = 16
    dirichlet::Float64 = 0.35       # lower means a map leans on fewer archetypes
    w_taste::Float64 = 4.0          # weight of the archetype / tag match
    w_scene::Float64 = 2.2          # weight of the hidden scene
    w_pop::Float64 = 0.5            # weight of popularity
    scene_sharpness::Float64 = 10.0 # how much an item's scene follows its tags (high = scenes are sub-moods)
    scene_follow::Float64 = 0.7     # chance a map's scene comes from its main archetype
    min_saves = (music = 4, visual = 3, film = 3)
    mean_extra = (music = 5.0, visual = 4.0, film = 4.0)
    val::Float64 = 0.1
    test::Float64 = 0.1
    seed::Int = 7
end

# small samplers so we do not need Distributions.jl
function randgamma(rng::AbstractRNG, a::Float64)
    a < 1 && return randgamma(rng, a + 1) * rand(rng)^(1 / a)
    d = a - 1 / 3
    c = 1 / sqrt(9d)
    while true
        x = randn(rng)
        v = (1 + c * x)^3
        v <= 0 && continue
        u = rand(rng)
        log(u) < 0.5x^2 + d - d * v + d * log(v) && return d * v
    end
end
function randdirichlet(rng::AbstractRNG, a::Float64, k::Int)
    g = [randgamma(rng, a) for _ in 1:k]
    return g ./ sum(g)
end
function randpoisson(rng::AbstractRNG, λ::Float64)
    L, k, p = exp(-λ), 0, 1.0
    while true
        p *= rand(rng)
        p < L && return k
        k += 1
    end
end
gumbel(rng::AbstractRNG) = -log(-log(rand(rng) + 1e-12) + 1e-12)
function sample_categorical(rng::AbstractRNG, w::AbstractVector)
    r = rand(rng) * sum(w)
    for (i, x) in enumerate(w)
        r -= x
        r <= 0 && return i
    end
    return length(w)
end

"Unit-length tag vector for a list of tags."
function tagvec(tags::Vector{String}, tid::Dict{String,Int})
    v = zeros(length(tid))
    for t in tags
        haskey(tid, t) && (v[tid[t]] = 1.0)
    end
    n = norm(v)
    return n > 0 ? v ./ n : v
end

"""
    make_synthetic(catalog_dir; cfg = SynthConfig()) -> (Dataset, truth)

`truth` keeps the hidden scenes and archetype mixes, only for checking things later.
"""
function make_synthetic(catalog_dir::AbstractString; cfg::SynthConfig = SynthConfig())
    rng = MersenneTwister(cfg.seed)
    items = load_catalog(catalog_dir)
    tags = catalog_tags(items)
    tid = Dict(t => k for (k, t) in enumerate(tags))
    A = length(ARCHETYPES)
    arch = [tagvec(String.(split(s)), tid) for (_, s) in ARCHETYPES]

    # how well each item fits each archetype (cosine of tag vectors)
    aff = Dict(d => [dot(tagvec(it.tags, tid), arch[a]) for it in items[d], a in 1:A] for d in DOMAINS)
    pop = Dict(d => randn(rng, length(items[d])) for d in DOMAINS)

    # scenes: scene s lives next to archetype home[s]; an item's scene leans toward its tags
    home = [((s - 1) % A) + 1 for s in 1:cfg.n_scenes]
    scene = Dict(d => [sample_categorical(rng, [exp(cfg.scene_sharpness * aff[d][i, home[s]]) for s in 1:cfg.n_scenes])
                       for i in 1:length(items[d])] for d in DOMAINS)

    users = String[]
    inter = Dict(d => Vector{Vector{Int}}() for d in DOMAINS)
    mixes = Vector{Vector{Float64}}()
    map_scene = Int[]
    for m in 1:cfg.n_maps
        π_m = randdirichlet(rng, cfg.dirichlet, A)
        if rand(rng) < cfg.scene_follow
            a = sample_categorical(rng, π_m)
            options = findall(==(a), home)
            sc = options[rand(rng, 1:length(options))]
        else
            sc = rand(rng, 1:cfg.n_scenes)
        end
        for d in DOMAINS
            n = min(length(items[d]), cfg.min_saves[d] + randpoisson(rng, cfg.mean_extra[d]))
            util = [cfg.w_taste * dot(view(aff[d], i, :), π_m) + cfg.w_scene * (scene[d][i] == sc) +
                    cfg.w_pop * pop[d][i] + gumbel(rng) for i in 1:length(items[d])]
            push!(inter[d], sort!(partialsortperm(util, 1:n; rev = true)))
        end
        push!(users, @sprintf("map%05d", m))
        push!(mixes, π_m)
        push!(map_scene, sc)
    end
    parts = random_split(cfg.n_maps, rng; val = cfg.val, test = cfg.test)
    ds = Dataset("synthetic", items, tags, users, inter, parts)
    truth = (scene = scene, map_scene = map_scene, mixes = mixes, popularity = pop, archetypes = first.(ARCHETYPES))
    return ds, truth
end
