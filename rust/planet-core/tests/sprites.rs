//! The sprite data against game.js: `make_hero` against the hero sets game.js builds (dumped by difftest/sprites.js),
//! and the `shapeSprite` DSL against baked sprites, repainted here from their game.js paint programs.

use planet_core::sprite::{self, get, shape_sprite, Pal, Sprite};
use std::path::Path;
use std::process::Command;

#[test]
fn heroes_match_game_js() {
    let dir = Path::new(env!("CARGO_MANIFEST_DIR")).join("../difftest");
    let file = Path::new(env!("CARGO_TARGET_TMPDIR")).join("heroes.bin");
    match Command::new("node").arg(dir.join("sprites.js")).arg("--heroes").arg(&file).output() {
        Ok(o) => assert!(o.status.success(), "{}", String::from_utf8_lossy(&o.stderr)),
        Err(_) => return eprintln!("node not found: skipping"),
    }
    let js = sprite::parse(&std::fs::read(&file).unwrap());
    let mut n = 0;
    for (id, h) in sprite::heroes() {
        let set = |pre: String, s: &sprite::HeroSet| {
            let mut v = vec![(format!("{pre}.pose"), s.pose.clone()), (format!("{pre}.idle"), s.idle.clone())];
            v.extend(s.run.iter().enumerate().map(|(k, r)| (format!("{pre}.run.{k}"), r.clone())));
            v
        };
        let mut all: Vec<(String, Sprite)> = Vec::new();
        for (i, f) in h.forms.iter().enumerate() {
            all.extend(set(format!("HEROES.{id}.forms.{i}"), f));
        }
        all.extend(set(format!("HEROES.{id}.fused"), &h.fused));
        for (i, b) in h.backs.iter().enumerate() {
            for (k, s) in b.iter().enumerate() {
                all.push((format!("HEROES.{id}.backs.{i}.{k}"), s.clone()));
            }
        }
        for (name, s) in all {
            let j = js.get(&name).unwrap_or_else(|| panic!("game.js has no {name}"));
            assert_eq!(&s, j, "{name}");
            n += 1;
        }
    }
    // 4 heroes × (14 forms + fused) × 6, and 14 × 2 from behind; HEROES.<id>.idle is an alias of forms.0.idle
    assert_eq!(n, 4 * (15 * 6 + 14 * 2), "every game.js hero sprite is built");
}

