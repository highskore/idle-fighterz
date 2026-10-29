// cargo's runner for planet-core's tests built for wasm32-wasip1 (CI runs jsmath's there, where fma is emulated): node's WASI
import { readFileSync } from 'node:fs'
import { WASI } from 'node:wasi'
const [file, ...args] = process.argv.slice(2)
const wasi = new WASI({ version: 'preview1', args: [file, ...args], env: process.env, preopens: {} })
const { instance } = await WebAssembly.instantiate(readFileSync(file), wasi.getImportObject())
process.exit(wasi.start(instance))
