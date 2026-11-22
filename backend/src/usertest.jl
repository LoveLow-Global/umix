# The user test. The website saves every keep and skip on a pick, with where the model ranked it
# right before (the /test page, Download JSON). This reads those files and checks whether people
# kept what the model ranked high and skipped what it ranked low.

"One answer from a tester about one pick."
struct UserAnswer
    device::String
    tester::String
    time::String
    action::String               # keep, skip or remove
    from::String                 # the page, like discover/style or item
    layer::String                # music, film or style
    id::String
    name::String
    rank::Union{Int,Nothing}     # 1 is the model's top pick for that person and layer at that moment
    of::Union{Int,Nothing}       # how many items were ranked
end

_str(x) = x === nothing ? "" : string(x)
_int(x) = x === nothing ? nothing : Int(x)

"""
    load_user_test(paths) -> Vector{UserAnswer}

Reads exported JSON files (folders are searched for *.json). An answer that shows up in two
exports from the same device is only counted once. Old exports (format 1, films only) work too.
"""
function load_user_test(paths)
    files = String[]
    for p in paths
        isdir(p) ? append!(files, sort(filter(f -> endswith(f, ".json"), readdir(p; join = true)))) : push!(files, p)
    end
    seen = Set{NTuple{5,String}}()
    out = UserAnswer[]
    for f in files
        j = JSON3.read(read(f, String))
        fmt = get(j, :format, "")
        fmt in ("umix-user-test/1", "umix-user-test/2") || error("$f is not a um!x user test export")
        for e in j.events
            v1 = fmt == "umix-user-test/1"
            a = UserAnswer(_str(e.device), _str(e.tester), _str(e.t), _str(e.action), _str(get(e, :from, "")),
                           v1 ? "film" : _str(get(e, :layer, "")), _str(v1 ? e.film : e.id), _str(get(e, v1 ? :title : :name, "")),
                           _int(get(e, :rank, nothing)), _int(get(e, :of, nothing)))
            key = (a.device, a.tester, a.time, a.id, a.action)
            key in seen && continue
            push!(seen, key)
            push!(out, a)
        end
    end
    sort!(out; by = a -> (a.device, a.tester, a.time))
end

"""
The last word of each tester on each pick. Kept counts as yes, skipped or removed as no.
The rank is the one from the latest answer that had a rank.
"""
function final_answers(answers)
    latest = Dict{NTuple{4,String},NamedTuple}()
    for a in answers   # already in time order
        k = (a.device, a.tester, a.layer, a.id)
        prev = get(latest, k, nothing)
        rank, of = a.rank !== nothing ? (a.rank, a.of) : prev === nothing ? (nothing, nothing) : (prev.rank, prev.of)
        latest[k] = (person = (a.device, a.tester), layer = a.layer, id = a.id, kept = a.action == "keep", from = a.from, rank = rank, of = of)
    end
    collect(values(latest))
end

# 1 means the model's top pick, 0 its last one
_pct(r, of) = of === nothing || of <= 1 ? 1.0 : (of - r) / (of - 1)

"""
For one person in one layer, pair every pick they kept with every pick they skipped, and count how
often the model ranked the kept one higher (ties count half). 0.5 is a coin flip, 1.0 is perfect.
"""
function pair_score(final)
    yes = [_pct(f.rank, f.of) for f in final if f.kept && f.rank !== nothing]
    no = [_pct(f.rank, f.of) for f in final if !f.kept && f.rank !== nothing]
    (isempty(yes) || isempty(no)) && return nothing
    sum((y > n) + 0.5 * (y == n) for y in yes, n in no) / (length(yes) * length(no))
end

"mean of `x` with a 95% interval from resampling (nothing for the interval with fewer than 3 values)"
function boot_mean(x::Vector{Float64}; boot = 2000, seed = 1)
    isempty(x) && return (mean = nothing, lo = nothing, hi = nothing)
    length(x) < 3 && return (mean = mean(x), lo = nothing, hi = nothing)
    rng = Random.MersenneTwister(seed)
    means = [mean(rand(rng, x, length(x))) for _ in 1:boot]
    (mean = mean(x), lo = quantile(means, 0.025), hi = quantile(means, 0.975))
end

