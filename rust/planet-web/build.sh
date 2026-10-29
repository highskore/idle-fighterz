#!/bin/sh
# Builds the ?rust engine into rust/planet-web/pkg/ (gitignored), which `node build.mjs` writes next to the site page.
# Needs Rust with the wasm32 target and wasm-bindgen-cli at the version Cargo.toml pins, and node (npx fetches binaryen's
# wasm-opt at a pinned version):
#   rustup target add wasm32-unknown-unknown && cargo install wasm-bindgen-cli --version 0.2.129
set -e
cd "$(dirname "$0")/.."
cargo build --profile wasm --target wasm32-unknown-unknown -p planet-web
wasm-bindgen --target no-modules --no-typescript --out-dir planet-web/pkg target/wasm32-unknown-unknown/wasm/planet_web.wasm
# the features rustc's wasm32 target turns on, so wasm-opt neither rejects them nor adds others
npx --yes -p binaryen@132.0.0 wasm-opt -Oz --enable-bulk-memory --enable-nontrapping-float-to-int --enable-sign-ext \
  --enable-mutable-globals --enable-reference-types --enable-multivalue -o planet-web/pkg/planet_web_bg.wasm planet-web/pkg/planet_web_bg.wasm
ls -l planet-web/pkg
