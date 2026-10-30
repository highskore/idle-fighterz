//! Draws a preview hook's frames to PPM files, for looking at scenes outside a browser:
//! `cargo run --release -p planet-render --example limitshot -- '#limit1' 360 225 site out/prefix 0.5 3.0 [fps=15]`
//! (hook, buffer width and height, `site` or `bare` (the widget), output prefix, then seconds of play to draw at; with
//! `fps=N`, every frame from the first time to the last at N a second). Prints the toasts as they come.

use planet_core::Game;
use planet_render::scene::{Scene, View};
use planet_render::Framebuffer;
use std::io::Write;

fn main() {
    let a: Vec<String> = std::env::args().collect();
    let (hook, w, h, bare, out) = (a[1].as_str(), a[2].parse::<usize>().unwrap(), a[3].parse::<usize>().unwrap(), a[4] == "bare", a[5].clone());
    let mut times: Vec<f64> = Vec::new();
    let mut fps = 0.0;
    for s in &a[6..] {
        match s.strip_prefix("fps=") {
            Some(f) => fps = f.parse().unwrap(),
            None => times.push(s.parse().unwrap()),
        }
    }
    if fps > 0.0 {
        let (t0, t1) = (times[0], times[times.len() - 1]);
        times = (0..=((t1 - t0) * fps).round() as usize).map(|i| t0 + i as f64 / fps).collect();
    }
    let mut g = Game::new(1);
    g.set_view(w as f64, h as f64, bare);
    g.preview(hook);
    g.start();
    let view = View { scale: 2.0, bare, clouds: None, cloud_amt: 2.0 };
    let mut fb = Framebuffer::new(w, h);
    let mut sc = Scene::new();
    sc.own_rng = Some(planet_core::rng::Lcg::new(7));
    let dt = 1.0 / 30.0;
    let (mut t, mut n) = (0.0, 0);
    for &at in &times {
        while t < at - 1e-9 {
            t += dt;
            g.sim(t, dt);
            sc.draw(&mut fb, &mut g, &view, dt);
            g.timeouts();
            for (s, _) in g.events.drain(..) {
                eprintln!("{t:.2}s toast: {s}");
            }
        }
        let mut f = std::fs::File::create(format!("{out}-{n:03}.ppm")).unwrap();
        write!(f, "P6\n{w} {h}\n255\n").unwrap();
        let mut px = Vec::with_capacity(w * h * 3);
        for &v in &fb.buf {
            let al = (v >> 24) as f64 / 255.0;
            for (j, sh) in [0, 8, 16].iter().enumerate() {
                px.push((((v >> sh) & 255) as f64 * al + [0x2a, 0x3a, 0x55][j] as f64 * (1.0 - al)).round() as u8);
            }
        }
        f.write_all(&px).unwrap();
        n += 1;
    }
}
