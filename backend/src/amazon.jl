# Real data: Amazon Reviews 2023 (Hou et al., 2024, McAuley Lab, UCSD).
# scripts/fetch_amazon.sh already cut it down to people who rated all three of
#   music   = CDs & Vinyl
#   visual  = Clothing, Shoes & Jewelry
#   film/TV = Movies & TV
# Here a rating of 4 or 5 counts as "saved". Then we keep a dense core so every user
# has enough saves in each layer and every item is saved by a few people.

const AMAZON_FILES = (
    music = ("CDs_and_Vinyl.5core.overlap.csv.gz", "meta_CDs_and_Vinyl.overlap.jsonl.gz"),
    visual = ("Clothing_Shoes_and_Jewelry.5core.overlap.csv.gz", "meta_Clothing_Shoes_and_Jewelry.overlap.jsonl.gz"),
    film = ("Movies_and_TV.5core.overlap.csv.gz", "meta_Movies_and_TV.overlap.jsonl.gz"),
)

# category names that are about stores, formats, prices or deals instead of taste
const NOISE_WORDS = ["deal", "\$", "featured", "all ", "titles", "studio", "entertainment",
    "blu-ray", "dvd", "boxed", "general", "independently", "special interests", "new release",
    "forms & genres", "today", "prime", "fully loaded", "best ", "top ", "cds & vinyl", "movies & tv",
    "amazon", "home video", "pictures", "warner", "sony", "fox", "paramount", "universal", "mgm",
    "lionsgate", "bbc", "disney", "hbo", "criterion", "box set", "4k", "collection", "movies", "tv",
    "central", "edition", "characters & series"]

function gz_lines(f::Function, path::AbstractString)
    open(path) do io
        f(eachline(GzipDecompressorStream(io)))
    end
end

"user => list of item ids with rating >= min_rating"
function read_ratings(path::AbstractString; min_rating = 4.0)
    out = Dict{String,Vector{String}}()
    gz_lines(path) do lines
        first = true
        for line in lines
            first && (first = false; continue)
            p = split(line, ',')
            length(p) >= 3 || continue
            r = tryparse(Float64, p[3])
            (r === nothing || r < min_rating) && continue
            push!(get!(out, String(p[1]), String[]), String(p[2]))
        end
    end
    return out
end

clean_tag(s) = lowercase(strip(replace(s, r"\s+" => " ")))
is_noise(s) = any(w -> occursin(w, lowercase(s)), NOISE_WORDS) || length(s) > 32 || lowercase(strip(s)) in ("all", "dts", "music")

"asin => (kind, title, by, category list) from a filtered metadata file (if it is there)"
function read_meta(path::AbstractString, domain::Symbol)
    meta = Dict{String,Tuple{String,String,String,Vector{String}}}()
    isfile(path) || return meta
    gz_lines(path) do lines
        for line in lines
            o = JSON3.read(line)
            asin = String(get(o, :parent_asin, ""))
            isempty(asin) && continue
            title = something(get(o, :title, nothing), "")
            title = title isa AbstractString ? strip(title) : ""
            cats = [String(c) for c in something(get(o, :categories, nothing), String[]) if c isa AbstractString]
            feats = [String(x) for x in something(get(o, :features, nothing), String[]) if x isa AbstractString]
            store = something(get(o, :store, nothing), "")
            store = store isa AbstractString ? store : ""
            details = something(get(o, :details, nothing), Dict())
            kind, by = if domain == :music
                artist = strip(first(split(store, "Format:")))
                artist = strip(replace(artist, r"\(.*?\)" => ""))
                ("Album", isempty(artist) ? "Unknown artist" : artist)
            elseif domain == :film
                sub = something(get(o, :subtitle, nothing), "")
                sub = sub isa AbstractString ? sub : ""
                tv = occursin("Season", sub) || any(f -> occursin("episode", f), feats)
                year = something(findfirst(f -> occursin(r"^(19|20)\d\d$", f), feats), 0)
                director = get(details, :Director, nothing)
                if director === nothing
                    ds = get(details, :Directors, nothing)
                    director = ds isa AbstractVector && !isempty(ds) ? ds[1] : nothing
                end
                by = director isa AbstractString ? director : String(something(get(o, :main_category, nothing), "Movies & TV"))
                year > 0 && (by *= " · " * feats[year])
                (tv ? "TV" : "Film", by)
            else
                ("Fashion", "Clothing, Shoes & Jewelry")
            end
            meta[asin] = (kind, String(title), String(by), cats)
        end
    end
    return meta
