//! Framebuffer diff: game.js (headless, drawing its last frames; rust/difftest/frame.js) against planet-render, same
//! seed, preview hook, canvas size and frame. The RGBA buffers must match byte for byte. Needs `node`; skips without.
//! `FRAMEDIFF=<substring>` runs only the cases whose name contains it; `FRAMEDIFF_PNG=1` writes the JS, Rust and diff
//! images of failing cases under the test's temp dir.

use planet_core::Game;
use planet_render::scene::{Scene, View};
use planet_render::Framebuffer;
use serde_json::Value;
use std::path::{Path, PathBuf};
use std::process::Command;

#[derive(Clone)]
struct Case {
    hook: &'static str,
    /// canvas size in CSS pixels
    w: u32,
    h: u32,
    frames: u32,
    draw: u32,
    widget: Option<Option<(char, u32)>>,
    /// expected to match: the parts of the scene this case shows are ported
    must: bool,
}

const DESK: (u32, u32) = (1200, 700);
const PHONE: (u32, u32) = (390, 760);

fn c(hook: &'static str, (w, h): (u32, u32), frames: u32, must: bool) -> Case {
    Case { hook, w, h, frames, draw: 1, widget: None, must }
}

fn cases() -> Vec<Case> {
    let mut v = vec![
        c("", DESK, 200, true),
        c("", PHONE, 200, true),
        Case { draw: 4, ..c("", DESK, 400, true) },
        c("#namek", DESK, 400, true),
        c("#vegeta", DESK, 400, true),
        c("#vegeta", PHONE, 400, true),
        c("#beerus", DESK, 400, true),
        c("#westcity", DESK, 400, true),
        c("#westcity", PHONE, 400, true),
        c("#kame", DESK, 400, true),
        c("#paozu", DESK, 400, true),
        c("#future", DESK, 400, true),
        c("#lookout", DESK, 400, true),
        c("#kaiworld", DESK, 400, true),
        c("#yardrat", DESK, 400, true),
        c("#top", DESK, 60, true),
        c("#top", PHONE, 60, true),
        c("#snake", DESK, 400, true),
        c("#snake", PHONE, 400, true),
        Case { draw: 4, ..c("#snake", DESK, 900, true) },
        c("#snake-nimbus", DESK, 300, true),
        c("#snake", DESK, 1770, true),
        c("#snake", DESK, 1810, true),
        c("#snake", DESK, 1868, true),
        c("#snake", DESK, 1900, true),
        c("#snake", PHONE, 1850, true),
        c("#form1", DESK, 120, true),
        c("#form3", DESK, 120, true),
        c("#form7", DESK, 120, true),
        c("#mui", DESK, 120, true),
        c("#hero-goku#form5", DESK, 120, true),
        c("#hero-gohan#form2", PHONE, 120, true),
        c("#hero-trunks#form4", DESK, 120, true),
        c("#kaio", DESK, 120, true),
        c("#visitors", DESK, 60, true),
        c("#visitors", PHONE, 60, true),
        c("#gregory", DESK, 60, true),
        c("#car", DESK, 60, true),
        c("#pod", DESK, 60, true),
        c("#storm", DESK, 300, true),
        c("#raid", DESK, 300, true),
        c("#raid", PHONE, 300, true),
        c("#saga4", DESK, 300, true),
        c("#saga7", DESK, 300, true),
        c("#ginyu", DESK, 300, true),
        c("#androids", DESK, 300, true),
        c("#frieza", DESK, 300, true),
        c("#roshi", DESK, 90, true),
        c("#ape", DESK, 90, true),
        c("#ozaru", DESK, 300, true),
        c("#door", DESK, 60, true),
        c("#fusion", DESK, 90, true),
        c("#yamcha", DESK, 60, true),
        c("#date", DESK, 60, true),
        c("#gero", DESK, 60, true),
        c("#sixteen", DESK, 60, true),
        c("#krillin", DESK, 60, true),
        c("#dance", DESK, 60, true),
        c("#dance", DESK, 160, true),
        c("#cling", DESK, 60, true),
        c("#tournament", DESK, 300, true),
        c("#beerus", DESK, 300, true),
        c("#zeno", DESK, 60, true),
        c("#cooler", DESK, 120, true),
        c("#cooler", DESK, 600, true),
        c("#janemba", DESK, 300, true),
        c("#bojack", DESK, 300, true),
        c("#shenron", DESK, 60, true),
        c("#shenron", DESK, 200, true),
        c("#shenron0", DESK, 200, true),
        c("#shenron2", DESK, 200, true),
        c("#shenron3", PHONE, 200, true),
        c("#spirit", DESK, 60, true),
        c("#struggle", DESK, 900, true),
        c("#struggle", DESK, 250, true),
        c("#universe9", DESK, 300, true),
        c("#itx", DESK, 60, true),
        c("#universe11", DESK, 300, true),
        c("#universe11", PHONE, 300, true),
    ];
    for (shape, must) in [('c', true), ('a', true), ('b', true), ('d', true), ('e', true)] {
        v.push(Case { widget: Some(Some((shape, 2))), ..c("", (800, 600), 200, must) });
    }
    v.push(Case { widget: Some(Some(('c', 5))), ..c("", (800, 600), 200, true) });
    v.push(Case { widget: Some(Some(('c', 1))), ..c("", (500, 400), 200, true) });
    v.push(Case { widget: Some(None), ..c("", (800, 600), 200, true) });
    v.push(Case { widget: Some(None), ..c("#namek", (800, 600), 400, true) });
    v.push(Case { widget: Some(Some(('c', 3))), ..c("#top", (800, 600), 60, true) });
    v.push(Case { widget: Some(Some(('a', 2))), ..c("#raid", (800, 600), 300, true) });
    v.push(Case { widget: Some(Some(('e', 2))), ..c("#westcity", (1040, 600), 400, true) });
    v.push(Case { widget: Some(Some(('c', 2))), ..c("#snake", (800, 600), 400, true) });
    v.push(Case { widget: Some(None), ..c("#snake", (500, 400), 400, true) });
    v
}

