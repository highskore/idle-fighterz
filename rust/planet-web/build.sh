#!/bin/sh
# Builds the wasm HUD bridge into rust/planet-web/pkg/ (gitignored), which `node build.mjs --rust` inlines.
# Needs Rust with the wasm32 target and wasm-bindgen-cli at the version Cargo.toml pins:
#   rustup target add wasm32-unknown-unknown && cargo install wasm-bindgen-cli --version 0.2.129
set -e
cd "$(dirname "$0")/.."
cargo build --release --target wasm32-unknown-unknown -p planet-web
wasm-bindgen --target no-modules --no-typescript --out-dir planet-web/pkg target/wasm32-unknown-unknown/release/planet_web.wasm
ls -l planet-web/pkg
