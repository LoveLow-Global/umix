# Run with:  julia --project=backend backend/test/runtests.jl
using Test, Umix, SparseArrays, Random, Zygote, JSON3
import HTTP
const U = Umix
const ROOT = normpath(joinpath(@__DIR__, "..", ".."))
const CATALOG = joinpath(ROOT, "data", "catalog")

@testset "um!x backend" begin
    ds, truth = make_synthetic(CATALOG; cfg = SynthConfig(n_maps = 400, seed = 3))

    @testset "catalogue and synthetic data" begin
        items = load_catalog(CATALOG)
        ids = [it.id for d in DOMAINS for it in items[d]]
        @test length(ids) == length(unique(ids))
        @test all(it -> !isempty(it.tags), vcat(values(items)...))
        @test length(ds.users) == 400
        @test Set(ds.split) == Set([:train, :val, :test])
        for d in DOMAINS
            @test all(l -> issorted(l) && allunique(l) && all(1 .<= l .<= U.nitems(ds, d)), ds.inter[d])
        end
        @test length(truth.map_scene) == 400
    end

    @testset "saving and loading a dataset" begin
        path = tempname() * ".json"
        save_dataset(path, ds)
        ds2 = load_dataset(path)
        @test ds2.users == ds.users && ds2.split == ds.split && ds2.tags == ds.tags
        @test all(ds2.inter[d] == ds.inter[d] for d in DOMAINS)
        @test [it.id for it in ds2.items[:film]] == [it.id for it in ds.items[:film]]
    end

    @testset "graph normalization" begin
        users = users_in(ds, :train)[1:50]
        g = U.build_graph(ds, users)
        R = U.interaction_matrix(ds, :music, users)
        du, di = vec(sum(R; dims = 2)), vec(sum(R; dims = 1))
        I, J, V = findnz(g.A.music)
        @test all(isapprox(V[k], 1 / sqrt(du[I[k]] * di[J[k]]); rtol = 1e-5) for k in eachindex(V))
        @test g.At.music == sparse(transpose(g.A.music))
    end

    @testset "gradients match finite differences" begin
        rng = MersenneTwister(1)
        cfg = ModelConfig(dim = 8, hops = 2)
        θ = U.init_params(rng, ds, cfg)
        X = U.tag_features(ds)
        tr = users_in(ds, :train)
        g = U.build_graph(ds, tr[1:200])
        b = tr[201:232]
        M, mask = U.source_input(ds, b)
        Y = U.target_matrix(ds, b)
        f(p) = U.batch_loss(p, X, g, M, mask, Y, cfg)
        gr = Zygote.gradient(f, θ)[1]
        for (name, idx) in ((:E_music, (3, 2)), (:E_film, (5, 4)), (:T, (2, 1)), (:Wa, (1, 1)), (:W1, (2, 3)), (:β, (2,)))
            p = getfield(θ, name)
            old = p[idx...]
            h = 1f-2
            p[idx...] = old + h; up = f(θ)
            p[idx...] = old - h; dn = f(θ)
            p[idx...] = old
            @test isapprox(getfield(gr, name)[idx...], (up - dn) / (2h); atol = 2e-3, rtol = 5e-2)
        end
    end

    @testset "ranking metrics" begin
        S = [0.9 0.1 0.8 0.2; 0.1 0.2 0.3 0.4]
        m = ranking_metrics(S, [[1, 3], [2]]; ks = (2,))
        # user 1 gets both films in the top 2, user 2 has film 2 ranked 3rd
        @test m["recall@2"] ≈ 0.5
        @test m["hit@2"] ≈ 0.5
        @test m["ndcg@2"] ≈ 0.5
    end

    model = train(ds, ModelConfig(dim = 16, hops = 2),
                  TrainConfig(epochs = 40, eval_every = 4, patience = 3, lr = 0.02); log = x -> nothing)

    @testset "the model learns something" begin
        va = users_in(ds, :val)
        pop = evaluate(ScorePopular(ds), ds, va)
        gcn = evaluate(ScoreModel(model), ds, va)
        @test gcn["ndcg@10"] > pop["ndcg@10"]
        w = U.layer_weights(model.θ)
        @test sum(w) ≈ 3 atol = 1e-4
    end

    @testset "export round trip gives the same picks" begin
        path = tempname() * ".json"
        export_model(path, model; dataset = "test")
        em = load_exported(path)
        idx = U.item_index(ds)
        for u in users_in(ds, :test)[1:20]
            ids = [ds.items[:music][i].id for i in ds.inter[:music][u]]
            append!(ids, [ds.items[:visual][i].id for i in ds.inter[:visual][u]])
            S, _ = U.score_users(model, [ds.inter[:music][u]], [ds.inter[:visual][u]])
            want = [ds.items[:film][f].id for f in sortperm(vec(S); rev = true)[1:5]]
            got = [r["id"] for r in recommend(em, ids; k = 5)["recs"]]
            @test got == want
        end
        # an empty map still gets picks (popular ones) and no explanation
        out = recommend(em, String[]; k = 3)
        @test length(out["recs"]) == 3 && all(r -> r["because"] === nothing, out["recs"])
        # films on the map and excluded ids never come back
        out = recommend(em, ["pw", "sun", "lll"]; k = 74, exclude = ["bsr"])
        @test !any(r -> r["id"] in ("lll", "bsr"), out["recs"])
        @test all(r -> r["because"] in ("pw", "sun"), out["recs"])
    end

    @testset "HTTP handler" begin
        path = tempname() * ".json"
        export_model(path, model; dataset = "test")
        em = load_exported(path)
        r = U.handle(em, HTTP.Request("GET", "/api/health"), nothing)
        @test r.status == 200
        @test JSON3.read(String(r.body)).ok == true
        body = JSON3.write(Dict("items" => ["pw", "sun"], "k" => 4))
        r = U.handle(em, HTTP.Request("POST", "/api/recommend"; body = body), nothing)
        o = JSON3.read(String(r.body))
        @test r.status == 200 && length(o.recs) == 4 && o.engine == "julia"
        r = U.handle(em, HTTP.Request("GET", "/api/recommend"), nothing)
        @test r.status == 405
        r = U.handle(em, HTTP.Request("GET", "/../secret"), joinpath(ROOT, "frontend"))
        @test r.status == 404
    end

    @testset "user test report" begin
        ev(tester, t, action, film, rank; from = "map") =
            Dict("device" => "aaaa", "tester" => tester, "t" => t, "action" => action, "from" => from, "film" => film,
                 "title" => film, "rank" => rank, "of" => 10)
        # P1 kept their top picks and skipped a low one, P2 did the opposite,
        # P3 kept something and then removed it, so P3 has no keeps left to compare
        events = [ev("P1", "1", "keep", "A", 1), ev("P1", "2", "skip", "B", 8; from = "outside"), ev("P1", "3", "keep", "C", 3),
                  ev("P2", "4", "keep", "D", 9; from = "search"), ev("P2", "5", "skip", "E", 2),
                  ev("P3", "6", "keep", "F", 4), ev("P3", "7", "remove", "F", nothing)]
        dir = mktempdir()
        write(joinpath(dir, "one.json"), JSON3.write(Dict("format" => "umix-user-test/1", "events" => events)))
        # a second export from the same device repeats P1's answers, they must count once
        write(joinpath(dir, "two.json"), JSON3.write(Dict("format" => "umix-user-test/1", "events" => events[1:3])))
        answers = load_user_test([dir])
        @test length(answers) == 7
        s = user_test_summary(answers)
        @test s.people == 3 && s.scored == 2
        @test s.pair ≈ 0.5            # P1 scores 1.0, P2 scores 0.0
        @test s.kept == 3 && s.skipped == 3 && s.removed == 1
        @test s.top3 == 3 && s.top3_kept == 2   # A and C kept, E skipped
        @test s.byfrom["map"] == (2, 2) && s.byfrom["outside"] == (0, 1)
        @test occursin("50% of the time", user_test_report(answers))
        @test occursin("No answers yet", user_test_report(UserAnswer[]))
        bad = joinpath(dir, "bad.json")
        write(bad, "{\"events\": []}")
        @test_throws ErrorException load_user_test([bad])
    end
end
