# Builds the dataset (artists, titles, brand + type, and who saved what) from the Amazon files
# that scripts/fetch_amazon.sh downloaded.
#   julia --project=backend backend/bin/prep.jl
include("cli.jl")
using Umix

raw = joinpath(ROOT, "data", "raw", "amazon2023")
isdir(raw) || error("no $raw yet, run bash scripts/fetch_amazon.sh first")
out = joinpath(ROOT, "data", "processed", "amazon.jls")
logf = open(joinpath(ROOT, "results", "amazon_data.log"), "w")
ds = load_amazon(raw; log = Tee(stdout, logf))
close(logf)
save_dataset(out, ds)
println("saved $out")
