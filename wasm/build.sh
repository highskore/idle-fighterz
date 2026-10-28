#!/bin/sh
# Rebuilds px.wasm from src/lib.rs. Needs Rust with the wasm32 target (rustup target add wasm32-unknown-unknown); the
# built module is committed, so building the page needs only Node.
set -e
cd "$(dirname "$0")"
cargo build --release --target wasm32-unknown-unknown
cp target/wasm32-unknown-unknown/release/px.wasm px.wasm
