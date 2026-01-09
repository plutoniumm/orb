run:
	cargo fmt;
	cargo run --release;

web:
	cargo fmt;
	cargo run --target wasm32-unknown-unknown --release;

init:
	python3 index.py;