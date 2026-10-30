//! The beam drawn: it crosses the planet's face, through what it hits. And around the first groups of enemies, drawn
//! (targets only have screen spots once drawn), a player who beams every group earns no more than one who taps it.

use planet_core::data::{Upg, SHOP};
use planet_core::input::Beam;
use planet_core::{Game, DT};
use planet_render::scene::{Scene, View};
use planet_render::Framebuffer;

#[test]
fn the_beam_crosses_the_planets_face_and_its_ball_stays_at_his_depth() {
    let mut g = Game::new(7);
    g.start();
    let (mut fb, mut sc, view) = (Framebuffer::new(200, 134), Scene::new(), View::site(3.0));
    g.frame(DT, DT);
    sc.draw(&mut fb, &mut g, &view, DT);
    let (cx, cy) = (g.cam.cx, g.cam.cy);
    // fired from just inside the planet's disc at depth 0 (its limb), through its centre
    let (x, y) = (cx - g.cam.r * 0.8, cy);
    g.inp.beam = Some(Beam { t0: g.t - 0.2, c: 2.5, x, y, dx: 1.0, dy: 0.0, z: 0.0, ff: false, full: false, kaio: false, ape: false });
    sc.draw(&mut fb, &mut g, &view, DT);
    let at = |x: f64, y: f64| fb.buf[(y.round() as usize) * 200 + x.round() as usize];
    let white = planet_render::pk(0xffffff, 255);
    assert_eq!(at(cx, cy), white, "the beam's white core over the planet's centre");
    assert_ne!(at(x, y), white, "the ball in his hands hides behind the nearer planet");
}

const POLICY: [&str; 13] = ["boots", "partner", "gravity", "scouter", "house", "piccolo", "cloud", "armor", "kaio", "galick", "senzu", "chamber", "bigbang"];

/// xform.rs's `buy_all`: the cheapest open upgrade until none is affordable. Returns what it spent.
fn buy_all(g: &mut Game) -> f64 {
    let mut spent = 0.0;
    loop {
        let ok = POLICY
            .iter()
            .filter_map(|k| Upg::from_key(k))
            .filter(|&u| g.unlocked(u) && g.s.pl >= g.cost(u))
            .min_by(|&a, &b| g.cost(a).partial_cmp(&g.cost(b)).unwrap());
        let Some(u) = ok else { return spent };
        let c = g.cost(u);
        if !g.buy(SHOP[u as usize].key) {
            return spent;
        }
        spent += c.to_f64();
    }
}

/// Every hostile with a screen spot, where the beam aims at it.
fn targets(g: &Game) -> Vec<(f64, f64)> {
    let mut v: Vec<(f64, f64)> = g.tl.saibas.iter().filter(|s| !s.dead).filter_map(|s| s.sx.map(|(x, y)| (x, y - 6.0))).collect();
    if let Some(gi) = g.tl.ginyu.as_ref().filter(|gi| gi.done == 0.0) {
        v.extend(gi.members.iter().filter(|m| !m.dead && m.x != 0.0).map(|m| (m.x, m.y - m.spr.h / 2.0 * m.k)));
    }
    if let Some(m) = g.tl.movie.as_ref().filter(|m| m.over == 0.0) {
        v.extend(m.minions.iter().filter(|h| !h.dead).filter_map(|h| h.x.map(|x| (x, h.y - h.spr.h / 2.0 * h.k))));
    }
    if let Some(b) = g.tl.boss.as_ref().filter(|b| !b.dead && b.x != 0.0) {
        v.push((b.x, b.y - b.spr().h / 2.0 * b.k));
    }
    v.extend(g.tl.meteors.iter().filter(|m| !m.dead && m.delay <= 0.0).map(|m| (m.x, m.y)));
    v
}

/// The target whose line from his hands passes nearest the most others.
fn best_aim(g: &Game) -> Option<(f64, f64)> {
    let (hx, hy) = g.hand_pos();
    let ts = targets(g);
    ts.iter().copied().max_by_key(|&(x, y)| {
        let l = (x - hx).hypot(y - hy).max(1.0);
        let (dx, dy) = ((x - hx) / l, (y - hy) / l);
        ts.iter().filter(|&&(u, v)| (u - hx) * dx + (v - hy) * dy > 0.0 && ((u - hx) * dy - (v - hy) * dx).abs() < 14.0).count()
    })
}

