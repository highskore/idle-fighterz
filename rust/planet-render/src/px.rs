//! px.wasm's kernels (`planet`, `outline`, `rim`) over a `Framebuffer`. The kernel source is shared with `wasm/`
//! (it includes `px_kernels.rs`), so the shipped module and the native build run the same code. The kernels keep
//! px.wasm's calling convention (buffers and arguments in statics), so calls are serialised through a lock.
#![allow(static_mut_refs, clippy::missing_safety_doc)]

use std::ptr::addr_of_mut;
use std::sync::Mutex;

use crate::Framebuffer;

static mut BUF: *mut u32 = std::ptr::null_mut();
static mut ZB: *mut f32 = std::ptr::null_mut();
static mut IB: *mut u16 = std::ptr::null_mut();
static mut LC: *mut f64 = std::ptr::null_mut();
static mut ROWS: *mut i32 = std::ptr::null_mut();
static mut BOX: [i32; 4] = [0; 4];
static mut LKEY: [f64; 5] = [f64::NAN; 5];
static mut W: usize = 0;
static mut H: usize = 0;
static mut P: [f64; 24] = [0.0; 24];
static mut PAL: [u32; 16] = [0; 16];

unsafe fn js_pow(x: f64, y: f64) -> f64 {
    planet_core::jsmath::pow(x, y)
}

mod kernels {
    #![allow(dead_code, clippy::all)]
    use super::*;
    include!("px_kernels.rs");
}

static LOCK: Mutex<()> = Mutex::new(());

/// What a kernel needs beyond the framebuffer's own buffers: the planet's lighting cache and the per-row spans.
#[derive(Clone, Debug, Default)]
pub struct PxCache {
    lc: Vec<f64>,
    rows: Vec<i32>,
    key: [f64; 5],
}

fn with<R>(fb: &mut Framebuffer, f: impl FnOnce() -> R) -> R {
    let _g = LOCK.lock().unwrap_or_else(|e| e.into_inner());
    let n = fb.w * fb.h;
    let c = &mut fb.px;
    if c.lc.len() != n * 5 {
        c.lc = vec![0.0; n * 5];
        c.rows = vec![0; fb.h * 2];
        c.key = [f64::NAN; 5];
    }
    // SAFETY: the lock serialises every kernel call, and the pointers stay valid for the call's length
    unsafe {
        BUF = fb.buf.as_mut_ptr();
        ZB = fb.zb.as_mut_ptr();
        IB = fb.ib.as_mut_ptr();
        LC = c.lc.as_mut_ptr();
        ROWS = c.rows.as_mut_ptr();
        LKEY = c.key;
        W = fb.w;
        H = fb.h;
        let r = f();
        c.key = LKEY;
        r
    }
}

/// px.wasm `planet()`: the planet sphere on a plain grass world. `p` is game.js's params (X Y Z pr id, M, L, N, the
/// two palette lengths), `grass` and `road` the palettes (at most 8 tones each).
pub fn planet(fb: &mut Framebuffer, p: &[f64; 22], grass: &[u32], road: &[u32]) {
    with(fb, || unsafe {
        P[..22].copy_from_slice(p);
        PAL = [0; 16];
        PAL[..grass.len()].copy_from_slice(grass);
        PAL[8..8 + road.len()].copy_from_slice(road);
        kernels::planet();
    })
}

/// px.wasm `outline()`: the dark line between overlapping solids and the halo round them.
pub fn outline(fb: &mut Framebuffer) {
    with(fb, || unsafe { kernels::outline() })
}

/// px.wasm `rim()`: the floating widget's 1px rim; returns the box round everything drawn (x0, y0, x1, y1).
pub fn rim(fb: &mut Framebuffer) -> [i32; 4] {
    with(fb, || unsafe {
        kernels::rim();
        BOX
    })
}