end

"""
Dense core: drop items saved by fewer than `min_item[d]` of the remaining people and people
with fewer than `min_user[d]` saves in some layer, again and again until nothing changes.
Fashion items almost never repeat across people, so its threshold has to be lower.
"""
function dense_core!(lists, users; min_user, min_item)
    for _ in 1:50
        changed = false
        for d in DOMAINS
            cnt = Dict{String,Int}()
            for u in users, i in lists[d][u]
                cnt[i] = get(cnt, i, 0) + 1
            end
            for u in users
                before = length(lists[d][u])
                filter!(i -> cnt[i] >= min_item[d], lists[d][u])
                changed |= length(lists[d][u]) != before
            end
        end
        keep = filter(u -> all(length(lists[d][u]) >= min_user[d] for d in DOMAINS), users)
        changed |= length(keep) != length(users)
        users = keep
        changed || break
    end
    return users
end

"""
    load_amazon(raw_dir; min_rating = 4, min_user = (music=2, visual=2, film=4),
                min_item = (music=4, visual=3, film=4), min_tag = 30, max_users = 0, seed = 1) -> Dataset
"""
function load_amazon(raw_dir::AbstractString; min_rating = 4.0, min_user = (music = 2, visual = 2, film = 4),
                     min_item = (music = 4, visual = 3, film = 4), min_tag = 30, max_users = 0, seed = 1,
                     val = 0.1, test = 0.1, log = println)
    rng = MersenneTwister(seed)
    saved = Dict(d => read_ratings(joinpath(raw_dir, AMAZON_FILES[d][1]); min_rating) for d in DOMAINS)
    users = sort!(collect(intersect((Set(keys(saved[d])) for d in DOMAINS)...)))
    log("people with 4-5 star ratings in all three layers: $(length(users))")
    lists = Dict(d => Dict(u => unique(saved[d][u]) for u in users) for d in DOMAINS)
    users = dense_core!(lists, users; min_user, min_item)
    if max_users > 0 && length(users) > max_users
        users = sort!(users[randperm(rng, length(users))[1:max_users]])
    end
    log("after the dense core: $(length(users)) people")

    items = Dict{Symbol,Vector{Item}}()
    inter = Dict{Symbol,Vector{Vector{Int}}}()
    tagcount = Dict{String,Int}()
    rawtags = Dict{Symbol,Dict{String,Vector{String}}}()
    for d in DOMAINS
        cnt = Dict{String,Int}()
        for u in users, i in lists[d][u]
            cnt[i] = get(cnt, i, 0) + 1
        end
        ids = sort!(collect(keys(cnt)); by = i -> (-cnt[i], i))
        meta = read_meta(joinpath(raw_dir, AMAZON_FILES[d][2]), d)
        rawtags[d] = Dict{String,Vector{String}}()
        list = Item[]
        for a in ids
            kind, title, by, cats = get(meta, a, (d == :film ? "Film" : d == :music ? "Album" : "Fashion", "", "", String[]))
            tags = unique(string(d, "/", clean_tag(c)) for c in cats if !is_noise(c))
            rawtags[d][a] = tags
            for t in tags
                tagcount[t] = get(tagcount, t, 0) + 1
            end
            push!(list, Item(a, d, kind, isempty(title) ? "Untitled ($a)" : title, by, String[]))
        end
        items[d] = list
        pos = Dict(a => k for (k, a) in enumerate(ids))
        inter[d] = [sort!([pos[i] for i in lists[d][u]]) for u in users]
    end
    tags = sort!([t for (t, c) in tagcount if c >= min_tag])
    keep = Set(tags)
    for d in DOMAINS
        items[d] = [Item(it.id, it.domain, it.kind, it.title, it.by, filter(in(keep), rawtags[d][it.id])) for it in items[d]]
    end
    parts = random_split(length(users), rng; val, test)
    return Dataset("amazon", items, tags, users, inter, parts)
end
