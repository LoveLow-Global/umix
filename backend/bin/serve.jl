# Run the API and the web app.
#   julia --threads=1,1 --project=backend backend/bin/serve.jl [--port 8080] [--model models/synthetic.json]
include("cli.jl")
using Umix

opts, _ = parse_args(ARGS)
model = get(opts, "model", joinpath(ROOT, "frontend", "model", "umix-model.json"))
isabspath(model) || (model = joinpath(ROOT, model))
isfile(model) || error("no model at $model, run backend/bin/train.jl first")
serve(model; host = get(opts, "host", "127.0.0.1"), port = argint(opts, "port", 8080),
      static_dir = argflag(opts, "api-only") ? nothing : joinpath(ROOT, "frontend"))
