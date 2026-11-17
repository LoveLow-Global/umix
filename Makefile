# Shortcuts. Run `make help` to see them.
JULIA = julia --project=backend

.PHONY: help setup synthetic amazon train train-amazon serve static web web-build user-test test parity

help:
	@echo "make setup         install the Julia packages (first time only)"
	@echo "make synthetic     build the synthetic maps for the demo catalogue"
	@echo "make train         train on the synthetic maps and update the app model"
	@echo "make amazon        download and build the real Amazon dataset (about 500 MB to stream)"
	@echo "make train-amazon  train and test on the Amazon data"
	@echo "make serve         Julia API + web app on http://localhost:8080"
	@echo "make static        plain web app only, model runs in the browser, http://localhost:8090"
	@echo "make web           the React site (webpage/) for Vercel, http://localhost:5173"
	@echo "make web-build     build the React site into webpage/dist, same as Vercel does"
	@echo "make user-test     report on the user test answers in results/user_test/"
	@echo "make test          Julia tests plus the Julia vs browser check"

setup:
	$(JULIA) -e 'using Pkg; Pkg.instantiate()'

synthetic:
	$(JULIA) backend/bin/make_synthetic.jl

train:
	$(JULIA) backend/bin/train.jl synthetic --ablations

amazon:
	bash scripts/fetch_amazon.sh
	$(JULIA) backend/bin/prep_amazon.jl

train-amazon:
	$(JULIA) backend/bin/train.jl amazon --dim 64 --hops 3 --lr 0.005 --wd 1.0 --drop 0.3 --eval-every 1 --patience 5 --ablations

serve:
	julia --threads=1,1 --project=backend backend/bin/serve.jl --port 8080

static:
	python3 -m http.server 8090 --directory frontend

web:
	npm install --prefix webpage
	npm run dev --prefix webpage

web-build:
	npm install --prefix webpage
	npm run build --prefix webpage

user-test:
	$(JULIA) backend/bin/user_test.jl

test:
	$(JULIA) backend/test/runtests.jl
	$(JULIA) backend/bin/parity_fixture.jl
	node scripts/check_parity.mjs