fn name(k: &Case) -> String {
    let w = match k.widget {
        None => String::new(),
        Some(None) => " widget".into(),
        Some(Some((s, a))) => format!(" widget clouds {s}{a}"),
    };
    format!("{} {}x{} f{} d{}{}", if k.hook.is_empty() { "(home)" } else { k.hook }, k.w, k.h, k.frames, k.draw, w)
}

fn js(k: &Case, out: &Path) -> Option<(Value, Vec<u8>)> {
    let dir = Path::new(env!("CARGO_MANIFEST_DIR")).join("../difftest");
    let mut cmd = Command::new("node");
    cmd.arg(dir.join("frame.js")).arg(out);
    cmd.args(["--hook", k.hook, "--w", &k.w.to_string(), "--h", &k.h.to_string(), "--frames", &k.frames.to_string(), "--draw", &k.draw.to_string()]);
    if let Some(cl) = k.widget {
        cmd.arg("--widget");
        if let Some((s, a)) = cl {
            cmd.args(["--clouds", &s.to_string(), "--amt", &a.to_string()]);
        }
    }
    let o = cmd.output().ok()?;
    assert!(o.status.success(), "frame.js: {}", String::from_utf8_lossy(&o.stderr));
    let meta: Value = serde_json::from_slice(&o.stdout).unwrap();
    Some((meta, std::fs::read(out.with_extension("rgba")).unwrap()))
}

fn rust(k: &Case, w: usize, h: usize) -> (Game, Vec<u8>) {
    let widget = k.widget.is_some();
    let scale = if widget {
        if k.w >= 520 { 2.0 } else { 1.0 }
    } else if k.w < 560 {
        2.0
    } else {
        3.0
    };
    let mut g = Game::new(1);
    g.set_view(w as f64, h as f64, widget);
    g.preview(k.hook);
    g.start();
    let view = View { scale, bare: widget, clouds: k.widget.flatten().map(|c| c.0), cloud_amt: k.widget.flatten().map_or(2.0, |c| c.1 as f64) };
    let mut fb = Framebuffer::new(w, h);
    let mut sc = Scene::new();
    let dt = 1.0 / 30.0;
    let mut t = 0.0;
    for f in 0..k.frames {
        if f == k.frames - k.draw {
            // as frame.js does: headless game.js never steps its particles, so both start the drawn frames without them
            g.fx.clear();
            g.floats.clear();
            g.flash_t = 0.0;
        }
        t += dt;
        g.sim(t, dt);
        if f >= k.frames - k.draw {
            sc.draw(&mut fb, &mut g, &view, dt);
        }
        g.timeouts();
    }
    if widget {
        planet_render::px::rim(&mut fb);
    }
    let bytes = fb.rgba().to_vec();
    (g, bytes)
}

