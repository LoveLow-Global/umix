# Turns Amazon products into the things people actually name.
#   music  every CD by one artist becomes that artist
#   film   DVD, Blu-ray, VHS and streaming editions become one title, seasons become their series
#   style  products become a brand plus a product type, like "Dr. Martens, women's boots"
# Each one also gets tags from Amazon's own labels (genre paths, the Genre field, product
# categories). That's how "Taylor Swift" gets linked to Pop, by the data and not by us.

"One Amazon product, read from the compact metadata (backend/bin/compact_meta.jl)."
struct Product
    asin::String
    key::String           # the entity it belongs to
    name::String          # the entity's name, as this product spells it
    sub::String           # style only, like "Women's boots"
    kind::String
    tags::Vector{String}
    img::String
    n::Int                # Amazon ratings of this product
    extra::String         # album title, director and actors, or product title (for search)
    ours::Bool            # one of our people rated it
end

"lowercase, no accents, no punctuation, no leading 'the'. Used for keys only."
function keynorm(s::AbstractString)
    s = lowercase(Unicode.normalize(String(s), stripmark = true))
    s = strip(replace(s, r"[^a-z0-9]+" => " "))
    startswith(s, "the ") ? s[5:end] : s
end

"url-safe slug"
slugify(s) = strip(replace(lowercase(Unicode.normalize(String(s), stripmark = true)), r"[^a-z0-9]+" => "-"), '-')

squash(s) = strip(replace(String(s), r"\s+" => " "))
str(x) = x === nothing ? "" : x isa AbstractString ? String(x) : string(x)
cats(o) = [String(c) for c in something(get(o, :c, nothing), String[]) if c isa AbstractString]
detail(o, k) = str(get(something(get(o, :d, nothing), Dict{Symbol,Any}()), Symbol(k), nothing))

# ---------- music ----------

"main genres in Amazon's CDs & Vinyl tree (stores, labels and deals left out)"
const MUSIC_GENRES = Set(["Pop", "Rock", "Indie & Alternative", "International Music", "Jazz", "Classical", "Metal",
    "Classic Rock", "Country", "Dance & Electronic", "R&B", "Christian & Gospel", "Rap & Hip-Hop", "Soundtracks", "Blues",
    "Folk", "Holiday & Wedding", "Broadway & Vocalists", "Latin Music", "Opera & Classical Vocal", "New Age",
    "Children's Music", "Comedy & Spoken Word", "Reggae"])
const MUSIC_SUB_NOISE = ["general", "featured", "forms & genres", "today", "all ", "box set", "vinyl", "import", "deal", "store", "records"]
const NOT_ARTISTS = Set(["various artists", "various", "soundtrack", "original soundtrack", "original cast", "original cast recording",
    "unknown", "unknown artist", "anonymous", "va", "various composers", "various performers", "cast recording", "soundtracks"])
const ROLE = r"^(.*?)\s*\((?:Artist|Composer|Conductor|Performer|Orchestra|Ensemble|Primary Contributor|Contributor|Vocalist|Arranger)\)"

"cleans one person or band name: 'Barry, John' becomes 'John Barry'"
function person_name(s::AbstractString)
    s = squash(s)
    m = match(r"^([^,&]+),\s*([^,&]+)$", s)
    if m !== nothing && length(split(m[1])) == 1 && length(split(m[2])) <= 3 && !occursin(" and ", lowercase(s))
        s = string(strip(m[2]), " ", strip(m[1]))
    end
    s
end

isshouty(s) = any(isletter, s) && s == uppercase(s)

"""
The name an entity shows: its most common spelling. A long name in capitals ('KATHY MCCARTY')
switches to another spelling or to Title Case, short ones (BTS, AC/DC, NCT 127) stay as they are.
"""
function display_name(names::Dict{String,Int})
    ns = sort(collect(names); by = x -> (-x[2], x[1]))
    best = ns[1][1]
    (isshouty(best) && length(best) > 12 && occursin(' ', best)) || return best
    for (n, _) in ns
        isshouty(n) || return n
    end
    titlecase(lowercase(best))
end

clean_album(t) = squash(replace(str(t), r"\s*[\[\(][^\]\)]*[\]\)]" => ""))

