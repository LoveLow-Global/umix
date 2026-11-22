"""
    Umix

Backend for um!x. It learns how taste in music, film and style lines up, from real Amazon
shoppers, with a multi-layer graph network written in Lux and trained with Enzyme.

Rough flow
1. `load_amazon` turns the Amazon files into a `Dataset` of artists, titles and brand + type
2. `train` fits the multi-layer GCN: hide one layer of a person, predict it from the rest
3. `evaluate` runs the hidden-layer test against simple baselines
4. `export_model` writes the files the website runs in the browser
5. `user_test_report` reads the keeps and skips saved during the user test
"""
module Umix

using SparseArrays, LinearAlgebra, Random, Statistics, Printf, Dates, Unicode, Serialization
using JSON3, CodecZlib
using Lux, Optimisers, ADTypes, Enzyme, Mooncake
using NNlib: softmax, logsoftmax, relu

include("data.jl")
include("entities.jl")
include("amazon.jl")
include("model.jl")
include("train.jl")
include("evaluate.jl")
include("export.jl")
include("usertest.jl")

export LAYERS, Item, Dataset, users_in, layers_of, nitems, ntags, nusers, summary_string
export load_amazon, save_dataset, load_dataset
export ModelConfig, TrainConfig, Model, train, item_vectors, build_graph
export ScoreModel, ScorePopular, ScoreKNN, evaluate_all, mean_metric, paired, hidden_layer_cases
export export_model, load_exported, ExportedModel, recommend
export UserAnswer, load_user_test, user_test_summary, user_test_report

end
