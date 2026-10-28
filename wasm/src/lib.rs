// The game's per-pixel hot loops, compiled to WebAssembly. The pixel, depth, id and mask buffers live in this module's
// memory, and the page draws into them through typed-array views, so nothing is copied per frame. Every function is a
// line-for-line port of its JS twin in game.js / widget.js, with the same float operations in the same order, so the
// pixels come out identical; the only transcendental (Math.pow) is imported from JS for the same reason.
use std::arch::wasm32;
use std::ptr::addr_of_mut;

#[link(wasm_import_module = "js")]
extern "C" {
    #[link_name = "pow"]
    fn js_pow(x: f64, y: f64) -> f64;
}
extern "C" {
    static __heap_base: u8;
}

static mut BUF: *mut u32 = 0 as *mut u32;
static mut ZB: *mut f32 = 0 as *mut f32;
static mut IB: *mut u16 = 0 as *mut u16;
// the planet's lighting per pixel of its box (sq, lum and the normal a, b, c; sq < 0 outside the disc): it depends only on where the planet
// sits and its size, not on how it's turned, so it's kept while those stay put (the planet only moves when the screen shakes)
static mut LC: *mut f64 = 0 as *mut f64;
// per row, the span (first, last x) a pass has to visit; i32::MAX, -1 when the row is empty
static mut ROWS: *mut i32 = 0 as *mut i32;
// what rim() leaves for the page: the box round everything not fully transparent (x0, y0, x1, y1; x1 < x0 when empty)
static mut BOX: [i32; 4] = [0; 4];
static mut LKEY: [f64; 5] = [f64::NAN; 5];
static mut W: usize = 0;
static mut H: usize = 0;
// call arguments that don't fit in a signature: see planet()
static mut P: [f64; 24] = [0.0; 24];
static mut PAL: [u32; 16] = [0; 16];

#[no_mangle]
pub extern "C" fn params() -> *mut f64 {
    addr_of_mut!(P) as *mut f64
}

#[no_mangle]
pub extern "C" fn bbox() -> *mut i32 {
    addr_of_mut!(BOX) as *mut i32
}

#[no_mangle]
pub extern "C" fn palette() -> *mut u32 {
    addr_of_mut!(PAL) as *mut u32
}

// lays out the stage's buffers for a w×h canvas and returns where they start: the pixels (u32 × n), depth (f32 × n),
// ids (u16 × n), the mask (u8 × n), the planet's lighting (5 × f64 × n), then two spans per row (4 × i32 × h). growing the memory detaches every view, so the page rebuilds them after each call
#[no_mangle]
pub unsafe extern "C" fn alloc(w: u32, h: u32) -> usize {
    let n = (w * h) as usize;
    let base = ((&__heap_base as *const u8 as usize) + 15) & !15;
    let lc = (base + n * 11 + 7) & !7;
    let rows = lc + n * 40;
    let end = rows + h as usize * 16;
    let have = wasm32::memory_size(0) * 65536;
    if end > have {
        wasm32::memory_grow(0, (end - have + 65535) / 65536);
    }
    BUF = base as *mut u32;
    ZB = (base + n * 4) as *mut f32;
    IB = (base + n * 8) as *mut u16;
    LC = lc as *mut f64;
    ROWS = rows as *mut i32;
    LKEY = [f64::NAN; 5];
    W = w as usize;
    H = h as usize;
    base
}

include!("../../rust/planet-render/src/px_kernels.rs");
