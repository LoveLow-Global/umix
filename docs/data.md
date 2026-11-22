# The data

um!x runs on one real dataset, Amazon Reviews 2023 (Hou et al., 2024, McAuley Lab at UC San Diego). Nothing in the app is made up.

## Why Amazon

We wanted the same people's taste in music, clothes and film. No public dataset has Spotify, Pinterest and Netflix for the same people. Amazon is the closest thing. One reviewer id covers all of a person's reviews, so the same person shows up in

* **music**, the CDs & Vinyl category
* **style**, the Clothing, Shoes & Jewelry category
* **film**, the Movies & TV category

A rating of 4 or 5 stars counts as a save. Lower ratings get dropped.

## What we download

`scripts/fetch_amazon.sh` (or `make amazon`) streams the files and only keeps what we need, so about 600 MB stays on disk out of about 5 GB streamed.

1. The 5-core rating files for music and film, and the style ratings of anyone who also has music or film.
2. Everyone with ratings in at least two of the three layers. That's 218,584 people.
3. The metadata of every product those people rated, plus products popular enough on Amazon that someone might search for them. `backend/bin/compact_meta.jl` keeps only the title, brand or artist, category path, genre, director and actors, rating count and the main image id.

## Products become the things people name

People don't think in Amazon products. Nobody says "I love the 2014 remastered CD of 1989". So products get merged (`backend/src/entities.jl`).

| layer | one item is | how | example |
|---|---|---|---|
| music | an artist | the artist named on the CD. "Barry, John" becomes "John Barry", "Various Artists" is dropped | Taylor Swift |
| film | a film or series | DVD, Blu-ray, VHS and streaming editions get merged by title, and seasons fold into their series | Friends, Inception |
| style | a brand plus a product type | brand and Amazon's category path | Dr. Martens, women's boots |

Some style things are left out because they say little about someone's style. Those are kids' and baby clothes, costumes, novelty print shirts, underwear, socks and sleepwear. Exercise and instructional DVDs are left out of film too.

## Tags come from Amazon's labels

Every item also gets tags from Amazon's own labels, added up over its products. A tag sticks if it's on at least a fifth of them.

* music gets genres from the CDs & Vinyl tree, like Pop, Country or Korean Pop. That's how Taylor Swift ends up tagged Pop and Country without anyone typing it in.
* film gets one of about 20 genres. Amazon's messy Genre field ("Comedy/Television", "DVD Movie") gets mapped to a short list.
* style gets the product type, its group, the section (women's, men's) and the brand.

Tags matter for two things. The model uses them next to each item's learned vector, and an item too rare for the graph can still count through its tags.

## Cleaning

A dense core keeps every item with enough fans (10 for music and style, 12 for film) and every person with enough saves in at least two layers (2 artists, 3 titles, 2 style items). It repeats until nothing changes. Then people get split 80/10/10 into train, validation and test.

| | count |
|---|---|
| people | 105,526 (84,420 train, 10,553 validation, 10,553 test) |
| music | 7,087 artists, 420,445 saves |
| film | 18,153 films and series, 964,007 saves |
| style | 11,541 brand and type items, 565,306 saves |
| film and style | 59,548 people |
| music and film | 21,240 people |
| music and style | 14,930 people |
| all three | 9,808 people |

On top of the graph items, each layer keeps 10,000 search-only items. These are real artists, titles and brands that are too rare in our data for the graph, like newer K-pop acts, ranked by how many ratings they have on Amazon. You can find them during onboarding and they steer your picks through their tags.

## Limits

* Amazon buyers aren't Spotify listeners. CD buyers skew older, so classic rock is very big and newer artists are rare.
* A purchase isn't the same as taste. People buy gifts, and they buy basics.
* Amazon has no age or gender, so the model can't use either. Style items do carry their women's or men's section, which the app uses to filter style picks.
* Covers and product photos load from Amazon's image links. That's fine for a class prototype, a real launch would need permission.
