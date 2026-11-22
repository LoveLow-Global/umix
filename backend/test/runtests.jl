# Run with:  julia --project=backend backend/test/runtests.jl
using Test, Random, SparseArrays, Statistics, JSON3, Lux, Optimisers, ADTypes, Enzyme
include("tiny.jl")     # Umix as U, and tiny_dataset()

rec(s) = JSON3.read(s)

@testset "um!x backend" begin
    ds = tiny_dataset()

    @testset "dataset" begin
        @test all(length(U.layers_of(ds, u)) >= 2 for u in 1:U.nusers(ds))
        @test Set(ds.split) == Set([:train, :val, :test])
        for l in LAYERS
            @test all(v -> issorted(v) && allunique(v) && all(1 .<= v .<= U.nitems(ds, l)), ds.inter[l])
        end
        path = tempname() * ".json"
        U.save_dataset(path, ds)
        ds2 = U.load_dataset(path)
        @test ds2.users == ds.users && ds2.split == ds.split && ds2.chips == ds.chips
        @test all(ds2.inter[l] == ds.inter[l] && [x.id for x in ds2.items[l]] == [x.id for x in ds.items[l]] for l in LAYERS)
    end

    @testset "Amazon records become artists, titles and brand + type" begin
        p = U.music_product(rec("""{"a":"A1","t":"1989 [Vinyl]","s":"Taylor Swift  (Artist)    Format: Vinyl","c":["CDs & Vinyl","Pop","Today's Deals in Music"],"n":10,"i":"x1","o":true}"""))
        @test p.key == "taylor swift" && p.name == "Taylor Swift" && p.tags == ["Pop"] && p.extra == "1989"
        @test U.music_product(rec("""{"a":"A2","s":"Barry, John  (Composer),     Trevor, Kirk  (Conductor)    Format: Audio CD","c":["CDs & Vinyl","Soundtracks"],"n":1}""")).name == "John Barry"
        @test U.music_product(rec("""{"a":"A3","s":"Various Artists  (Artist)    Format: Audio CD","c":["CDs & Vinyl","Pop"],"n":1}""")) === nothing
        @test U.display_name(Dict("BTS" => 3, "Bts" => 1)) == "BTS"
        @test U.display_name(Dict("KATHY MCCARTY" => 3)) == "Kathy Mccarty"
        f = U.film_product(rec("""{"a":"F1","t":"Friends: Season 8 [DVD]","c":["Movies & TV","TV"],"d":{"Genre":"Comedy/Television"},"n":5}"""))
        @test f.name == "Friends" && f.kind == "Series" && f.tags == ["Comedy"]
        f2 = U.film_product(rec("""{"a":"F2","t":"Inception (Blu-ray)","c":["Movies & TV"],"d":{"Genre":"Action & Adventure","Director":"Christopher Nolan"},"n":5}"""))
        @test f2.key == U.film_product(rec("""{"a":"F3","t":"Inception [DVD]","c":[],"d":{},"n":1}""")).key && f2.kind == "Film"
        @test U.film_product(rec("""{"a":"F4","t":"Yoga for Beginners","c":[],"d":{"Genre":"Exercise & Fitness"},"n":1}""")) === nothing
        s = U.style_product(rec("""{"a":"S1","t":"Dr. Martens Women's 1460 Boot","s":"Dr. Martens","c":["Clothing, Shoes & Jewelry","Women","Shoes","Boots","Ankle & Bootie"],"n":9}"""))
        @test s.key == "dr martens|w|boots" && s.sub == "Women’s boots" && "Boots" in s.tags
        @test U.style_product(rec("""{"a":"S2","s":"Carter's","c":["Clothing, Shoes & Jewelry","Baby","Baby Girls","Clothing"],"n":9}""")) === nothing
        # products of one entity add up
        E = U.entities(Dict(x.asin => x for x in [p, U.music_product(rec("""{"a":"A4","t":"Red","s":"Taylor Swift    Format: Audio CD","c":["CDs & Vinyl","Country"],"n":50,"i":"x2"}"""))]))
        e = E["taylor swift"]
        @test e.products == 2 && e.img == "x2" && Set(U.entity_tags(e)) == Set(["Pop", "Country"])
    end

    @testset "graph normalization" begin
        users = U.users_in(ds, :train)
        g = U.build_graph(ds, users)
        R = U.interaction_matrix(ds, :film, users)
        du, di = vec(sum(R; dims = 2)), vec(sum(R; dims = 1))
        I, J, V = findnz(g.A.film)
        @test all(isapprox(V[k], 1 / sqrt(du[I[k]] * di[J[k]]); rtol = 1e-5) for k in eachindex(V))
        @test g.At.film == sparse(transpose(g.A.film))
    end

    @testset "Enzyme gradients match finite differences" begin
        net = U.UmixNet(ds, U.ModelConfig(dim = 4, hops = 1, att_hidden = 3))
        ps, st = Lux.setup(Xoshiro(1), net)
        g = U.build_graph(ds, U.users_in(ds, :train)[1:300])
        rng = Xoshiro(2)
        sub(l) = U.make_sub(net, ds, [U.person_case(ds, u, l, rng; tagonly = 0.3) for u in U.users_in(ds, :val) if !isempty(ds.inter[l][u])][1:12], l)
        x = (graph = g, music = sub(:music), film = sub(:film), style = sub(:style))
        ts = Lux.Training.TrainState(net, ps, st, Descent(0.0))
        grads, loss, _, _ = Lux.Training.compute_gradients(AutoEnzyme(), U.batch_loss, x, ts)
        f(p) = Float64(U.batch_loss(net, p, st, x)[1])
        @test loss ≈ f(ps)
        h = 1f-2
        for (get, k) in ((p -> p.E.music, 3), (p -> p.G.style, 2), (p -> p.att.W, 4), (p -> p.heads.film.W1, 5),
                         (p -> p.bias.style, 1), (p -> p.β, 2), (p -> p.att.q, 1))
            p1, p2 = deepcopy(ps), deepcopy(ps)
            get(p1)[k] += h
            get(p2)[k] -= h
            @test isapprox(get(grads)[k], (f(p1) - f(p2)) / 2h; rtol = 0.05, atol = 2e-3)
        end
    end

    m = U.train(ds, U.ModelConfig(dim = 16, hops = 2, att_hidden = 8), U.TrainConfig(epochs = 8, batch = 128, lr = 0.02); log = devnull)

    @testset "training learns more than popularity" begin
        res = U.evaluate_all(ds, [U.ScorePopular(ds), U.ScoreKNN(ds), U.ScoreModel(m)])
        ours = mean(U.mean_metric(res[t], m.name, "ndcg@10") for t in LAYERS)
        pop = mean(U.mean_metric(res[t], "Popularity", "ndcg@10") for t in LAYERS)
        @test ours > pop + 0.1
        p = U.paired(res[:style], m.name, "Popularity")
        @test p.lo <= p.diff <= p.hi && p.n == length(res[:style].cases)
    end

    @testset "export round trip ranks like the trained model" begin
        dir = mktempdir()
        U.export_model(dir, m, ds)
        em = U.load_exported(dir)
        @test sort(readdir(dir)) == ["film.json", "manifest.json", "music.json", "search.json", "style.json", "vectors.bin"]
        Z = U.item_vectors(m)
        for t in LAYERS, c in U.hidden_layer_cases(ds, U.users_in(ds, :test), t)[1:5]
            S = vec(U.sub_scores(m.net, m.ps, Z, U.make_sub(m.net, ds, [(c.given, c.hidden)], t), t))
            picks, w = U.recommend(em, Dict(l => [(:graph, i) for (i, _) in v] for (l, v) in c.given), t; k = 5)
            @test [p.i for p in picks][1:3] == partialsortperm(S, 1:3; rev = true)
            @test sum(values(w)) ≈ 1 && w[t] == 0
            @test all(p -> p.because !== nothing && haskey(c.given, p.because[1]), picks) || sum(length, values(c.given)) == 1
        end
        # a genre chip on its own still gives picks
        picks, _ = U.recommend(em, Dict(:music => [(:tags, [1])]), :film; k = 3)
        @test length(picks) == 3
    end

    @testset "user test report" begin
        ev(tester, t, action, layer, id, rank; from = "discover") = Dict("device" => "aaaa", "tester" => tester, "t" => t, "action" => action,
            "from" => from, "layer" => layer, "id" => id, "name" => id, "rank" => rank, "of" => 10)
        # P1 kept top picks and skipped a low one in style, P2 did the opposite in film,
        # P3 kept something and then removed it, so P3 has no keeps left to compare
        events = [ev("P1", "1", "keep", "style", "A", 1), ev("P1", "2", "skip", "style", "B", 8; from = "discover/style"),
                  ev("P1", "3", "keep", "style", "C", 3), ev("P2", "4", "keep", "film", "D", 9; from = "item"),
                  ev("P2", "5", "skip", "film", "E", 2), ev("P3", "6", "keep", "music", "F", 4), ev("P3", "7", "remove", "music", "F", nothing; from = "me")]
        dir = mktempdir()
        write(joinpath(dir, "one.json"), JSON3.write(Dict("format" => "umix-user-test/2", "events" => events)))
        write(joinpath(dir, "two.json"), JSON3.write(Dict("format" => "umix-user-test/2", "events" => events[1:3])))
        answers = U.load_user_test([dir])
        @test length(answers) == 7
        s = U.user_test_summary(answers)
        @test s.people == 3 && s.scored == 2
        @test s.pair.mean ≈ 0.5            # P1 style scores 1.0, P2 film scores 0.0
        @test s.by_layer["style"].pair.mean ≈ 1.0 && s.by_layer["film"].pair.mean ≈ 0.0
        @test s.kept == 3 && s.skipped == 3 && s.removed == 1
        @test s.top3 == 3 && s.top3_kept == 2   # A and C kept, E skipped
        @test s.layers["style"] == (2, 1) && s.pages["me"] == (0, 1)
        @test occursin("50% of the time", U.user_test_report(answers))
        @test occursin("No answers yet", U.user_test_report(U.UserAnswer[]))
        bad = joinpath(dir, "bad.json")
        write(bad, "{\"events\": []}")
        @test_throws ErrorException U.load_user_test([bad])
    end
end
