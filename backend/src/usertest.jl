# The user test. The web app saves every keep and skip on a film, with the model's rank for that
# film right before (facilitator panel, Download JSON). This reads those files and checks if people
# kept the films the model ranked high and skipped the ones it ranked low.

"One answer from a tester about one film."
struct UserAnswer
    device::String
    tester::String
    time::String
    action::String               # keep, skip or remove
    from::String                 # where it happened, like map, today, outside, search
    film::String
    title::String
    rank::Union{Int,Nothing}     # 1 is the model's top pick for that map at that moment
    of::Union{Int,Nothing}       # how many films were ranked
end

const WHERE = Dict(
    "map" => "Suggestion rings on the map", "today" => "Today's pick", "because" => "Because you saved rows",
    "twins" => "If it were a film", "films" => "Films row", "series" => "Series row", "outside" => "Outside your bubble",
    "search" => "Search", "bubbles" => "Bubbles", "surprise" => "Surprise me", "add-picks" => "Films that fit this map (add sheet)",
    "add-list" => "Add sheet list", "peek" => "Someone else's map", "discover" => "Discover")

_str(x) = x === nothing ? "" : string(x)
_int(x) = x === nothing ? nothing : Int(x)

"""
    load_user_test(paths) -> Vector{UserAnswer}

Reads exported JSON files (folders are searched for *.json). An answer that shows up in two
exports from the same device is only counted once.
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
        get(j, :format, "") == "umix-user-test/1" || error("$f is not a um!x user test export")
        for e in j.events
            a = UserAnswer(_str(e.device), _str(e.tester), _str(e.t), _str(e.action), _str(get(e, :from, "")), _str(e.film),
                           _str(get(e, :title, "")), _int(get(e, :rank, nothing)), _int(get(e, :of, nothing)))
            key = (a.device, a.tester, a.time, a.film, a.action)
            key in seen && continue
            push!(seen, key)
            push!(out, a)
        end
    end
    sort!(out; by = a -> (a.device, a.tester, a.time))
end

"""
The last word of each tester on each film. Kept counts as yes, skipped or removed as no.
The rank is the one from the latest answer that had a rank.
"""
function final_answers(answers)
    latest = Dict{NTuple{3,String},NamedTuple}()
    for a in answers   # already in time order
        k = (a.device, a.tester, a.film)
        prev = get(latest, k, nothing)
        rank, of = a.rank !== nothing ? (a.rank, a.of) : prev === nothing ? (nothing, nothing) : (prev.rank, prev.of)
        latest[k] = (person = (a.device, a.tester), film = a.film, kept = a.action == "keep", from = a.from, rank = rank, of = of)
    end
    collect(values(latest))
end

# 1 means the model's top pick, 0 its last one
_pct(r, of) = of === nothing || of <= 1 ? 1.0 : (of - r) / (of - 1)

"""
For one person, pair every film they kept with every film they skipped, and count how often the
model ranked the kept one higher (ties count half). 0.5 is a coin flip, 1.0 is perfect.
"""
function pair_score(final)
    yes = [_pct(f.rank, f.of) for f in final if f.kept && f.rank !== nothing]
    no = [_pct(f.rank, f.of) for f in final if !f.kept && f.rank !== nothing]
    (isempty(yes) || isempty(no)) && return nothing
    sum((y > n) + 0.5 * (y == n) for y in yes, n in no) / (length(yes) * length(no))
end

"""
    user_test_summary(answers) -> NamedTuple

