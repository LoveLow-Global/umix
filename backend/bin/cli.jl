# Tiny helpers shared by the scripts in bin/. Arguments look like  --dim 64 --hops 2 --flag

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

"writes to two places at once, like the screen and a log file"
struct Tee <: IO
    a::IO
    b::IO
end
Base.write(t::Tee, x::UInt8) = (write(t.a, x); write(t.b, x))
Base.unsafe_write(t::Tee, p::Ptr{UInt8}, n::UInt) = (unsafe_write(t.a, p, n); unsafe_write(t.b, p, n))
Base.flush(t::Tee) = (flush(t.a); flush(t.b))