"""
    user_test_summary(answers) -> NamedTuple

The numbers behind the report: the pair score per person and layer, its average with a 95%
interval (resampling person-layers), the same per layer, keep rates by page, and the top 3 keep rate.
"""
function user_test_summary(answers)
    final = final_answers(answers)
    people = unique(f.person for f in final)
    units = unique((f.person, f.layer) for f in final)
    scores = Dict{String,Vector{Float64}}()
    for (p, l) in units
        s = pair_score(filter(f -> f.person == p && f.layer == l, final))
        s === nothing || push!(get!(scores, l, Float64[]), s)
    end
    all = reduce(vcat, values(scores); init = Float64[])
    ranked = filter(f -> f.rank !== nothing, final)
    top3 = filter(f -> f.rank <= 3, ranked)
    count_by(key) = begin
        d = Dict{String,Tuple{Int,Int}}()
        for f in final
            y, n = get(d, key(f), (0, 0))
            d[key(f)] = f.kept ? (y + 1, n) : (y, n + 1)
        end
        d
    end
    (people = length(people), devices = length(unique(first.(people))), scored = length(all), pair = boot_mean(all),
     by_layer = Dict(l => (scored = length(v), pair = boot_mean(v)) for (l, v) in scores),
     kept = count(f -> f.kept, final), skipped = count(f -> !f.kept, final), removed = count(a -> a.action == "remove", answers),
     kept_rank = isempty([f.rank for f in ranked if f.kept]) ? nothing : mean([f.rank for f in ranked if f.kept]),
     skipped_rank = isempty([f.rank for f in ranked if !f.kept]) ? nothing : mean([f.rank for f in ranked if !f.kept]),
     top3_kept = count(f -> f.kept, top3), top3 = length(top3), layers = count_by(f -> f.layer), pages = count_by(f -> f.from))
end

_p(x) = string(round(Int, 100x), "%")
_plural(n, w) = "$n $w$(n == 1 ? "" : "s")"

"""
    user_test_report(answers) -> String

A short markdown report of the user test.
"""
function user_test_report(answers)
    s = user_test_summary(answers)
    io = IOBuffer()
    println(io, "# User test results\n")
    if s.people == 0
        println(io, "No answers yet. Download them on the /test page (Download JSON) and point this script at the files.")
        return String(take!(io))
    end
    print(io, "From $(_plural(s.people, "tester")) on $(_plural(s.devices, "device")). $(s.kept) picks kept and $(s.skipped) skipped")
    println(io, s.removed == 0 ? "." : s.removed == 1 ? " (1 of the skips was a pick someone kept and then removed)." :
                " ($(s.removed) of the skips were picks people kept and then removed).")
    println(io, "\n## Did people keep what the model ranked high?\n")
    if s.kept_rank !== nothing && s.skipped_rank !== nothing
        @printf(io, "Kept picks were at rank %.1f on average and skipped picks at rank %.1f (rank 1 is the model's top pick).\n\n", s.kept_rank, s.skipped_rank)
    end
    if s.pair.mean === nothing
        println(io, "To check the ranking we need testers who both kept and skipped something in the same layer. Nobody has done both yet.")
    else
        print(io, "For each tester and layer, pair every pick they kept with every pick they skipped. The model ranked the kept one higher ",
              _p(s.pair.mean), " of the time")
        print(io, s.pair.lo === nothing ? " (from $(s.scored), too few for an interval)" :
                  " (95% interval $(_p(s.pair.lo)) to $(_p(s.pair.hi)), from $(s.scored) tester and layer pairs)")
        println(io, ". 50% would mean the ranking tells us nothing about what people like.")
    end
    s.top3 > 0 && println(io, "\nThe model's top 3 picks were kept $(s.top3_kept) out of $(s.top3) times (", _p(s.top3_kept / s.top3), ").")
    println(io, "\n## By layer\n")
    println(io, "| layer | kept | skipped | keep rate | pair score |")
    println(io, "|---|---|---|---|---|")
    for l in ("music", "film", "style")
        haskey(s.layers, l) || continue
        y, n = s.layers[l]
        b = get(s.by_layer, l, nothing)
        ps = b === nothing ? "not enough answers" : b.pair.lo === nothing ? _p(b.pair.mean) : "$(_p(b.pair.mean)) ($(_p(b.pair.lo)) to $(_p(b.pair.hi)))"
        println(io, "| $l | $y | $n | ", _p(y / (y + n)), " | $ps |")
    end
    println(io, "\n## By page\n")
    println(io, "| page | kept | skipped | keep rate |")
    println(io, "|---|---|---|---|")
    for (k, (y, n)) in sort(collect(s.pages); by = x -> -(x[2][1] + x[2][2]))
        println(io, "| $k | $y | $n | ", _p(y / (y + n)), " |")
    end
    String(take!(io))
end