fn png(path: &Path, w: usize, h: usize, rgba: &[u8]) {
    // a minimal PNG (RGB over grey), for looking at a failing case
    let mut raw = Vec::with_capacity((w * 3 + 1) * h);
    for y in 0..h {
        raw.push(0);
        for x in 0..w {
            let k = (y * w + x) * 4;
            let a = rgba[k + 3] as f64 / 255.0;
            for c in 0..3 {
                raw.push((rgba[k + c] as f64 * a + 70.0 * (1.0 - a)).round() as u8);
            }
        }
    }
    let crc = |b: &[u8]| {
        let mut c: u32 = !0;
        for &x in b {
            c ^= x as u32;
            for _ in 0..8 {
                c = if c & 1 != 0 { 0xedb88320 ^ (c >> 1) } else { c >> 1 };
            }
        }
        !c
    };
    // stored (uncompressed) deflate blocks
    let mut z = vec![0x78, 0x01];
    for (i, ch) in raw.chunks(65535).enumerate() {
        let last = (i + 1) * 65535 >= raw.len();
        z.push(last as u8);
        z.extend_from_slice(&(ch.len() as u16).to_le_bytes());
        z.extend_from_slice(&(!(ch.len() as u16)).to_le_bytes());
        z.extend_from_slice(ch);
    }
    let (mut a, mut b) = (1u32, 0u32);
    for &x in &raw {
        a = (a + x as u32) % 65521;
        b = (b + a) % 65521;
    }
    z.extend_from_slice(&((b << 16) | a).to_be_bytes());
    let mut out = vec![137, 80, 78, 71, 13, 10, 26, 10];
    for (ty, data) in [(&b"IHDR"[..], [(w as u32).to_be_bytes(), (h as u32).to_be_bytes(), [8, 2, 0, 0], [0, 0, 0, 0]].concat()[..13].to_vec()), (&b"IDAT"[..], z), (&b"IEND"[..], vec![])] {
        out.extend_from_slice(&(data.len() as u32).to_be_bytes());
        let mut td = ty.to_vec();
        td.extend_from_slice(&data);
        out.extend_from_slice(&td);
        out.extend_from_slice(&crc(&td).to_be_bytes());
    }
    std::fs::write(path, out).unwrap();
}

#[test]
fn framebuffers_match_game_js() {
    let filter = std::env::var("FRAMEDIFF").unwrap_or_default();
    let tmp = PathBuf::from(env!("CARGO_TARGET_TMPDIR")).join("framediff");
    std::fs::create_dir_all(&tmp).unwrap();
    let mut failed_must = Vec::new();
    let mut rows = Vec::new();
    for (i, k) in cases().into_iter().enumerate() {
        let nm = name(&k);
        if !filter.is_empty() && !nm.contains(&filter) {
            continue;
        }
        let out = tmp.join(format!("case{i}"));
        let Some((meta, want)) = js(&k, &out) else {
            eprintln!("node not found: skipping the framebuffer diff");
            return;
        };
        let (w, h) = (meta["W"].as_u64().unwrap() as usize, meta["H"].as_u64().unwrap() as usize);
        let (g, got) = rust(&k, w, h);
        let state_ok = g.rng.draws() as u64 == meta["draws"].as_u64().unwrap() && g.s.world as u64 == meta["world"].as_u64().unwrap();
        let px = want.chunks(4).zip(got.chunks(4)).filter(|(a, b)| a != b).count();
        let res = if px == 0 && state_ok {
            "identical".to_string()
        } else {
            format!("{px} px differ{}", if state_ok { String::new() } else { format!(" (rng draws js {} rust {})", meta["draws"], g.rng.draws()) })
        };
        if (px != 0 || !state_ok) && std::env::var("FRAMEDIFF_PNG").is_ok() {
            png(&out.with_extension("js.png"), w, h, &want);
            png(&out.with_extension("rust.png"), w, h, &got);
            let diff: Vec<u8> = want.chunks(4).zip(got.chunks(4)).flat_map(|(a, b)| if a == b { [a[0] / 4, a[1] / 4, a[2] / 4, 255] } else { [255, 0, 255, 255] }).collect();
            png(&out.with_extension("diff.png"), w, h, &diff);
        }
        rows.push(format!("{:>4} {:<44} {}x{} {}", if k.must { "must" } else { "" }, nm, w, h, res));
        if k.must && (px != 0 || !state_ok) {
            failed_must.push(nm);
        }
    }
    eprintln!("\nframebuffer diff, game.js vs planet-render:\n{}\n", rows.join("\n"));
    assert!(failed_must.is_empty(), "cases expected to match differ: {failed_must:?}");
}
