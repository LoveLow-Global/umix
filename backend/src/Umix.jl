"""
    Umix

Backend for the um!x alpha. It learns how music and visual/fashion taste lines up with
film/TV taste, using a multi-layer graph convolutional network (one graph layer per
domain, users shared across layers).

Rough flow
1. `make_synthetic` or `load_amazon` builds a `Dataset`
2. `train` fits the multi-layer GCN with the hidden-film setup
3. `evaluate` runs the hidden-film test against simple baselines
4. `export_model` writes the JSON the web app reads
5. `serve` runs the HTTP API (and the web app files)
6. `user_test_report` reads the keeps and skips saved during the user test
"""
module Umix

using SparseArrays, LinearAlgebra, Random, Statistics, Printf, Dates
using Zygote, Optimisers, NNlib, JSON3, CodecZlib
import ChainRulesCore: rrule, NoTangent, unthunk

include("data.jl")
include("catalog.jl")
include("synth.jl")
include("amazon.jl")
include("model.jl")
include("train.jl")
include("evaluate.jl")
include("export.jl")
include("server.jl")
include("usertest.jl")

export DOMAINS, SOURCES, TARGET, Item, Dataset, users_in
export load_catalog, SynthConfig, make_synthetic, load_amazon, save_dataset, load_dataset, summary_string
export ModelConfig, TrainConfig, Model, train, item_embeddings, recommend
export ScorePopular, ScoreTags, ScoreItemKNN, ScoreModel, evaluate, evaluate_all, metrics_table, ranking_metrics
export export_model, load_exported, ExportedModel, serve
export UserAnswer, load_user_test, user_test_summary, user_test_report

end
