# Turn the Amazon files from scripts/fetch_amazon.sh into a dataset.
#   julia --project=backend backend/bin/prep_amazon.jl [--max-users 0] [--min-rating 4]
include("cli.jl")
using Umix

opts, _ = parse_args(ARGS)
raw = joinpath(ROOT, "data", "raw", "amazon2023")
isdir(raw) || error("no $raw yet, run scripts/fetch_amazon.sh first")
ds = load_amazon(raw; max_users = argint(opts, "max-users", 0),
                 min_rating = argfloat(opts, "min-rating", 4.0))
out = joinpath(ROOT, "data", "processed", "amazon.json")
save_dataset(out, ds)
print(summary_string(ds))
println("saved to $out")
