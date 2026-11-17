# Small HTTP API around an exported model. It also serves the web app files, so one
# command runs the whole thing locally.
#
#   GET  /api/health      is the engine up, which model
#   GET  /api/model       the exported model JSON (the browser can run it offline)
#   GET  /api/catalog     every item the model knows
#   POST /api/recommend   {"items": [ids on the map], "exclude": [ids], "k": 12}
#
# HTTP.jl 2.x runs server tasks on the :interactive thread pool, so start Julia with
# at least one interactive thread, for example `julia --threads=1,1`.

import HTTP

const CORS = ["Access-Control-Allow-Origin" => "*", "Access-Control-Allow-Methods" => "GET, POST, OPTIONS",
              "Access-Control-Allow-Headers" => "Content-Type"]

const MIME = Dict(".html" => "text/html; charset=utf-8", ".js" => "text/javascript; charset=utf-8",
                  ".mjs" => "text/javascript; charset=utf-8", ".css" => "text/css; charset=utf-8",
                  ".json" => "application/json", ".svg" => "image/svg+xml", ".png" => "image/png",
                  ".ico" => "image/x-icon", ".txt" => "text/plain; charset=utf-8", ".md" => "text/plain; charset=utf-8")

json_response(obj; status = 200) = HTTP.Response(status, JSON3.write(obj); headers = vcat(["Content-Type" => "application/json"], CORS))
raw_json_response(s::String) = HTTP.Response(200, s; headers = vcat(["Content-Type" => "application/json"], CORS))

function body_string(req)
    try
        return String(req.body)
    catch
        return ""
    end
end

function catalog_obj(em::ExportedModel)
    Dict(String(d) => [Dict("id" => it.id, "kind" => it.kind, "title" => it.title, "by" => it.by, "tags" => it.tags)
                       for it in em.items[d]] for d in DOMAINS)
end

function static_response(dir::AbstractString, path::AbstractString)
    rel = path == "/" ? "index.html" : lstrip(HTTP.URIs.unescapeuri(path), '/')
    parts = split(rel, '/')
    any(p -> p == ".." || startswith(p, "."), parts) && return HTTP.Response(404, "not found")
    full = joinpath(dir, rel)
    isdir(full) && (full = joinpath(full, "index.html"))
    isfile(full) || return HTTP.Response(404, "not found")
    ext = lowercase(splitext(full)[2])
    return HTTP.Response(200, read(full); headers = ["Content-Type" => get(MIME, ext, "application/octet-stream"),
                                                    "Cache-Control" => "no-cache"])
end

function handle(em::ExportedModel, req, static_dir)
    path = String(first(split(req.target, '?')))
    req.method == "OPTIONS" && return HTTP.Response(204, ""; headers = CORS)
    try
        if path == "/api/health"
            return json_response(Dict("ok" => true, "engine" => "julia", "model" => em.name, "dataset" => em.dataset,
                "items" => Dict(String(d) => length(em.items[d]) for d in DOMAINS), "layer_weights" => em.layer_weights))
        elseif path == "/api/model"
            return raw_json_response(em.raw)
        elseif path == "/api/catalog"
            return json_response(catalog_obj(em))
        elseif path == "/api/recommend"
            req.method == "POST" || return json_response(Dict("error" => "use POST"); status = 405)
            o = JSON3.read(body_string(req))
            ids = String.(collect(get(o, :items, String[])))
            exclude = String.(collect(get(o, :exclude, String[])))
            k = clamp(Int(get(o, :k, 12)), 1, 200)
            out = recommend(em, ids; k, exclude)
            out["engine"] = "julia"
            return json_response(out)
        elseif startswith(path, "/api/")
            return json_response(Dict("error" => "no such endpoint"); status = 404)
        elseif static_dir !== nothing
            return static_response(static_dir, path)
        end
        return HTTP.Response(404, "not found")
    catch err
        @warn "request failed" path exception = (err, catch_backtrace())
        return json_response(Dict("error" => sprint(showerror, err)); status = 400)
    end
end

"""
    serve(model_path; host = "127.0.0.1", port = 8080, static_dir = nothing, block = true)

`block = false` returns the running server (close it with `close(server)`).
"""
function serve(model_path::AbstractString; host = "127.0.0.1", port = 8080, static_dir = nothing, block = true)
    em = load_exported(model_path)
    Threads.nthreads(:interactive) == 0 && @warn "HTTP.jl wants an interactive thread, start Julia with --threads=1,1"
    f = req -> handle(em, req, static_dir)
    println("um!x engine: model '$(em.name)' on http://$(host):$(port)", static_dir === nothing ? "" : "  (web app included)")
    return block ? HTTP.serve(f, host, port) : HTTP.serve!(f, host, port)
end
