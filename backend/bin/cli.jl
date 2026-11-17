# Tiny helpers shared by the scripts in bin/. Arguments look like  --dim 32 --hops 2 --flag

const ROOT = normpath(joinpath(@__DIR__, "..", ".."))

function parse_args(args)
    out = Dict{String,String}()
    pos = String[]
    i = 1
    while i <= length(args)
        a = args[i]
        if startswith(a, "--")
            if i < length(args) && !startswith(args[i+1], "--")
                out[a[3:end]] = args[i+1]
                i += 2
            else
                out[a[3:end]] = "true"
                i += 1
            end
        else
            push!(pos, a)
            i += 1
        end
    end
    return out, pos
end

argint(o, k, d) = haskey(o, k) ? parse(Int, o[k]) : d
argfloat(o, k, d) = haskey(o, k) ? parse(Float64, o[k]) : d
argflag(o, k) = get(o, k, "false") == "true"
