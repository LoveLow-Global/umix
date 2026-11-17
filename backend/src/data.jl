# Data shapes shared by every dataset (synthetic maps or real Amazon users).

"The three graph layers. Music and visual go in, film/TV comes out."
const DOMAINS = (:music, :visual, :film)
const SOURCES = (:music, :visual)
const TARGET = :film

"One thing a person can save. `domain` picks the graph layer, `kind` is just for display."
struct Item
    id::String
    domain::Symbol
    kind::String
    title::String
    by::String
    tags::Vector{String}
end

"""
A multi-domain dataset.

`inter[d][u]` is the list of item indices (inside `items[d]`) that user `u` saved in
domain `d`. A "user" is a person for Amazon and one map for the synthetic data.
`split[u]` is `:train`, `:val` or `:test`. Val and test users never touch the training
graph, which is how the hidden-film test stays honest.
"""
struct Dataset
    name::String
    items::Dict{Symbol,Vector{Item}}
    tags::Vector{String}
    users::Vector{String}
    inter::Dict{Symbol,Vector{Vector{Int}}}
    split::Vector{Symbol}
end

nitems(ds::Dataset, d::Symbol) = length(ds.items[d])
nusers(ds::Dataset) = length(ds.users)
users_in(ds::Dataset, s::Symbol) = findall(==(s), ds.split)

"Index from item id to (domain, index) for quick lookups."
function item_index(ds::Dataset)
    idx = Dict{String,Tuple{Symbol,Int}}()
    for d in DOMAINS, (i, it) in enumerate(ds.items[d])
        idx[it.id] = (d, i)
    end
    return idx
end

"Item-by-tag matrix for one domain, each row scaled to sum to 1 (rows with no tags stay 0)."
function tag_matrix(ds::Dataset, d::Symbol)
    tid = Dict(t => k for (k, t) in enumerate(ds.tags))
    I, J, V = Int[], Int[], Float32[]
    for (i, it) in enumerate(ds.items[d])
        ks = unique([tid[t] for t in it.tags if haskey(tid, t)])
        for k in ks
            push!(I, i); push!(J, k); push!(V, 1f0 / length(ks))
        end
    end
    return sparse(I, J, V, nitems(ds, d), length(ds.tags))
end

"0/1 matrix of `users` (rows, in the given order) by items of domain `d`."
function interaction_matrix(ds::Dataset, d::Symbol, users::AbstractVector{Int})
    I, J = Int[], Int[]
    for (r, u) in enumerate(users), i in ds.inter[d][u]
        push!(I, r); push!(J, i)
    end
    return sparse(I, J, ones(Float32, length(I)), length(users), nitems(ds, d), (a, b) -> 1f0)
end

"Random train/val/test split of user indices."
function random_split(n::Int, rng::AbstractRNG; val = 0.1, test = 0.1)
    p = randperm(rng, n)
    nv, nt = round(Int, val * n), round(Int, test * n)
    s = fill(:train, n)
    s[p[1:nv]] .= :val
    s[p[nv+1:nv+nt]] .= :test
    return s
end

function summary_string(ds::Dataset)
    io = IOBuffer()
    @printf(io, "%s: %d users (%d train, %d val, %d test), %d tags\n", ds.name, nusers(ds),
        length(users_in(ds, :train)), length(users_in(ds, :val)), length(users_in(ds, :test)), length(ds.tags))
    for d in DOMAINS
        n = sum(length, ds.inter[d])
        @printf(io, "  %-6s %6d items, %8d saves, %.1f per user\n", d, nitems(ds, d), n, n / max(1, nusers(ds)))
    end
    return String(take!(io))
end

# ---------- saving and loading (plain JSON so other tools can read it too) ----------

function save_dataset(path::AbstractString, ds::Dataset)
    mkpath(dirname(path))
    obj = Dict(
        "name" => ds.name,
        "tags" => ds.tags,
        "users" => ds.users,
        "split" => String.(ds.split),
        "items" => Dict(String(d) => [Dict("id" => it.id, "kind" => it.kind, "title" => it.title,
            "by" => it.by, "tags" => it.tags) for it in ds.items[d]] for d in DOMAINS),
        "inter" => Dict(String(d) => ds.inter[d] for d in DOMAINS),
    )
    open(path, "w") do io
        JSON3.write(io, obj)
    end
    return path
end

function load_dataset(path::AbstractString)
    o = JSON3.read(read(path, String))
    items = Dict(d => [Item(String(x.id), d, String(x.kind), String(x.title), String(x.by), String.(x.tags))
                       for x in o.items[d]] for d in DOMAINS)
    inter = Dict(d => [Vector{Int}(v) for v in o.inter[d]] for d in DOMAINS)
    return Dataset(String(o.name), items, String.(o.tags), String.(o.users), inter, Symbol.(o.split))
end