function music_product(o)
    store = str(get(o, :s, nothing))
    occursin("Rated:", store) && return nothing          # concert films and other DVDs
    head = squash(first(split(store, "Format:")))
    isempty(head) && return nothing
    m = match(ROLE, head)
    raw = m === nothing ? head : m[1]
    raw = squash(first(split(raw, r",\s{2,}")))             # several people listed, keep the first
    name = person_name(raw)
    key = keynorm(name)
    (isempty(key) || length(key) > 60 || key in NOT_ARTISTS || startswith(key, "various ")) && return nothing
    c = cats(o)
    tags = String[]
    if length(c) >= 2 && c[2] in MUSIC_GENRES
        push!(tags, c[2])
        length(c) >= 3 && !any(w -> occursin(w, lowercase(c[3])), MUSIC_SUB_NOISE) && length(c[3]) <= 32 && push!(tags, c[3])
    end
    Product(str(o.a), key, name, "", "", tags, str(get(o, :i, nothing)), Int(get(o, :n, 0)), clean_album(get(o, :t, nothing)), get(o, :o, false))
end

# ---------- film ----------

"Amazon's many genre spellings, mapped to one short list"
const FILM_GENRE = Dict(
    "action" => "Action & Adventure", "action & adventure" => "Action & Adventure", "adventure" => "Action & Adventure",
    "comedy" => "Comedy", "drama" => "Drama", "kids & family" => "Kids & Family", "family" => "Kids & Family", "kids" => "Kids & Family",
    "animation" => "Animation", "anime & manga" => "Anime", "anime" => "Anime", "horror" => "Horror",
    "romance" => "Romance", "love & romance" => "Romance", "mystery & thrillers" => "Mystery & Thriller",
    "mystery & suspense" => "Mystery & Thriller", "thriller" => "Mystery & Thriller", "thrillers" => "Mystery & Thriller",
    "suspense" => "Mystery & Thriller", "mystery" => "Mystery & Thriller", "crime" => "Crime",
    "science fiction & fantasy" => "Sci-Fi & Fantasy", "science fiction" => "Sci-Fi & Fantasy", "sci-fi" => "Sci-Fi & Fantasy",
    "fantasy" => "Sci-Fi & Fantasy", "documentary" => "Documentary", "biography" => "Documentary",
    "music video & concerts" => "Music & Concerts", "music videos & concerts" => "Music & Concerts",
    "musicals" => "Musicals", "musicals & performing arts" => "Musicals", "military & war" => "War", "war" => "War",
    "westerns" => "Western", "western" => "Western", "art house & international" => "International",
    "international" => "International", "foreign" => "International", "sports" => "Sports",
    "holidays & seasonal" => "Holiday", "holiday" => "Holiday", "faith & spirituality" => "Faith", "lgbtq+" => "LGBTQ+",
    "lgbt" => "LGBTQ+", "exercise & fitness" => "Fitness", "special interests" => "Instructional")
const FILM_SKIP = Set(["Fitness", "Instructional"])
const SEASON = r"(?i)\s*[\(:,\-\u2013\u2014]?\s*(?:the\s+)?(?:complete\s+)?(?:(?:first|second|third|fourth|fifth|sixth|seventh|eighth|ninth|tenth|final|\d+(?:st|nd|rd|th))\s+seasons?|seasons?\s+(?:\d+|one|two|three|four|five|six|seven|eight|nine|ten)\b|(?:the\s+)?complete\s+series|series\s+\d+).*$"
const FORMAT_TAIL = r"(?i)[\s:\-\u2013,]*(?:4k|uhd|ultra hd|blu-?ray|dvd|vhs|widescreen|full ?screen|special edition|collector'?s edition|limited edition|anniversary edition|steelbook|digital|hd|region \d|list \$)\b.*$"

"(clean title, is it a series) from a product title like 'Friends: Season 8 [DVD]'"
function film_title(t)
    t = squash(str(t))
    m = match(SEASON, t)
    series = m !== nothing
    series && (t = t[1:prevind(t, m.offset)])
    t = replace(t, r"\s*[\[\(][^\]\)]*[\]\)]?" => "")
    t = replace(t, r"\s+~.*$" => "")               # "Little Women ~ June Allyson, Peter Lawford"
    t = replace(t, FORMAT_TAIL => "")
    t = replace(t, r"\s+(?:19|20)\d\d$" => "")
    squash(strip(t, [' ', '-', ':', ',', '/', '\u2013'])), series
end

function film_genres(o)
    out = String[]
    for part in split(detail(o, "Genre"), r"[,/]")
        g = lowercase(strip(part))
        haskey(FILM_GENRE, g) && push!(out, FILM_GENRE[g])
    end
    for c in cats(o)
        g = lowercase(strip(c))
        haskey(FILM_GENRE, g) && push!(out, FILM_GENRE[g])
    end
    unique(out)
end

