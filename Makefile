# Shortcuts. Run `make help` to see them.
JULIA = julia --project=backend

.PHONY: help setup amazon data train train-quick web web-build test parity user-test

help:
	@echo "make setup        install the Julia and website packages (first time only)"
	@echo "make amazon       download the Amazon data (streams about 5 GB, keeps about 600 MB)"
	@echo "make data         turn it into artists, titles and brand + type, and who saved what"
	@echo "make train        train the model with ablations, run the hidden-layer test, export the website files"
	@echo "make train-quick  same without the ablations"
	@echo "make web          run the website on http://localhost:5173"
	@echo "make web-build    build the website into webpage/dist, the same way Vercel does"
	@echo "make test         Julia tests, then the browser engine against Julia"
	@echo "make user-test    report on the user test answers in results/user_test/"

setup:
	$(JULIA) -e 'using Pkg; Pkg.instantiate()'
	npm install --prefix webpage

amazon:
	bash scripts/fetch_amazon.sh

data:
	$(JULIA) backend/bin/prep.jl

train:
	$(JULIA) backend/bin/train.jl --ablations

train-quick:
	$(JULIA) backend/bin/train.jl

web:
	npm install --prefix webpage
	npm run dev --prefix webpage

web-build:
	npm install --prefix webpage
	npm run build --prefix webpage

user-test:
	$(JULIA) backend/bin/user_test.jl

parity:
	$(JULIA) backend/bin/parity_fixture.jl
	node scripts/check_parity.mjs

test:
	$(JULIA) backend/test/runtests.jl
	$(MAKE) parity