#[derive(Clone, Copy, PartialEq)]
enum Play {
    /// the shared lead-in: a casual active player, a tap every half second, no beams
    Casual,
    /// never taps; checks in once a second to buy
    Idle,
    /// xform.rs's active player: taps 5 a second for 5s of every 10, buys, kaioken when ready
    Active,
    /// the active player, who also taps whatever enemy is on screen, 5 a second, as long as one is
    Fights,
    /// the active player, who instead holds a full beam on every group the moment one is on screen
    Beams,
}

/// The same game for `lead` seconds of casual play (saibamen, meteors and the first bosses are about by then), then
/// `play` for `secs`: the power earned (held plus spent) in that window, drawn every frame, and the beams fired.
fn run(seed: u32, play: Play, lead: f64, secs: f64) -> (f64, u32) {
    let mut g = Game::new(seed);
    g.start();
    let (mut fb, mut sc, view) = (Framebuffer::new(200, 134), Scene::new(), View::site(3.0));
    let (mut spent, mut beams) = (0.0, 0);
    let mut aim: Option<(f64, f64)> = None;
    let (n0, mut e0) = ((lead / DT) as u32, 0.0);
    for f in 0..((lead + secs) / DT) as u32 {
        if f == n0 {
            e0 = g.s.pl.to_f64() + spent;
        }
        let play = if f < n0 { Play::Casual } else { play };
        if play == Play::Casual {
            if f % 15 == 0 {
                g.train();
            }
        } else if play != Play::Idle {
            if play == Play::Beams && g.s.lv(Upg::Galick) > 0 && g.s.world != 3 {
                match aim {
                    None => {
                        if let Some((x, y)) = best_aim(&g) {
                            g.pointer_down(x * 3.0, y * 3.0, x, y, 1, 0, false);
                            aim = Some((x, y));
                        }
                    }
                    Some(_) if g.inp.charging >= 2.5 => {
                        // re-aim at the best line now, as a player follows the crowd
                        let (x, y) = best_aim(&g).or(aim).unwrap();
                        g.pointer_move(x * 3.0, y * 3.0, x, y, 1);
                        g.pointer_up(x, y, 1);
                        aim = None;
                        beams += 1;
                    }
                    Some(_) if g.inp.drag.is_none() => aim = None,
                    _ => {}
                }
            }
            let foe = if play == Play::Fights && f % 6 == 0 { best_aim(&g) } else { None };
            if let Some((x, y)) = foe {
                g.pointer_down(x * 3.0, y * 3.0, x, y, 1, 0, false);
                g.pointer_up(x, y, 1);
            } else if aim.is_none() && f % 300 < 150 && f % 6 == 0 {
                g.train();
            }
        }
        if f % 30 == 0 {
            spent += buy_all(&mut g);
            if play != Play::Idle {
                g.kaioken();
            }
        }
        g.frame((f + 1) as f64 * DT, DT);
        sc.draw(&mut fb, &mut g, &view, DT);
    }
    (g.s.pl.to_f64() + spent - e0, beams)
}

fn geo_mean(v: impl Iterator<Item = f64>) -> f64 {
    let v: Vec<f64> = v.collect();
    (v.iter().map(|x| x.ln()).sum::<f64>() / v.len() as f64).exp()
}

/// Slow (every frame drawn): `cargo test -p planet-render --release --test beam -- --ignored --nocapture`.
#[test]
#[ignore]
fn beam_play_keeps_the_afk_rule() {
    let seeds: Vec<u32> = (1..=12).collect();
    let (lead, secs) = (240.0, 180.0);
    let w = |p| seeds.iter().map(|&s| run(s, p, lead, secs)).collect::<Vec<_>>();
    let (idle, act, fight, beam) = (w(Play::Idle), w(Play::Active), w(Play::Fights), w(Play::Beams));
    let r = |a: &[(f64, u32)], b: &[(f64, u32)]| geo_mean(a.iter().zip(b).map(|(x, y)| x.0 / y.0));
    let (afk, fight_afk, beam_afk, beam_fight) = (r(&act, &idle), r(&fight, &idle), r(&beam, &idle), r(&beam, &fight));
    let fired: u32 = beam.iter().map(|b| b.1).sum();
    println!("{} seeds, the {secs}s after {lead}s of casual play ({fired} beams):", seeds.len());
    println!("  active / idle ×{afk:.3}, fighting with taps / idle ×{fight_afk:.3}, with beams / idle ×{beam_afk:.3}; beams / taps ×{beam_fight:.3}");
    assert!((2.0..=3.5).contains(&afk), "active play earns about 2-3× idle: ×{afk}");
    // fighting pays (bounties, the ginyu force's prize) whatever it's done with; the beam mustn't out-earn the taps
    assert!(beam_fight <= 1.0, "beaming every group earns no more than tapping it down: ×{beam_fight}");
}
