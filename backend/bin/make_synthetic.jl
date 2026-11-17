# Build the synthetic maps for the demo catalogue.
#   julia --project=backend backend/bin/make_synthetic.jl [--maps 5000] [--seed 7]
include("cli.jl")
using Umix, JSON3

opts, _ = parse_args(ARGS)
cfg = SynthConfig(n_maps = argint(opts, "maps", 5000), seed = argint(opts, "seed", 7))
ds, truth = make_synthetic(joinpath(ROOT, "data", "catalog"); cfg)
out = joinpath(ROOT, "data", "processed", "synthetic.json")
save_dataset(out, ds)
# the hidden answers, only for checking the generator, never used in training
open(joinpath(ROOT, "data", "processed", "synthetic_truth.json"), "w") do io
    JSON3.write(io, Dict("archetypes" => truth.archetypes, "map_scene" => truth.map_scene,
        "item_scene" => Dict(String(d) => truth.scene[d] for d in keys(truth.scene))))
end
print(summary_string(ds))
println("saved to $out")
