run:
	cargo fmt;
	cargo run --release;

build:
	cargo fmt;
	cargo build --release --target wasm32-unknown-unknown;
	wasm-bindgen --no-typescript --target web --out-dir ./build/ --out-name "orb" ./target/wasm32-unknown-unknown/release/orb.wasm;
	cp ./src/orb.svg ./build/orb.svg;

deploy:
	rm -rf dist;
	mkdir -p dist;
	cp index.html dist/index.html;
	mv ./build dist/;
	touch package.json;
	npx gh-pages -d dist;
	rm package.json;

init:
	python3 index.py;