The numbers behind the report: pair score per person, its average with a 95% interval
(resampling people), keep rates by where the pick came from, and the top 3 keep rate.
"""
function user_test_summary(answers; boot = 2000, seed = 1)
    final = final_answers(answers)
    people = unique(f.person for f in final)
    scores = Float64[]
    for p in people
        s = pair_score(filter(f -> f.person == p, final))
        s === nothing || push!(scores, s)
    end
    lo = hi = nothing
    if length(scores) >= 3
        rng = Random.MersenneTwister(seed)
        means = [mean(rand(rng, scores, length(scores))) for _ in 1:boot]
        lo, hi = quantile(means, 0.025), quantile(means, 0.975)
    end
    ranked_final = filter(f -> f.rank !== nothing, final)
    kept_ranks = [f.rank for f in ranked_final if f.kept]
    skipped_ranks = [f.rank for f in ranked_final if !f.kept]
    top3 = filter(f -> f.rank <= 3, ranked_final)
    byfrom = Dict{String,Tuple{Int,Int}}()
    for f in final
        y, n = get(byfrom, f.from, (0, 0))
        byfrom[f.from] = f.kept ? (y + 1, n) : (y, n + 1)
    end
    (people = length(people), devices = length(unique(first.(people))), scored = length(scores),
     pair = isempty(scores) ? nothing : mean(scores), lo = lo, hi = hi,
     kept = count(f -> f.kept, final), skipped = count(f -> !f.kept, final),
     removed = count(a -> a.action == "remove", answers),
     kept_rank = isempty(kept_ranks) ? nothing : mean(kept_ranks),
     skipped_rank = isempty(skipped_ranks) ? nothing : mean(skipped_ranks),
     of = isempty(ranked_final) ? nothing : round(Int, mean(f.of for f in ranked_final)),
     top3_kept = count(f -> f.kept, top3), top3 = length(top3), byfrom = byfrom)
end

_p(x) = string(round(Int, 100x), "%")

"""
    user_test_report(answers) -> String

A short markdown report of the user test.
"""
function user_test_report(answers)
    s = user_test_summary(answers)
    io = IOBuffer()
    println(io, "# User test results\n")
    if s.people == 0
        println(io, "No answers yet. Export the results from the facilitator panel (Download JSON) and point this script at the files.")
        return String(take!(io))
    end
    println(io, "From $(s.people) tester$(s.people == 1 ? "" : "s") on $(s.devices) device$(s.devices == 1 ? "" : "s"). ",
            "$(s.kept) films kept and $(s.skipped) skipped",
            s.removed == 0 ? "." : s.removed == 1 ? " (1 of the skips was a film someone kept and then removed)." :
                " ($(s.removed) of the skips were films people kept and then removed).")
    println(io, "\n## Did people keep what the model ranked high?\n")
    if s.kept_rank !== nothing && s.skipped_rank !== nothing
        @printf(io, "Kept films were at rank %.1f on average and skipped films at rank %.1f, out of about %d films (rank 1 is the model's top pick).\n\n",
                s.kept_rank, s.skipped_rank, s.of)
    end
    if s.pair === nothing
        println(io, "To check the ranking we need testers who both kept and skipped something. Nobody has done both yet.")
    else
        print(io, "Pair up every film a tester kept with every film the same tester skipped. The model ranked the kept one higher ",
              _p(s.pair), " of the time")
        if s.lo !== nothing
            print(io, " (95% interval ", _p(s.lo), " to ", _p(s.hi), ", from $(s.scored) testers)")
        else
            print(io, " (from $(s.scored) tester$(s.scored == 1 ? "" : "s"), too few for an interval)")
        end
        println(io, ". 50% would mean the ranking tells us nothing about what people like.")
    end
    if s.top3 > 0
        println(io, "\nThe model's top 3 picks for a map were kept $(s.top3_kept) out of $(s.top3) times (", _p(s.top3_kept / s.top3), ").")
    end
    println(io, "\n## Keep rate by where the pick came from\n")
    println(io, "| where | kept | skipped | keep rate |")
    println(io, "|---|---|---|---|")
    for (k, (y, n)) in sort(collect(s.byfrom); by = x -> -(x[2][1] + x[2][2]))
        println(io, "| ", get(WHERE, k, k), " | $y | $n | ", _p(y / (y + n)), " |")
    end
    String(take!(io))
end
