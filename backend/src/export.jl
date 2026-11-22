# Writes the files the website runs in the browser (webpage/public/model), and runs them back in
# Julia the exact same way the browser does (webpage/src/lib/engine.js), for the parity check.
#
#   manifest.json   sizes, tag names, chips, test numbers, where each block sits in vectors.bin
#   music.json, film.json, style.json   one catalogue per layer, as columns
#   search.json     real items too rare for the graph (they count through their tags)
#   vectors.bin     item vectors as 8 bit numbers with one scale per item, everything else 32 bit
# Tag and item indices in these files start at 0, like in JavaScript.

const FORMAT = "umix/2"

function catalog_columns(items::Vector{Item}, counts)
    Dict("id" => [x.id for x in items], "name" => [x.name for x in items], "sub" => [x.sub for x in items],
         "info" => [x.info for x in items], "kind" => [x.kind for x in items], "img" => [x.img for x in items],
         "fans" => counts, "tags" => [x.tags .- 1 for x in items])
end

"""
    export_model(dir, m, ds; metrics, stats) -> manifest path

Item vectors come from message passing over all training people.
"""
function export_model(dir::AbstractString, m::Model, ds::Dataset; metrics = nothing, stats = nothing, match_temperature = 2.0)
    mkpath(dir)
    Z = item_vectors(m)
    ps = m.ps
    io = IOBuffer()
    blocks = Dict{String,Any}()
    function block!(name, data::AbstractVector, dtype)
        while position(io) % 4 != 0
            write(io, UInt8(0))
        end
        blocks[name] = Dict("offset" => position(io), "length" => length(data), "dtype" => dtype)
        write(io, data)
    end
    for l in LAYERS
        z = Float32.(Z[l])
        sc = vec(maximum(abs, z; dims = 1)) ./ 127f0
        sc[sc .== 0] .= 1f0
        q = Int8.(clamp.(round.(z ./ reshape(sc, 1, :)), -127, 127))
        block!("Z_$l", vec(q), "i8")
        block!("scale_$l", sc, "f32")
        block!("bias_$l", Float32.(ps.bias[l]), "f32")
        block!("G_$l", vec(Float32.(ps.G[l])), "f32")
        h = ps.heads[l]
        block!("head_$(l)_W1", vec(permutedims(Float32.(h.W1))), "f32")
        block!("head_$(l)_b1", Float32.(h.b1), "f32")
        block!("head_$(l)_W2", vec(permutedims(Float32.(h.W2))), "f32")
        block!("head_$(l)_b2", Float32.(h.b2), "f32")
    end
    block!("att_W", vec(permutedims(Float32.(ps.att.W))), "f32")
    block!("att_b", Float32.(ps.att.b), "f32")
    block!("att_q", Float32.(ps.att.q), "f32")
    write(joinpath(dir, "vectors.bin"), take!(io))

    for l in LAYERS
        open(io -> JSON3.write(io, catalog_columns(ds.items[l], fans(ds, l))), joinpath(dir, "$l.json"), "w")
    end
    search = Dict(string(l) => catalog_columns(ds.cold[l], [x.amazon ÷ 50 for x in ds.cold[l]]) for l in LAYERS)
    open(io -> JSON3.write(io, search), joinpath(dir, "search.json"), "w")

    w = layer_weights(ps)
    manifest = Dict(
        "format" => FORMAT, "name" => m.name, "created" => string(Dates.now()), "dataset" => ds.name,
        "dim" => m.cfg.dim, "hops" => m.cfg.hops, "match_temperature" => match_temperature,
        "layers" => string.(LAYERS),
        "count" => Dict(string(l) => nitems(ds, l) for l in LAYERS),
        "tags" => Dict(string(l) => ds.tags[l] for l in LAYERS),
        "chips" => Dict(string(l) => ds.chips[l] .- 1 for l in LAYERS),
        "layer_weights" => Dict(string(l) => round(Float64(w[i]); digits = 3) for (i, l) in enumerate(LAYERS)),
        "catalog" => Dict(string(l) => "$l.json" for l in LAYERS),
        "search" => "search.json",
        "vectors" => Dict("file" => "vectors.bin", "blocks" => blocks),
        "metrics" => metrics, "stats" => stats)
    path = joinpath(dir, "manifest.json")
    open(io -> JSON3.write(io, manifest), path, "w")
    path
end

# ---------- running the exported files, like the browser ----------

"the exported model, read back from its files"
struct ExportedModel
    manifest::Any
    dim::Int
    temp::Float64
    Z::Dict{Symbol,Matrix{Float64}}       # dim x items (8 bit values times their scale)
    bias::Dict{Symbol,Vector{Float64}}
    G::Dict{Symbol,Matrix{Float64}}       # dim x tags
    heads::Dict{Symbol,NamedTuple}
    att::NamedTuple
    ids::Dict{Symbol,Vector{String}}
    cold_tags::Dict{Symbol,Vector{Vector{Int}}}   # 1-based tag indices of search-only items
end

