run:
	cargo fmt;
	cargo run --release;

build:
	cargo fmt;
	cargo build --release --target wasm32-unknown-unknown;
	wasm-bindgen --no-typescript --target web --out-dir ./build/ --out-name "orb" ./target/wasm32-unknown-unknown/release/orb.wasm;
	cp ./src/orb.svg ./build/orb.svg;
	sed -i '' 's/fetch(module_or_path);/patch(module_or_path);/g' ./build/orb.js;

prep:
	rm -rf dist;
	mkdir -p dist;
	cp index.html dist/index.html;
	mv ./build dist/;

deploy:
	rm -rf dist;
	mkdir -p dist;
	cp index.html dist/index.html;
	mv ./build dist/;
	touch package.json;
	npx gh-pages -d dist;
	rm -rf package.json node_modules;

init:
	python3 index.py;