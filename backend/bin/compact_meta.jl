# Reads one Amazon Reviews 2023 metadata file (JSON lines) from stdin and writes a small version
# to stdout. It keeps the items our people rated, plus items popular enough on Amazon that
# someone might search for them during onboarding.
#   gunzip -c meta.jsonl.gz | julia --project=backend backend/bin/compact_meta.jl items.txt 20 > out.jsonl
# Arguments: a file of parent_asin ids to always keep, and the minimum number of Amazon ratings
# for any other item.
using JSON3

const ITEMS = Set(eachline(ARGS[1]))
const MIN_RATINGS = parse(Int, ARGS[2])
const DETAILS = ("Genre", "Format", "Media Format", "Release date", "Original Release Date", "Date First Available",
                 "Director", "Actors", "Contributor", "Department", "Label", "Run time", "Studio")
const ASIN = r"\"parent_asin\": \"([A-Z0-9]+)\""
const NRAT = r"\"rating_number\": (\d+)"
const IMG = r"/images/I/([^./]+)\."

short(x) = x === nothing ? nothing : (s = string(x); length(s) > 200 ? first(s, 200) : s)

function image_id(images)
    images === nothing && return nothing
    for im in images
        for key in (:large, :hi_res, :thumb)
            url = get(im, key, nothing)
            url isa AbstractString || continue
            m = match(IMG, url)
            m === nothing || return m.captures[1]
        end
    end
    nothing
end

kept = 0
for line in eachline(stdin)
    # cheap checks first, so most of a 4 GB file is never parsed
    m = match(ASIN, line)
    m === nothing && continue
    ours = m.captures[1] in ITEMS
    if !ours
        r = match(NRAT, line)
        (r === nothing || parse(Int, r.captures[1]) < MIN_RATINGS) && continue
    end
    d = try JSON3.read(line) catch; continue end
    det = get(d, :details, nothing)
    dd = Dict{String,Any}()
    if det !== nothing
        for k in DETAILS
            v = get(det, Symbol(k), nothing)
            v === nothing || (dd[k] = short(v))
        end
    end
    out = (a = d.parent_asin, t = short(get(d, :title, nothing)), s = short(get(d, :store, nothing)),
           c = get(d, :categories, String[]), m = get(d, :main_category, nothing), n = something(get(d, :rating_number, 0), 0),
           r = get(d, :average_rating, nothing), i = image_id(get(d, :images, nothing)), d = dd, o = ours)
    println(JSON3.write(out))
    global kept += 1
end
println(stderr, "kept $kept items")
