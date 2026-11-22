# Real data: Amazon Reviews 2023 (Hou et al., 2024, McAuley Lab, UCSD).
#   music = CDs & Vinyl, film = Movies & TV, style = Clothing, Shoes & Jewelry
# scripts/fetch_amazon.sh keeps people who rated things in at least two of the three.
# Here a 4 or 5 star rating counts as a save, products become entities (entities.jl), and a
# dense core keeps people with enough saves in at least two layers and items with enough fans.

const AMAZON_FILES = Dict(
    :music => ("CDs_and_Vinyl.2plus.csv.gz", "meta_CDs_and_Vinyl.compact.jsonl.gz"),
    :film => ("Movies_and_TV.2plus.csv.gz", "meta_Movies_and_TV.compact.jsonl.gz"),
    :style => ("Clothing_Shoes_and_Jewelry.2plus.csv.gz", "meta_Clothing_Shoes_and_Jewelry.compact.jsonl.gz"))

function gz_lines(f::Function, path::AbstractString)
    open(path) do io
        f(eachline(GzipDecompressorStream(io)))
    end
end

"person => entity keys they saved (4 or 5 stars) in one layer"
function read_saves(path::AbstractString, products::Dict{String,Product}; min_rating = 4.0)
    out = Dict{String,Set{String}}()
    gz_lines(path) do lines
        head = true
        for line in lines
            head && (head = false; continue)
            p = split(line, ',')
            length(p) >= 3 || continue
            r = tryparse(Float64, p[3])
            (r === nothing || r < min_rating) && continue
            prod = get(products, p[2], nothing)
            prod === nothing && continue
            push!(get!(Set{String}, out, String(p[1])), prod.key)
        end
    end
    out
end

"""
Dense core over the three layers. Items with too few fans go, a person's layer goes if they saved
too little there, and people left with fewer than two layers go. Repeats until nothing changes.
"""
function dense_core!(saves::Dict{Symbol,Dict{String,Set{String}}}; min_fans, min_user)
    while true
        changed = false
        for l in LAYERS
            fans = Dict{String,Int}()
            for s in values(saves[l]), k in s
                fans[k] = get(fans, k, 0) + 1
            end
            for s in values(saves[l])
                n0 = length(s)
                filter!(k -> fans[k] >= min_fans[l], s)
                changed |= length(s) != n0
            end
            for (u, s) in collect(saves[l])
                length(s) < min_user[l] && (delete!(saves[l], u); changed = true)
            end
        end
        layers = Dict{String,Int}()
        for l in LAYERS, u in keys(saves[l])
            layers[u] = get(layers, u, 0) + 1
        end
        for l in LAYERS, u in collect(keys(saves[l]))
            layers[u] < 2 && (delete!(saves[l], u); changed = true)
        end
        changed || return saves
    end
end

"which tags can be chips in the app: main music genres, film genres, style product types"
chip_kind(l::Symbol, styletypes) = l == :music ? (t -> t in MUSIC_GENRES) :
    l == :film ? (t -> t in values(FILM_GENRE) && !(t in FILM_SKIP)) : (t -> t in styletypes && !(t in STYLE_GROUPS))

"""
    load_amazon(raw_dir; ...) -> Dataset

Builds the dataset from the files scripts/fetch_amazon.sh made. `max_cold` caps the search-only
items per layer (the most rated on Amazon are kept).
"""
function load_amazon(raw_dir::AbstractString; min_rating = 4.0, min_fans = (music = 10, film = 12, style = 10),
                     min_user = (music = 2, film = 3, style = 2), max_cold = 10_000, min_tag = 3, seed = 7, log = stdout)
    prods, ents, saves = Dict{Symbol,Dict{String,Product}}(), Dict{Symbol,Dict{String,Entity}}(), Dict{Symbol,Dict{String,Set{String}}}()
    for l in LAYERS
        ratings, meta = AMAZON_FILES[l]
        prods[l] = read_products(joinpath(raw_dir, meta), l)
        ents[l] = entities(prods[l])
        saves[l] = read_saves(joinpath(raw_dir, ratings), prods[l]; min_rating)
        println(log, "$l: $(length(prods[l])) products become $(length(ents[l])) entities, ",
                "$(sum(length, values(saves[l]); init = 0)) saves by $(length(saves[l])) people")
    end
    dense_core!(saves; min_fans, min_user)
    users = sort(unique(reduce(vcat, [collect(keys(saves[l])) for l in LAYERS])))
    uidx = Dict(u => i for (i, u) in enumerate(users))
    styletypes = Set(p.tags[1] for p in values(prods[:style]) if !isempty(p.tags))

    items, cold, tags, chips, inter = Dict{Symbol,Vector{Item}}(), Dict{Symbol,Vector{Item}}(), Dict{Symbol,Vector{String}}(),
        Dict{Symbol,Vector{Int}}(), Dict{Symbol,Vector{Vector{Int}}}()
    for l in LAYERS
        fans = Dict{String,Int}()
        for s in values(saves[l]), k in s
            fans[k] = get(fans, k, 0) + 1
        end
        graph = sort(collect(keys(fans)); by = k -> (-fans[k], k))
        ingraph = Set(graph)
        rest = [e for e in values(ents[l]) if !(e.key in ingraph) && !isempty(entity_tags(e))]
        sort!(rest; by = e -> (-e.amazon, e.key))
        rest = rest[1:min(end, max_cold)]

        # tags used by enough entities, plus brand names that cover more than one style item
        etags = Dict(e.key => entity_tags(e) for e in [[ents[l][k] for k in graph]; rest])
        if l == :style
            brands = Dict{String,Int}()
            for k in graph
                b = display_name(ents[l][k].names)
                brands[b] = get(brands, b, 0) + 1
            end
            for (k, t) in etags
                b = display_name(ents[l][k].names)
                get(brands, b, 0) >= 2 && push!(t, b)
            end
        end
        tcount = Dict{String,Int}()
        for t in values(etags), x in t
            tcount[x] = get(tcount, x, 0) + 1
        end
        vocab = sort([t for (t, c) in tcount if c >= min_tag]; by = t -> (-tcount[t], t))
        tid = Dict(t => i for (i, t) in enumerate(vocab))
        tags[l] = vocab
        ischip = chip_kind(l, styletypes)
        chips[l] = [tid[t] for t in vocab if ischip(t)][1:min(end, 24)]

        taken = Set{String}()
        function make(e::Entity)
            name = display_name(e.names)
            base = l == :style ? slugify(string(name, " ", top(e.subs))) : slugify(name)
            isempty(base) && (base = "item")
            id, k = base, 1
            while id in taken
                k += 1
                id = "$base-$k"
            end
            push!(taken, id)
            et = etags[e.key]
            Item(id, name, entity_sub(l, e, et), entity_info(l, e), top(e.kinds), [tid[t] for t in et if haskey(tid, t)], e.img, e.amazon)
        end
        items[l] = [make(ents[l][k]) for k in graph]
        cold[l] = [make(e) for e in rest]
        kidx = Dict(k => i for (i, k) in enumerate(graph))
        lists = [Int[] for _ in users]
        for (u, s) in saves[l]
            lists[uidx[u]] = sort([kidx[k] for k in s])
        end
        inter[l] = lists
    end
    split = random_split(length(users), MersenneTwister(seed))
    ds = Dataset("amazon", items, cold, tags, chips, users, inter, split)
    print(log, summary_string(ds))
    ds
end