function film_product(o)
    str(get(o, :m, nothing)) in ("Sports & Outdoors", "Books") && return nothing
    title, series = film_title(get(o, :t, nothing))
    key = keynorm(title)
    (length(key) < 2 || length(key) > 80) && return nothing
    tags = film_genres(o)
    !isempty(tags) && all(in(FILM_SKIP), tags) && return nothing
    c = cats(o)
    series |= occursin("Television", detail(o, "Genre")) || "TV" in c
    people = String[]
    d = detail(o, "Director")
    isempty(d) || push!(people, squash(first(split(d, ","))))
    a = detail(o, "Actors")
    isempty(a) || append!(people, squash.(first(split(a, ","), 3)))
    Product(str(o.a), key, title, "", series ? "Series" : "Film", tags, str(get(o, :i, nothing)), Int(get(o, :n, 0)),
            join(people, " · "), get(o, :o, false))
end

# ---------- style ----------

const STYLE_SKIP_TOP = Set(["Girls", "Boys", "Baby", "Costumes & Accessories", "Shoe, Jewelry & Watch Accessories", "Novelty & More",
    "Toddler Test", "Kids Shoes Union", "Top 50 by Product Type", "Westlake", "Swimwear TEST"])
const STYLE_ANYONE_TOP = Set(["Novelty & More", "Sport Specific Clothing", "Luggage & Travel Gear", "Uniforms, Work & Safety",
    "Plus-Size Fashion", "Women's Plus-Size Apparel", "Everyday Apparel Essentials"])
"long Amazon category names, made short"
const STYLE_TYPE = Dict(
    "Tops, Tees & Blouses" => "Tops", "Lingerie, Sleep & Lounge" => "Sleep & lounge", "Coats, Jackets & Vests" => "Jackets & coats",
    "Jackets & Coats" => "Jackets & coats", "Fashion Hoodies & Sweatshirts" => "Hoodies", "Jumpsuits, Rompers & Overalls" => "Jumpsuits",
    "Swimsuits & Cover Ups" => "Swimwear", "Swim" => "Swimwear", "Active" => "Activewear", "Athletic" => "Athletic shoes",
    "Outdoor" => "Outdoor shoes", "Fashion Sneakers" => "Sneakers", "Loafers & Slip-Ons" => "Loafers",
    "Sunglasses & Eyewear Accessories" => "Sunglasses", "Wallets, Card Cases & Money Organizers" => "Wallets",
    "Hats & Caps" => "Hats", "Scarves & Wraps" => "Scarves", "Gloves & Mittens" => "Gloves", "Ties, Cummerbunds & Pocket Squares" => "Ties",
    "Socks & Hosiery" => "Socks", "Wrist Watches" => "Watches", "Uniforms, Work & Safety" => "Workwear", "Work & Safety" => "Work shoes",
    "Mules & Clogs" => "Clogs", "Shirts" => "Shirts", "Suits & Sport Coats" => "Suits", "Underwear" => "Underwear")
"types that say little about someone's style, left out"
const STYLE_SKIP_TYPE = Set(["Underwear", "Socks", "Sleep & lounge", "Novelty clothing", "Novelty", "Shops"])
"top level groups, not offered as quick picks"
const STYLE_GROUPS = Set(["Clothing", "Shoes", "Jewelry", "Accessories", "Watches", "Handbags & wallets", "Luggage & travel gear", "Workwear", "Shoe, jewelry & watch accessories"])
"one spelling per type: 'Sleep & Lounge' and 'Sleep & lounge' are the same thing"
tname(x) = uppercasefirst(lowercase(get(STYLE_TYPE, x, x)))
const SECTION = Dict("Women" => "w", "Men" => "m")
const SECTION_NAME = Dict("w" => "Women’s", "m" => "Men’s", "u" => "")
const NOT_BRANDS = Set(["", "generic", "unknown", "does not apply", "na", "n a", "none", "unbranded", "visit the store"])

function dept_section(o)
    d = lowercase(detail(o, "Department"))
    occursin("women", d) ? "w" : occursin("men", d) ? "m" : "u"
end

"(section, group, type, subtype) from Amazon's category path, or nothing for things we don't count as style"
function style_path(o)
    c = cats(o)
    length(c) < 3 && return nothing
    top = c[2]
    top in STYLE_SKIP_TOP && return nothing
    if haskey(SECTION, top)
        sec, p = SECTION[top], c[3:end]
    elseif top == "Boot Shop"
        sec = length(c) >= 3 && haskey(SECTION, c[3]) ? SECTION[c[3]] : dept_section(o)
        p = ["Shoes", "Boots"]
    elseif top in STYLE_ANYONE_TOP
        sec = dept_section(o)
        p = top == "Novelty & More" ? ["Clothing", "Novelty clothing"] :
            top == "Sport Specific Clothing" ? ["Clothing", "Sportswear"] :
            top == "Uniforms, Work & Safety" ? ["Clothing", "Workwear"] : [top; c[3:end]]
    else
        return nothing
    end
    isempty(p) && return nothing
    group = p[1]
    group in ("Girls", "Boys", "Baby") && return nothing
    type = tname(group == "Watches" ? "Watches" : length(p) >= 2 ? p[2] : group)
    type in STYLE_SKIP_TYPE && return nothing
    sub = length(p) >= 3 ? tname(p[3]) : ""
    (sec, tname(group), type, sub)
