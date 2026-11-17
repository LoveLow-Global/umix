# The hand-made demo catalogue in data/catalog. One file per graph layer.
# Line format:  id|kind|title|by|tag tag tag     (lines starting with # are skipped)

const CATALOG_FILES = (music = "music.txt", visual = "visual.txt", film = "film.txt")

function load_catalog(dir::AbstractString)
    items = Dict{Symbol,Vector{Item}}()
    seen = Set{String}()
    for d in DOMAINS
        path = joinpath(dir, CATALOG_FILES[d])
        list = Item[]
        for (ln, raw) in enumerate(eachline(path))
            line = strip(raw)
            (isempty(line) || startswith(line, "#")) && continue
            f = strip.(split(line, '|'))
            length(f) == 5 || error("$path line $ln: expected 5 fields, got $(length(f))")
            id = String(f[1])
            id in seen && error("$path line $ln: id '$id' is used twice")
            push!(seen, id)
            push!(list, Item(id, d, String(f[2]), String(f[3]), String(f[4]), String.(split(f[5]))))
        end
        items[d] = list
    end
    return items
end

"All tags used in a catalogue, sorted."
catalog_tags(items) = sort!(unique(t for d in DOMAINS for it in items[d] for t in it.tags))
