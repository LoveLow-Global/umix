#!/usr/bin/env bash
# Grabs the parts of Amazon Reviews 2023 (McAuley Lab, UCSD) that we need and cuts them
# down to people who show up in all three of our domains.
#   music   = CDs & Vinyl
#   fashion = Clothing, Shoes & Jewelry   (our "visual / fashion" layer)
#   film/TV = Movies & TV                 (the thing we predict)
# Only the id files get kept in full. Big files get streamed and filtered on the fly.
# Run it from anywhere:  bash scripts/fetch_amazon.sh
# Set FASHION_META=1 if you also want fashion titles (that file is about 4 GB to stream).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
D="$ROOT/data/raw/amazon2023"
BASE="https://mcauleylab.ucsd.edu/public_datasets/data/amazon_2023"
mkdir -p "$D"

get() { # url, output file
  if [ ! -s "$2" ]; then
    echo "downloading $(basename "$2")"
    curl -sSfL -o "$2.part" "$1" && mv "$2.part" "$2"
  fi
}

# 1. music and film ratings, 5-core, ids only (about 21 MB and 111 MB)
get "$BASE/benchmark/5core/rating_only/CDs_and_Vinyl.csv.gz" "$D/CDs_and_Vinyl.5core.csv.gz"
get "$BASE/benchmark/5core/rating_only/Movies_and_TV.csv.gz" "$D/Movies_and_TV.5core.csv.gz"

# 2. people who rated both music and film
if [ ! -s "$D/users_music_film.txt" ]; then
  echo "finding music + film users"
  gunzip -c "$D/CDs_and_Vinyl.5core.csv.gz" | tail -n +2 | cut -d, -f1 | sort -u > "$D/u_music.txt"
  gunzip -c "$D/Movies_and_TV.5core.csv.gz" | tail -n +2 | cut -d, -f1 | sort -u > "$D/u_film.txt"
  comm -12 "$D/u_music.txt" "$D/u_film.txt" > "$D/users_music_film.txt"
fi

# 3. fashion ratings, streamed (about 400 MB), only rows for those people get saved
F="$D/Clothing_Shoes_and_Jewelry.5core.overlap.csv.gz"
if [ ! -s "$F" ]; then
  echo "streaming fashion ratings"
  curl -sSfL "$BASE/benchmark/5core/rating_only/Clothing_Shoes_and_Jewelry.csv.gz" | gunzip -c |
    awk -F, 'NR==FNR { u[$1] = 1; next } FNR == 1 || ($1 in u)' "$D/users_music_film.txt" - |
    gzip > "$F.part"
  mv "$F.part" "$F"
fi

# 4. people in all three, plus their music and film rows
gunzip -c "$F" | tail -n +2 | cut -d, -f1 | sort -u > "$D/users_all3.txt"
for dom in CDs_and_Vinyl Movies_and_TV; do
  out="$D/$dom.5core.overlap.csv.gz"
  if [ ! -s "$out" ]; then
    gunzip -c "$D/$dom.5core.csv.gz" |
      awk -F, 'NR==FNR { u[$1] = 1; next } FNR == 1 || ($1 in u)' "$D/users_all3.txt" - | gzip > "$out"
  fi
  gunzip -c "$out" | tail -n +2 | cut -d, -f2 | sort -u > "$D/items_$dom.txt"
done
gunzip -c "$F" | tail -n +2 | cut -d, -f2 | sort -u > "$D/items_Clothing_Shoes_and_Jewelry.txt"

# 5. titles and categories, streamed, only for items those people touched
meta() { # category name
  local out="$D/meta_$1.overlap.jsonl.gz"
  if [ ! -s "$out" ]; then
    echo "streaming metadata for $1"
    curl -sSfL "$BASE/raw/meta_categories/meta_$1.jsonl.gz" | gunzip -c |
      ASINS="$D/items_$1.txt" perl -ne 'BEGIN { open(F, "<", $ENV{ASINS}) or die; while (<F>) { chomp; $w{$_} = 1 } close F }
        print if /"parent_asin": "([A-Z0-9]+)"/ && $w{$1}' | gzip > "$out.part"
    mv "$out.part" "$out"
  fi
}
meta Movies_and_TV
meta CDs_and_Vinyl
if [ "${FASHION_META:-0}" = "1" ]; then meta Clothing_Shoes_and_Jewelry; fi

echo "done"
wc -l "$D/users_music_film.txt" "$D/users_all3.txt" "$D"/items_*.txt
