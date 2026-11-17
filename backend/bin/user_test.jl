# Report on the user test, from the JSON files the facilitator panel downloads.
#   julia --project=backend backend/bin/user_test.jl                 reads results/user_test/*.json
#   julia --project=backend backend/bin/user_test.jl a.json b.json   reads those files
# Prints the report and writes it to results/user_test_report.md.
include("cli.jl")
using Umix

_, files = parse_args(ARGS)
isempty(files) && (files = [joinpath(ROOT, "results", "user_test")])
for f in files
    ispath(f) || error("can't find $f. Put the downloaded JSON files in results/user_test/ or pass their paths.")
end

answers = load_user_test(files)
report = user_test_report(answers)
println(report)
out = joinpath(ROOT, "results", "user_test_report.md")
write(out, report)
println("wrote $out")
