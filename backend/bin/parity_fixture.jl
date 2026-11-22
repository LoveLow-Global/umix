# Writes test cases for scripts/check_parity.mjs. Random inputs (items in the graph, search-only
# items and genre chips) go through the exported model in Julia here. The check then runs the same
# inputs through webpage/src/lib/engine.js and compares.
#   julia --project=backend backend/bin/parity_fixture.jl [--dir webpage/public/model]
include("cli.jl")
using Umix, Random, JSON3

opts, _ = parse_args(ARGS)
dir = get(opts, "dir", joinpath("webpage", "public", "model"))
em = load_exported(isabspath(dir) ? dir : joinpath(ROOT, dir))
rng = Xoshiro(5)
cases = Any[]
while length(cases) < 60
    layer = rand(rng, LAYERS)
    inputs, js = Dict{Symbol,Vector{Any}}(), Dict{String,Any}()
    for l in LAYERS
        rand(rng) < 0.35 && continue
        xs, jx = Any[], Any[]
        for _ in 1:rand(rng, 1:5)
            i = rand(rng, 1:length(em.ids[l]))
            push!(xs, (:graph, i)); push!(jx, Dict("src" => "graph", "i" => i - 1))
        end
        if rand(rng) < 0.4 && !isempty(em.cold_tags[l])
            t = rand(rng, em.cold_tags[l])
            push!(xs, (:tags, t)); push!(jx, Dict("src" => "search", "tags" => t .- 1))
        end
        if rand(rng) < 0.3
            t = rand(rng, 1:size(em.G[l], 2))
            push!(xs, (:tags, [t])); push!(jx, Dict("src" => "tag", "tags" => [t - 1]))
        end
        inputs[l], js[string(l)] = xs, jx
    end
    isempty(inputs) && continue
    excl = Set(rand(rng, 1:length(em.ids[layer]), 5))
    picks, w = recommend(em, inputs, layer; k = 20, exclude = excl)
    push!(cases, Dict("layer" => string(layer), "inputs" => js, "exclude" => collect(excl) .- 1, "k" => 20,
        "weights" => Dict(string(l) => w[l] for l in LAYERS),
        "picks" => [Dict("i" => p.i - 1, "score" => p.score, "match" => p.match,
                         "because" => p.because === nothing ? nothing : Dict("layer" => string(p.because[1]), "n" => p.because[2] - 1))
                    for p in picks]))
end
out = joinpath(ROOT, "backend", "test", "parity_fixture.json")
open(io -> JSON3.write(io, Dict("model" => dir, "cases" => cases)), out, "w")
println("wrote $(length(cases)) cases to $out")
