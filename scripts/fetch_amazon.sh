#!/usr/bin/env bash
# Grabs the parts of Amazon Reviews 2023 (McAuley Lab, UCSD) that um!x uses.
#   music = CDs & Vinyl
#   style = Clothing, Shoes & Jewelry
#   film  = Movies & TV
# A person counts if they rated things in at least two of the three. Big files get streamed and
# cut down on the fly, so only about 150 MB stays on disk. Run it from anywhere:
#   bash scripts/fetch_amazon.sh
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
D="$ROOT/data/raw/amazon2023"
BASE="https://mcauleylab.ucsd.edu/public_datasets/data/amazon_2023"
JULIA="julia --project=$ROOT/backend --startup-file=no"
mkdir -p "$D"

get() { # url, output file
  if [ ! -s "$2" ]; then
    echo "downloading $(basename "$2")"
    curl -sSfL -o "$2.part" "$1" && mv "$2.part" "$2"
  fi
}
keep_users() { # users file, then reads csv from stdin and keeps the header plus their rows
  awk -F, 'NR==FNR { u[$1] = 1; next } FNR == 1 || ($1 in u)' "$1" -
}

# 1. ratings, 5-core, ids only. Music and film in full (about 21 MB and 111 MB).
get "$BASE/benchmark/5core/rating_only/CDs_and_Vinyl.csv.gz" "$D/CDs_and_Vinyl.5core.csv.gz"
get "$BASE/benchmark/5core/rating_only/Movies_and_TV.csv.gz" "$D/Movies_and_TV.5core.csv.gz"
[ -s "$D/u_music.txt" ] || gunzip -c "$D/CDs_and_Vinyl.5core.csv.gz" | tail -n +2 | cut -d, -f1 | sort -u > "$D/u_music.txt"
[ -s "$D/u_film.txt" ] || gunzip -c "$D/Movies_and_TV.5core.csv.gz" | tail -n +2 | cut -d, -f1 | sort -u > "$D/u_film.txt"

# 2. style ratings streamed (about 380 MB), only rows of people who also have music or film
F="$D/Clothing_Shoes_and_Jewelry.5core.mf.csv.gz"
if [ ! -s "$F" ]; then
  echo "streaming style ratings"
  sort -u "$D/u_music.txt" "$D/u_film.txt" > "$D/u_music_or_film.txt"
  curl -sSfL "$BASE/benchmark/5core/rating_only/Clothing_Shoes_and_Jewelry.csv.gz" | gunzip -c |
    keep_users "$D/u_music_or_film.txt" | gzip > "$F.part"
  mv "$F.part" "$F"
fi
[ -s "$D/u_style.txt" ] || gunzip -c "$F" | tail -n +2 | cut -d, -f1 | sort -u > "$D/u_style.txt"

# 3. people in at least two layers, and their rows in each layer
sort "$D/u_music.txt" "$D/u_film.txt" "$D/u_style.txt" | uniq -d > "$D/users_2plus.txt"
for dom in CDs_and_Vinyl Movies_and_TV Clothing_Shoes_and_Jewelry; do
  src="$D/$dom.5core.csv.gz"; [ "$dom" = Clothing_Shoes_and_Jewelry ] && src="$F"
  out="$D/$dom.2plus.csv.gz"
  [ -s "$out" ] || gunzip -c "$src" | keep_users "$D/users_2plus.txt" | gzip > "$out"
  gunzip -c "$out" | tail -n +2 | cut -d, -f2 | sort -u > "$D/items_$dom.2plus.txt"
done

# 4. metadata streamed (about 225 MB, 260 MB and 3.9 GB), keeping our items plus popular ones
meta() { # category, minimum number of Amazon ratings for an item nobody of ours rated
  local out="$D/meta_$1.compact.jsonl.gz"
  if [ ! -s "$out" ]; then
    echo "streaming metadata for $1"
    curl -sSfL "$BASE/raw/meta_categories/meta_$1.jsonl.gz" | gunzip -c |
      $JULIA "$ROOT/backend/bin/compact_meta.jl" "$D/items_$1.2plus.txt" "$2" | gzip > "$out.part"
    mv "$out.part" "$out"
  fi
}
meta CDs_and_Vinyl 20
meta Movies_and_TV 20
meta Clothing_Shoes_and_Jewelry 100

echo "done"
wc -l "$D/users_2plus.txt" "$D"/items_*.2plus.txt