function load_exported(dir::AbstractString)
    mf = JSON3.read(read(joinpath(dir, "manifest.json"), String))
    bin = read(joinpath(dir, mf.vectors.file))
    d = Int(mf.dim)
    function block(name)
        b = mf.vectors.blocks[Symbol(name)]
        o, n = Int(b.offset), Int(b.length)
        b.dtype == "i8" ? Float64.(reinterpret(Int8, bin[o+1:o+n])) : Float64.(reinterpret(Float32, bin[o+1:o+4n]))
    end
    rowmajor(v, r, c) = permutedims(reshape(v, c, r))
    Z, bias, G, heads, ids, cold = Dict{Symbol,Matrix{Float64}}(), Dict{Symbol,Vector{Float64}}(), Dict{Symbol,Matrix{Float64}}(),
        Dict{Symbol,NamedTuple}(), Dict{Symbol,Vector{String}}(), Dict{Symbol,Vector{Vector{Int}}}()
    search = JSON3.read(read(joinpath(dir, mf.search), String))
    for l in LAYERS
        sc = block("scale_$l")
        Z[l] = reshape(block("Z_$l"), d, :) .* reshape(sc, 1, :)
        bias[l] = block("bias_$l")
        G[l] = reshape(block("G_$l"), d, :)
        heads[l] = (W1 = rowmajor(block("head_$(l)_W1"), d, d), b1 = block("head_$(l)_b1"),
                    W2 = rowmajor(block("head_$(l)_W2"), d, d), b2 = block("head_$(l)_b2"))
        ids[l] = String.(JSON3.read(read(joinpath(dir, mf.catalog[l]), String)).id)
        cold[l] = [Int.(t) .+ 1 for t in search[l].tags]
    end
    h = length(block("att_b"))
    att = (W = rowmajor(block("att_W"), h, d), b = block("att_b"), q = block("att_q"))
    ExportedModel(mf, d, Float64(mf.match_temperature), Z, bias, G, heads, att, ids, cold)
end

"""
vector of one input, like engine.js: (:graph, item) uses the item vector, (:tags, [tags]) the
average of its tag vectors (a search-only item or a genre chip). Indices are 1-based here.
"""
input_vector(em::ExportedModel, l::Symbol, x) =
    x[1] == :graph ? em.Z[l][:, x[2]] : (isempty(x[2]) ? zeros(em.dim) : vec(sum(em.G[l][:, x[2]]; dims = 2)) ./ length(x[2]))

function fuse(em::ExportedModel, sums::Dict{Symbol,Tuple{Vector{Float64},Int}})
    a = Dict(l => 0.0 for l in LAYERS)
    means, sc = Dict{Symbol,Vector{Float64}}(), Dict{Symbol,Float64}()
    for l in LAYERS
        s, n = sums[l]
        n == 0 && continue
        means[l] = s ./ n
        sc[l] = dot(em.att.q, tanh.(em.att.W * means[l] .+ em.att.b))
    end
    z = zeros(em.dim)
    isempty(means) && return z, a
    mx = maximum(values(sc))
    tot = sum(exp(sc[l] - mx) for l in keys(means))
    for l in keys(means)
        a[l] = exp(sc[l] - mx) / tot
        z .+= a[l] .* means[l]
    end
    z, a
end

ehead(em::ExportedModel, l, z) = (h = em.heads[l]; z .+ h.W2 * max.(h.W1 * z .+ h.b1, 0.0) .+ h.b2)

"""
    recommend(em, inputs, layer; k, exclude) -> (picks, weights)

`inputs[l]` lists inputs like (:graph, item) or (:tags, [tags]). Picks are
(i, score, match, because) with because = (layer, n-th input of that layer), like engine.js.
"""
function recommend(em::ExportedModel, inputs::Dict{Symbol,<:AbstractVector}, layer::Symbol; k::Int = 30, exclude = Set{Int}())
    vecs = Dict(l => [input_vector(em, l, x) for x in get(inputs, l, [])] for l in LAYERS)
    sums = Dict(l => (isempty(vecs[l]) ? zeros(em.dim) : sum(vecs[l]), length(vecs[l])) for l in LAYERS)
    z, a = fuse(em, sums)
    u = ehead(em, layer, z)
    s = vec(transpose(em.Z[layer]) * u) .+ em.bias[layer]
    order = sort([i for i in eachindex(s) if !(i in exclude)]; by = i -> (-s[i], i))
    top = order[1:min(end, k)]
    smax = isempty(order) ? 0.0 : s[order[1]]
    because = Dict{Int,Any}()
    total = sum(last(sums[l]) for l in LAYERS)
    if total > 1
        best = Dict{Int,Tuple{Float64,Any}}(i => (-Inf, nothing) for i in top)
        for l in LAYERS, (j, v) in enumerate(vecs[l])
            w = copy(sums)
            w[l] = (sums[l][1] .- v, sums[l][2] - 1)
            u2 = ehead(em, layer, first(fuse(em, w)))
            for i in top
                drop = s[i] - (dot(em.Z[layer][:, i], u2) + em.bias[layer][i])
                drop > best[i][1] && (best[i] = (drop, (l, j)))
            end
        end
        for i in top
            because[i] = best[i][2]
        end
    elseif total == 1
        l = first(x for x in LAYERS if last(sums[x]) == 1)
        for i in top
            because[i] = (l, 1)
        end
    end
    picks = [(i = i, score = s[i], match = clamp(exp((s[i] - smax) / em.temp), 0.12, 1.0), because = get(because, i, nothing)) for i in top]
    picks, a
end
