# Data shapes shared by the whole backend.

"The three layers, in the order used everywhere, including the exported model."
const LAYERS = (:music, :film, :style)

"""
One thing in a layer. An artist (music), a film or series (film), or a brand plus product type (style).

* `id` is a url-safe slug, unique inside its layer
* `sub` is the short line under the name, like "Pop · Country" or "Women's boots"
* `info` holds extra words for search, like top albums, the director, or a product title
* `kind` is Film or Series for film, w (women's), m (men's) or u (anyone) for style, empty for music
* `tags` index into the dataset's tag list for that layer
* `img` is an Amazon image id (or empty), `amazon` the number of Amazon ratings of its products
"""
struct Item
    id::String
    name::String
    sub::String
    info::String
    kind::String
    tags::Vector{Int}
    img::String
    amazon::Int
end

"""
A dataset of people and the things they saved.

* `items[l]` are the graph items of layer `l`, `cold[l]` real items too rare for the graph.
  Cold items can be searched and picked in the app, and count through their tags.
* `chips[l]` are tags the app offers as quick picks (genres, or product types for style).
* `inter[l][u]` lists the item indices person `u` saved in layer `l` (empty if they have no
  saves there). Everyone has saves in at least two layers.
* `split[u]` is `:train`, `:val` or `:test`. Val and test people never touch the training graph.
"""
struct Dataset
    name::String
    items::Dict{Symbol,Vector{Item}}
    cold::Dict{Symbol,Vector{Item}}
    tags::Dict{Symbol,Vector{String}}
    chips::Dict{Symbol,Vector{Int}}
    users::Vector{String}
    inter::Dict{Symbol,Vector{Vector{Int}}}
    split::Vector{Symbol}
end

nitems(ds::Dataset, l::Symbol) = length(ds.items[l])
ntags(ds::Dataset, l::Symbol) = length(ds.tags[l])
nusers(ds::Dataset) = length(ds.users)
users_in(ds::Dataset, s::Symbol) = findall(==(s), ds.split)
layers_of(ds::Dataset, u::Int) = [l for l in LAYERS if !isempty(ds.inter[l][u])]

"Item by tag matrix for one layer, each row scaled to sum to 1 (rows with no tags stay 0)."
function tag_matrix(items::Vector{Item}, ntag::Int)
    I, J, V = Int[], Int[], Float32[]
    for (i, it) in enumerate(items), t in unique(it.tags)
        push!(I, i); push!(J, t); push!(V, 1f0 / length(unique(it.tags)))
    end
    sparse(I, J, V, length(items), ntag)
end
tag_matrix(ds::Dataset, l::Symbol) = tag_matrix(ds.items[l], ntags(ds, l))

"0/1 matrix of `users` (rows, in the given order) by items of layer `l`."
function interaction_matrix(ds::Dataset, l::Symbol, users::AbstractVector{Int})
    I, J = Int[], Int[]
    for (r, u) in enumerate(users), i in ds.inter[l][u]
        push!(I, r); push!(J, i)
    end
    sparse(I, J, ones(Float32, length(I)), length(users), nitems(ds, l), (a, b) -> 1f0)
end

"How many people saved each item of layer `l`, among `users`."
function fans(ds::Dataset, l::Symbol, users = 1:nusers(ds))
    c = zeros(Int, nitems(ds, l))
    for u in users, i in ds.inter[l][u]
        c[i] += 1
    end
    c
end

"Random train/val/test split of `n` people."
function random_split(n::Int, rng::AbstractRNG; val = 0.1, test = 0.1)
    p = randperm(rng, n)
    nv, nt = round(Int, val * n), round(Int, test * n)
    s = fill(:train, n)
    s[p[1:nv]] .= :val
    s[p[nv+1:nv+nt]] .= :test
    s
end

function summary_string(ds::Dataset)
    io = IOBuffer()
    n = nusers(ds)
    println(io, "$(ds.name): $n people ($(count(==(:train), ds.split)) train, $(count(==(:val), ds.split)) val, $(count(==(:test), ds.split)) test)")
    for l in LAYERS
        saves = sum(length, ds.inter[l])
        people = count(!isempty, ds.inter[l])
        @printf(io, "  %-6s %6d items (+%d search only), %5d tags, %8d saves by %6d people, %.1f each\n",
                l, nitems(ds, l), length(ds.cold[l]), ntags(ds, l), saves, people, saves / max(people, 1))
    end
    combos = Dict{String,Int}()
    for u in 1:n
        k = join(string.(layers_of(ds, u)), "+")
        combos[k] = get(combos, k, 0) + 1
    end
    println(io, "  layers per person: ", join(["$k $v" for (k, v) in sort(collect(combos); by = x -> -x[2])], ", "))
    String(take!(io))
end

# ---------- saving ----------

item_dict(it::Item) = Dict("id" => it.id, "name" => it.name, "sub" => it.sub, "info" => it.info, "kind" => it.kind,
                           "tags" => it.tags, "img" => it.img, "amazon" => it.amazon)
item_from(o) = Item(String(o[:id]), String(o[:name]), String(o[:sub]), String(o[:info]), String(o[:kind]), Int.(o[:tags]), String(o[:img]), Int(o[:amazon]))

"""
Saves a dataset. A `.jls` path uses Julia's own binary format (fast, for the big Amazon set,
only readable by Julia 1.12), anything else JSON (slow to load when big, but readable anywhere).
"""
function save_dataset(path::AbstractString, ds::Dataset)
    mkpath(dirname(path))
    endswith(path, ".jls") && (serialize(path, ds); return path)
    d = Dict("name" => ds.name, "users" => ds.users, "split" => string.(ds.split),
             "tags" => Dict(string(l) => ds.tags[l] for l in LAYERS),
             "chips" => Dict(string(l) => ds.chips[l] for l in LAYERS),
             "items" => Dict(string(l) => item_dict.(ds.items[l]) for l in LAYERS),
             "cold" => Dict(string(l) => item_dict.(ds.cold[l]) for l in LAYERS),
             "inter" => Dict(string(l) => ds.inter[l] for l in LAYERS))
    open(io -> JSON3.write(io, d), path, "w")
    path
end

function load_dataset(path::AbstractString)
    endswith(path, ".jls") && return deserialize(path)::Dataset
    o = copy(JSON3.read(read(path, String)))   # plain Dicts and Vectors, much faster to walk
    Dataset(String(o[:name]),
            Dict(l => item_from.(o[:items][l]) for l in LAYERS),
            Dict(l => item_from.(o[:cold][l]) for l in LAYERS),
            Dict(l => String.(o[:tags][l]) for l in LAYERS),
            Dict(l => Int.(o[:chips][l]) for l in LAYERS),
            String.(o[:users]),
            Dict(l => [Int.(v) for v in o[:inter][l]] for l in LAYERS),
            Symbol.(o[:split]))
end
