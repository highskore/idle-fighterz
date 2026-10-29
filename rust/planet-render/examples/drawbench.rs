//! Native frame timing for planet-render, for profiling: `cargo run --release -p planet-render --example drawbench -- '#top' 195 380 2 600`
//! (hook, buffer width and height, pixel scale, drawn frames). Prints the mean and p95 of the draw alone.

use planet_core::Game;
use planet_render::scene::{Scene, View};
use planet_render::Framebuffer;
use std::time::Instant;

fn main() {
    let a: Vec<String> = std::env::args().collect();
    let hook = a.get(1).map_or("", |s| s.as_str());
    let w: usize = a.get(2).map_or(195, |s| s.parse().unwrap());
    let h: usize = a.get(3).map_or(380, |s| s.parse().unwrap());
    let scale: f64 = a.get(4).map_or(2.0, |s| s.parse().unwrap());
    let frames: usize = a.get(5).map_or(600, |s| s.parse().unwrap());
    let mut g = Game::new(1);
    g.set_view(w as f64, h as f64, false);
    g.preview(hook);
    g.start();
    let view = View { scale, bare: false, clouds: None, cloud_amt: 2.0 };
    let mut fb = Framebuffer::new(w, h);
    let mut sc = Scene::new();
    let dt = 1.0 / 30.0;
    let mut t = 0.0;
    let mut ms = Vec::with_capacity(frames);
    for f in 0..frames + 60 {
        t += dt;
        g.sim(t, dt);
        let t0 = Instant::now();
        sc.draw(&mut fb, &mut g, &view, dt);
        if f >= 60 {
            ms.push(t0.elapsed().as_secs_f64() * 1e3);
        }
        g.timeouts();
    }
    let mean = ms.iter().sum::<f64>() / ms.len() as f64;
    ms.sort_by(|a, b| a.partial_cmp(b).unwrap());
    let p95 = ms[ms.len() * 95 / 100];
    let sum: u64 = fb.buf.iter().map(|&p| p as u64).sum();
    println!("{hook} {w}x{h}: mean {mean:.3} ms, p95 {p95:.3} ms, max {:.3} ms (checksum {sum})", ms[ms.len() - 1]);
}