end

function style_product(o)
    brand = squash(str(get(o, :s, nothing)))
    bkey = keynorm(brand)
    (bkey in NOT_BRANDS || length(brand) > 40 || startswith(bkey, "visit ")) && return nothing
    sp = style_path(o)
    sp === nothing && return nothing
    sec, group, type, subtype = sp
    sname = SECTION_NAME[sec]
    label = isempty(sname) ? type : string(sname, " ", lowercase(type))
    tags = filter(!isempty, unique([type, group, subtype, isempty(sname) ? "Anyone" : sname]))
    Product(str(o.a), string(bkey, "|", sec, "|", keynorm(type)), brand, label, sec, tags, str(get(o, :i, nothing)),
            Int(get(o, :n, 0)), squash(str(get(o, :t, nothing))), get(o, :o, false))
end

const PRODUCT = Dict(:music => music_product, :film => film_product, :style => style_product)

"reads one compact metadata file into asin => Product"
function read_products(path::AbstractString, layer::Symbol)
    out = Dict{String,Product}()
    parse = PRODUCT[layer]
    gz_lines(path) do lines
        for line in lines
            o = JSON3.read(line)
            p = parse(o)
            p === nothing || (out[p.asin] = p)
        end
    end
    out
end

# ---------- products to entities ----------

"what we know about one entity, added up over its products"
mutable struct Entity
    key::String
    names::Dict{String,Int}
    subs::Dict{String,Int}
    kinds::Dict{String,Int}
    tags::Dict{String,Int}
    products::Int
    amazon::Int
    best::Int
    img::String
    extras::Vector{Tuple{Int,String}}
end
Entity(key) = Entity(key, Dict(), Dict(), Dict(), Dict(), 0, 0, -1, "", Tuple{Int,String}[])

bump!(d, k, by = 1) = (d[k] = get(d, k, 0) + by)
top(d) = isempty(d) ? "" : first(sort(collect(d); by = x -> (-x[2], x[1])))[1]

"key => Entity for all products of one layer"
function entities(products::Dict{String,Product})
    out = Dict{String,Entity}()
    for p in values(products)
        e = get!(() -> Entity(p.key), out, p.key)
        bump!(e.names, p.name)
        isempty(p.sub) || bump!(e.subs, p.sub)
        isempty(p.kind) || bump!(e.kinds, p.kind)
        for t in p.tags
            bump!(e.tags, t)
        end
        e.products += 1
        e.amazon += p.n
        if !isempty(p.img) && p.n > e.best
            e.best, e.img = p.n, p.img
        end
        isempty(p.extra) || push!(e.extras, (p.n, p.extra))
    end
    out
end

"the entity's tags: the ones on at least a fifth of its products, at most `max`"
function entity_tags(e::Entity; share = 0.2, max = 4)
    ts = sort(collect(e.tags); by = x -> (-x[2], x[1]))
    [t for (t, c) in ts if c >= share * e.products][1:min(end, max)]
end

"short line under the name"
function entity_sub(layer::Symbol, e::Entity, tags::Vector{String})
    layer == :style && return top(e.subs)
    g = [t for t in tags if layer != :music || t in MUSIC_GENRES]
    layer == :film && return join(filter(!isempty, [top(e.kinds); first(g, 1)]), " · ")
    join(first(isempty(g) ? tags : g, 2), " · ")
end

"extra words for search and display: top albums, or director and stars, or the best known product"
function entity_info(layer::Symbol, e::Entity)
    xs = unique(last.(sort(e.extras; by = x -> -x[1])))
    isempty(xs) && return ""
    layer == :music || return first(xs[1], 80)
    # album titles, without the artist's name in front ("Taylor Swift - Folklore" is just Folklore)
    name = lowercase(display_name(e.names))
    albums = String[]
    for x in xs
        a = strip(x)
        startswith(lowercase(a), name) && (a = strip(lstrip(a[nextind(a, lastindex(name)):end], [' ', '-', ':', '\u2013'])))
        a = first(a, 40)
        isempty(a) || lowercase(a) in lowercase.(albums) || push!(albums, a)
        length(albums) == 3 && break
    end
    join(albums, " · ")
end