#[test]
fn shape_sprite_dsl_matches_the_bake() {
    let check = |name: &str, s: Sprite| assert_eq!(&s, get(name), "{name}");
    check(
        "GREGORY",
        shape_sprite(
            12,
            9,
            |g| {
                g.ell(5.0, 5.0, 3.8, 2.2, 'g');
                g.ell(8.6, 3.8, 2.0, 2.0, 'g');
                g.poly(&[[2.0, 3.6], [6.5, 3.4], [6.0, 5.0], [2.0, 5.2]], 'G');
                g.set(9, 3, 'w');
                g.set(10, 3, 'k');
                g.line(&[[3.0, 6.5], [1.0, 9.0]], 1.0, 1.0, 'l');
                g.line(&[[6.5, 6.5], [7.5, 9.0]], 1.0, 1.0, 'l');
                g.line(&[[9.5, 2.0], [11.0, 0.0]], 1.0, 1.0, 'k');
            },
            &Pal::new(&[('o', 0x2a1a0a), ('g', 0xa8743a), ('G', 0x7a4e22), ('w', 0xffffff), ('k', 0x111111), ('l', 0x5a3a1a)]),
            &[('g', 'G')],
        ),
    );
    check(
        "DOOR",
        shape_sprite(
            12,
            16,
            |g| {
                g.rect(1, 1, 10, 15, 'w');
                g.rect(3, 3, 6, 13, 'k');
                g.set(8, 9, 'y');
            },
            &Pal::new(&[('o', 0x1a1a24), ('w', 0xf6f4ee), ('W', 0xc8c4b8), ('k', 0x2a2a3a), ('y', 0xf2c84a)]),
            &[('w', 'W')],
        ),
    );
    check(
        "SENZU",
        shape_sprite(
            12,
            8,
            |g| {
                g.ell(6.0, 4.3, 5.2, 3.0, 'g');
                for (x, y) in [(5, 1), (6, 1), (7, 1), (6, 2)] {
                    g.set(x, y, '.');
                }
                g.ell(3.6, 3.8, 1.5, 0.9, 'l');
                g.set(8, 5, 'l');
            },
            &Pal::new(&[('o', 0xffffff), ('g', 0x8ee04a), ('G', 0x3f9a26), ('l', 0xeaffd0)]),
            &[('g', 'G')],
        ),
    );
    check(
        "POD",
        shape_sprite(
            14,
            14,
            |g| {
                g.ell(7.0, 7.0, 5.9, 5.9, 'w');
                g.line(&[[4.3, 2.8], [3.9, 7.0], [4.7, 11.3]], 1.0, 1.0, 'W');
                g.ell(9.0, 5.5, 2.8, 2.6, 'k');
                g.ell(9.0, 5.5, 2.1, 1.9, 'm');
                g.set(8, 4, 'M');
                g.set(8, 5, 'M');
            },
            &Pal::new(&[('o', 0x22222e), ('w', 0xf4f4f8), ('W', 0xbcc0cc), ('k', 0x3a3a48), ('m', 0x6a2a8a), ('M', 0xc08ae0)]),
            &[('w', 'W')],
        ),
    );
    check(
        "FRIEZA",
        shape_sprite(
            26,
            34,
            |g| {
                g.line(&[[15.0, 25.0], [20.0, 28.0], [23.0, 24.0], [22.0, 19.0]], 2.8, 1.5, 'w');
                g.ell(22.0, 19.0, 1.6, 1.6, 'p');
                g.ell(13.0, 10.0, 4.4, 4.4, 'w');
                g.poly(&[[8.0, 9.5], [8.4, 5.0], [10.8, 2.2], [15.2, 2.2], [17.6, 5.0], [18.0, 9.5], [16.4, 7.6], [9.6, 7.6]], 'p');
                g.set(11, 3, 'q');
                g.set(10, 4, 'q');
                g.set(12, 3, 'q');
                g.set(10, 10, 'r');
                g.set(11, 10, 'k');
                g.set(15, 10, 'r');
                g.set(14, 10, 'k');
                g.rect(12, 12, 3, 1, 'P');
                g.rect(11, 14, 5, 2, 'w');
                g.ell(8.0, 17.0, 3.0, 2.3, 'p');
                g.ell(18.0, 17.0, 3.0, 2.3, 'p');
                g.poly(&[[9.0, 16.0], [17.0, 16.0], [16.0, 25.0], [10.0, 25.0]], 'w');
                g.ell(13.0, 19.5, 2.4, 1.8, 'p');
                g.line(&[[8.0, 18.0], [6.0, 23.0], [7.0, 27.0]], 2.6, 2.2, 'w');
                g.line(&[[18.0, 18.0], [20.0, 23.0], [19.0, 27.0]], 2.6, 2.2, 'w');
                g.ell(6.4, 23.0, 1.3, 1.3, 'p');
                g.ell(19.6, 23.0, 1.3, 1.3, 'p');
                g.line(&[[11.0, 25.0], [10.0, 32.0]], 3.0, 2.6, 'w');
                g.line(&[[15.0, 25.0], [16.0, 32.0]], 3.0, 2.6, 'w');
                g.ell(10.0, 29.0, 1.3, 1.2, 'p');
                g.ell(16.0, 29.0, 1.3, 1.2, 'p');
            },
            &Pal::new(&[
                ('o', 0x1d1030),
                ('w', 0xf6f4fa),
                ('W', 0xb8b0cc),
                ('p', 0xa25ae8),
                ('P', 0x5a1f8a),
                ('q', 0xe6d0ff),
                ('r', 0xe0302a),
                ('k', 0x2a1840),
            ]),
            &[('w', 'W'), ('p', 'P')],
        ),
    );
    check(
        "PUDDING",
        shape_sprite(
            12,
            10,
            |g| {
                g.ell(6.0, 8.6, 5.6, 1.4, 'w');
                g.poly(&[[2.5, 8.0], [9.5, 8.0], [8.5, 3.0], [3.5, 3.0]], 'y');
                g.ell(6.0, 3.0, 2.6, 1.2, 'c');
                g.set(4, 5, 'l');
            },
            &Pal::new(&[('o', 0x3a2410), ('w', 0xf6f4ee), ('W', 0xc8c4b8), ('y', 0xf8d468), ('Y', 0xd8a83a), ('c', 0x8a4a1a), ('l', 0xfff4c0)]),
            &[('y', 'Y'), ('w', 'W')],
        ),
    );
}
