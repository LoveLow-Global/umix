# Writes backend/test/parity_fixture.json: random maps plus the Julia engine's answers.
# scripts/check_parity.mjs then runs the browser engine on the same maps and compares.
#   julia --project=backend backend/bin/parity_fixture.jl [--model frontend/model/umix-model.json]
include("cli.jl")
using Umix, JSON3, Random

opts, _ = parse_args(ARGS)
model = get(opts, "model", joinpath(ROOT, "frontend", "model", "umix-model.json"))
isabspath(model) || (model = joinpath(ROOT, model))
em = load_exported(model)
rng = MersenneTwister(42)
pick(list, n) = [list[i].id for i in randperm(rng, length(list))[1:min(n, length(list))]]
cases = Any[]
for c in 1:60
    nm, nv, nf = rand(rng, 0:6), rand(rng, 0:6), rand(rng, 0:2)
    ids = vcat(pick(em.items[:music], nm), pick(em.items[:visual], nv), pick(em.items[:film], nf))
    exclude = pick(em.items[:film], rand(rng, 0:2))
    k = rand(rng, [3, 12, 500])
    push!(cases, Dict("items" => ids, "exclude" => exclude, "k" => k, "julia" => recommend(em, ids; k, exclude)))
end
out = joinpath(ROOT, "backend", "test", "parity_fixture.json")
open(io -> JSON3.write(io, Dict("model" => relpath(model, ROOT), "cases" => cases)), out, "w")
println("wrote $(length(cases)) cases to $out")
