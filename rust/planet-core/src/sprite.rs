//! Sprites as plain data: game.js's `makeSprite`, the `shapeSprite` DSL (shenron.js's `kit.grid`), `makeHero`, and
//! every other sprite game.js paints at load, baked by `difftest/sprites.js` into `data/sprites.bin`.

use std::collections::HashMap;
use std::sync::OnceLock;

use crate::jsmath::hypot;
use crate::num::js_round;

/// `makeSprite` output: a colour per pixel (-1 transparent), which pixels emit light, and the anchor.
#[derive(Clone, Debug, PartialEq)]
pub struct Sprite {
    pub w: usize,
    pub h: usize,
    pub col: Vec<i32>,
    pub emit: Vec<bool>,
    pub ax: f64,
    pub ay: f64,
}

/// A palette: colour by character.
#[derive(Clone)]
pub struct Pal([i64; 128]);

impl Pal {
    pub fn new(entries: &[(char, u32)]) -> Self {
        let mut p = Pal([-1; 128]);
        p.set(entries);
        p
    }
    /// `Object.assign({}, this, entries)`
    pub fn with(&self, entries: &[(char, u32)]) -> Self {
        let mut p = self.clone();
        p.set(entries);
        p
    }
    fn set(&mut self, entries: &[(char, u32)]) {
        for &(c, v) in entries {
            self.0[c as usize] = v as i64;
        }
    }
    pub fn get(&self, c: u8) -> Option<u32> {
        let v = self.0[(c & 127) as usize];
        (v >= 0).then_some(v as u32)
    }
}

/// `makeSprite(rows, pal, { emit, ax, ay })`
pub fn make_sprite<S: AsRef<[u8]>>(rows: &[S], pal: &Pal, emit: &str, ax: Option<f64>, ay: Option<f64>) -> Sprite {
    let h = rows.len();
    let w = rows.iter().map(|r| r.as_ref().len()).max().unwrap_or(0);
    let mut col = vec![-1; w * h];
    let mut em = vec![false; w * h];
    for (j, row) in rows.iter().enumerate() {
        for (i, &ch) in row.as_ref().iter().enumerate() {
            if ch == b'.' {
                continue;
            }
            let Some(c) = pal.get(ch) else { continue };
            col[j * w + i] = c as i32;
            if emit.as_bytes().contains(&ch) {
                em[j * w + i] = true;
            }
        }
    }
    Sprite { w, h, col, emit: em, ax: ax.unwrap_or((w / 2) as f64), ay: ay.unwrap_or(h as f64 - 1.0) }
}

/// shenron.js `kit.grid`: a character grid painted with shapes sampled at pixel centres.
pub struct Grid {
    pub w: usize,
    pub h: usize,
    pub g: Vec<u8>,
}

impl Grid {
    pub fn new(w: usize, h: usize) -> Self {
        Grid { w, h, g: vec![b'.'; w * h] }
    }
    fn each(&mut self, c: u8, test: impl Fn(f64, f64) -> bool) {
        for y in 0..self.h {
            for x in 0..self.w {
                if test(x as f64 + 0.5, y as f64 + 0.5) {
                    self.g[y * self.w + x] = c;
                }
            }
        }
    }
    pub fn set(&mut self, x: i64, y: i64, c: char) {
        if x >= 0 && y >= 0 && (x as usize) < self.w && (y as usize) < self.h {
            self.g[y as usize * self.w + x as usize] = c as u8;
        }
    }
    pub fn rect(&mut self, x: i64, y: i64, rw: i64, rh: i64, c: char) {
        for j in y..y + rh {
            for i in x..x + rw {
                self.set(i, j, c);
            }
        }
    }
    pub fn ell(&mut self, cx: f64, cy: f64, rx: f64, ry: f64, c: char) {
        self.each(c as u8, |x, y| {
            let a = (x - cx) / rx;
            let b = (y - cy) / ry;
            a * a + b * b <= 1.0
        });
    }
    pub fn poly(&mut self, p: &[[f64; 2]], c: char) {
        self.each(c as u8, |x, y| {
            let mut s = false;
            let mut j = p.len() - 1;
            for i in 0..p.len() {
                let ([xi, yi], [xj, yj]) = (p[i], p[j]);
                if (yi > y) != (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi {
                    s = !s;
                }
                j = i;
            }
            s
        });
    }
    /// A tapering stroke along a polyline.
    pub fn line(&mut self, p: &[[f64; 2]], w0: f64, w1: f64, c: char) {
        let mut l_tot = 0.0;
        let mut seg = Vec::with_capacity(p.len());
        for i in 1..p.len() {
            let l = hypot(&[p[i][0] - p[i - 1][0], p[i][1] - p[i - 1][1]]);
            seg.push(l);
            l_tot += l;
        }
        let mut acc = 0.0;
        for i in 1..p.len() {
            let sl = seg[i - 1];
            let mut s = 0.0;
            while s <= sl {
                let f = s / sl;
                let x = p[i - 1][0] + (p[i][0] - p[i - 1][0]) * f;
                let y = p[i - 1][1] + (p[i][1] - p[i - 1][1]) * f;
                let r = (w0 + (w1 - w0) * (acc + s) / l_tot) / 2.0;
                let mut yy = (y - r).floor();
                while yy <= y + r {
                    let mut xx = (x - r).floor();
                    while xx <= x + r {
                        let (a, b) = (xx + 0.5 - x, yy + 0.5 - y);
                        if a * a + b * b <= r * r {
                            self.set(xx as i64, yy as i64, c);
                        }
                        xx += 1.0;
                    }
                    yy += 1.0;
                }
                if s + 0.2 > sl {
                    acc += sl;
                }
                s += 0.2;
            }
        }
    }
    pub fn mirror(&mut self) {
        for y in 0..self.h {
            let mut x = 0;
            while (x as f64) < self.w as f64 / 2.0 {
                self.g[y * self.w + self.w - 1 - x] = self.g[y * self.w + x];
                x += 1;
            }
        }
    }
    fn at(&self, x: i64, y: i64) -> u8 {
        if x < 0 || y < 0 || x as usize >= self.w || y as usize >= self.h {
            b'.'
        } else {
            self.g[y as usize * self.w + x as usize]
        }
    }
}

/// `shapeSprite(w, h, paint, pal, shadeOf)`: shade the lower-right edge of each shaded tone, outline the whole shape.
pub fn shape_sprite(w: usize, h: usize, paint: impl FnOnce(&mut Grid), pal: &Pal, shade_of: &[(char, char)]) -> Sprite {
    let mut gr = Grid::new(w, h);
    paint(&mut gr);
    let mut out = gr.g.clone();
    let shade = |c: u8| shade_of.iter().find(|s| s.0 as u8 == c).map(|s| s.1 as u8);
    for y in 0..h as i64 {
        for x in 0..w as i64 {
            let c = gr.at(x, y);
            if let Some(s) = shade(c) {
                if gr.at(x + 1, y) == b'.' || gr.at(x, y + 1) == b'.' || gr.at(x + 1, y + 1) == b'.' {
                    out[y as usize * w + x as usize] = s;
                }
            }
        }
    }
    for y in 0..h as i64 {
        for x in 0..w as i64 {
            if gr.at(x, y) == b'.' && [(1, 0), (-1, 0), (0, 1), (0, -1)].iter().any(|&(a, b)| gr.at(x + a, y + b) != b'.') {
                out[y as usize * w + x as usize] = b'o';
            }
        }
    }
    let rows: Vec<&[u8]> = out.chunks(w).collect();
    make_sprite(&rows, pal, "r", None, None)
}

/// One sprite set of a hero: `{ pose, idle, run: [4] }`.
#[derive(Clone, Debug)]
pub struct HeroSet {
    pub pose: Sprite,
    pub idle: Sprite,
    pub run: [Sprite; 4],
}

/// `makeHero` output.
#[derive(Clone, Debug)]
pub struct Hero {
    pub forms: Vec<HeroSet>,
    pub fused: HeroSet,
    pub backs: Vec<[Sprite; 2]>,
}

pub const LATE_HAIR: [(u32, u32); 5] = [(0xa8b0c4, 0xf4f6fa), (0x1f58c8, 0x6aa8f0), (0xf2f0f8, 0xc8a8f8), (0x4a1a8a, 0x9a6ae0), (0xf2dc6a, 0xd8f2ff)];

const IDLE: [&str; 15] = [
    "...oyyobbbbyyo..", "..oyyyoaaaaoyyo.", "..oYYoaaaaaAoYo.", "..obboaaaaaAobo.", "..obboaaaaaAobo.", "..oggoaaaaaAogo.", "..oGgoBaaaAAoGo.",
    "...oo.oBbbbBo.o.", "......obbbbBo...", ".....obbo.obBo..", ".....obbo.obBo..", ".....obbo.obBo..", ".....owwo.owWo..", "....owwwo.owwWo.",
    "....ooooo.ooooo.",
];
const RUN_A: [&str; 15] = [
    "...oyyobbbbyyo..", "..oyyyoaaaaoyyo.", ".oYYoaaaaaaAoYYo", "oggoaaaaaaaAobbo", "oGgoaaaaaaaAobbo", ".oo.aaaaaaaAoggo", "....oBaaaaAAoGo.",
    "....oBbbbbBo.oo.", "....obbbbbbBo...", "...obbbo..obBBo.", "..obbo.....obBo.", ".obbo.......obBo", "owwo........owWo", "owwwo.......owwo",
    "ooooo........ooo",
];
const RUN_B: [&str; 15] = [
    "...oyyobbbbyyo..", "..oyyyoaaaaoyyo.", "..oYYoaaaaaAoYo.", "...ooaaaaaaAobo.", "...oaaaaaaaAobo.", "...ogoaaaaaAogo.", "...oGoBaaaAAoGo.",
    "....o.oBbbbBo...", "......obbbbBo...", "......obbbBo....", "......obbBo.....", "......obbBoo....", "......obbBowwo..", ".....owwwowwo...",
    ".....oooooooo...",
];
const RUN_C: [&str; 15] = [
    "...oyyobbbbyyo..", "..oyyyoaaaaoyyo.", ".oYYoaaaaaaAoYYo", "oggoaaaaaaaAobbo", "oGgoaaaaaaaAobbo", ".oo.aaaaaaaAoggo", "....oBaaaaAAoGo.",
    ".oo.oBbbbbBo....", "...oBbbbbbbo....", ".oBBbo..obbbo...", ".oBbo.....obbo..", "oBbo.......obbo.", "oWwo........owwo", "owwo.......owwwo",
    "ooo........ooooo",
];
const POSE_TOP: [&str; 7] =
    ["...oyyobbbbyyo..", "..oyyyoaaaaoyyo.", "..oYYoaaaaaAoYo.", "..obbbbbbbbggoo.", "..oggbbbbbbbbbo.", "...oooaaaaaAoo..", ".....oBaaaAAo..."];
const BACK_HEAD: [&str; 12] = [
    "......o...o.....", ".....oho.oho....", "....ohHo.oHho...", "...ohhHhohHhho..", "...ohhhhhhhhho..", "..ohhhhhhhhhhho.", "..ohhHhhhhHhhho.",
    "...ohhhhhhhhho..", "...ohhhhhhhhho..", "....ohhhhhhho...", "....oShhhhhSo...", ".....oSSSSSo....",
];

pub const VEGETA_HEAD: [&str; 16] = [
    "......o...o.....", ".....oho.oho....", "....ohHo.oHho...", "....ohHhohHhho..", "...ohhHhhhhhho..", "...ohhhhhhhhho..", "...ohhhhhhhhhho.",
    "....ohhhhhhhhho.", "....ohhhhhhhhKo.", "....ohhsshsshko.", "....ohEEssEEhko.", "....osrEEsLLLko.", "....osssssLlLko.", "....oSssMMsSoK..",
    ".....oSsssSo....", "......ooSSoo....",
];
pub const GOKU_HEAD: [&str; 16] = [
    "..o.......o.....", ".oho..o..oho....", ".ohHo.ohoohHo..o", "..ohhohHhhhHhooo", ".oohhhhhhhhhhhho", "ohhhhHhhhhhhhho.", ".ohhhhhhhhhhhhho",
    "..ohhhhhhhhhhho.", "..ohhhhhshhhho..", "...ohhsshsshho..", "...ohEEssEEsho..", "...osrEEsEErso..", "...ossssssssSo..", "...oSsssMMsSo...",
    "....oSsssSo.....", ".....ooSSoo.....",
];
pub const GOHAN_HEAD: [&str; 16] = [
    "................", "................", ".....o..o.o.....", "....ohoohohoo...", "...ohhHhhhHhho..", "..ohhhhhhhhhhho.", "..ohhhhhhhhhhho.",
    "...ohhhhhhhhhho.", "...ohhhhhhhhho..", "...ohhsshsshho..", "...ohEEssEEsho..", "...osrEEsEErso..", "...ossssssssSo..", "...oSsssMMsSo...",
    "....oSsssSo.....", ".....ooSSoo.....",
];
pub const TRUNKS_HEAD: [&str; 16] = [
    "................", "................", ".....oooooo.....", "....ohHHhhhoo...", "...ohhhhhhhhho..", "...ohhhhhhhhhho.", "..ohhhhhohhhhho.",
    "..ohhhhosohhhho.", "..ohhhossssohho.", "..ohhossssssoho.", "..ohhsEEssEEsho.", "..ohhsrEEsrEsho.", "..ohhsssssssSho.", "...ohSssMMsSoho.",
    "...ohoSsssSo.o..", "....o.ooSSoo....",
];

type Rows = Vec<Vec<u8>>;

fn rows(r: &[&str]) -> Rows {
    r.iter().map(|s| s.as_bytes().to_vec()).collect()
}

fn cat(a: &[&str], b: &Rows) -> Rows {
    let mut o = rows(a);
    o.extend(b.iter().cloned());
    o
}

/// `makeHero(head, pal, gi)`
pub fn make_hero(head: &[&str], pal: &[(char, u32)], gi: bool) -> Hero {
    let base = Pal::new(&[
        ('o', 0x120c18), ('h', 0x1a1826), ('H', 0x4a5080), ('s', 0xf6c8a2), ('S', 0xd99a73), ('e', 0x120c18), ('m', 0xa8564e), ('b', 0x2b4fc8),
        ('B', 0x1c3584), ('a', 0xf4f4f6), ('A', 0xc2c6d2), ('y', 0xe8c040), ('Y', 0xa8841a), ('g', 0xffffff), ('G', 0xc8ccda), ('w', 0xffffff),
        ('W', 0xc8ccda), ('E', 0x120c18), ('L', 0x34d873), ('l', 0xc8ffd8), ('k', 0xdfe3ea), ('K', 0x8e95a4), ('M', 0x5e2824), ('r', 0xffffff),
    ])
    .with(pal);
    // a gi instead of armour: bare arms with wristbands, a belt (u), trousers (p)
    let body = |r: &[&str]| -> Rows {
        r.iter()
            .enumerate()
            .map(|(j, row)| {
                row.bytes()
                    .map(|c| match c {
                        _ if !gi => c,
                        b'b' if (3..=4).contains(&j) => b's',
                        b'B' if (3..=4).contains(&j) => b'S',
                        b'b' | b'B' if j == 7 => b'u',
                        b'b' if j >= 8 => b'p',
                        b'B' if j >= 8 => b'P',
                        _ => c,
                    })
                    .collect()
            })
            .collect()
    };
    let mut pose_rows: Vec<&str> = POSE_TOP.to_vec();
    pose_rows.extend_from_slice(&IDLE[7..]);
    let (idle, run_a, run_b, run_c, pose) = (body(&IDLE), body(&RUN_A), body(&RUN_B), body(&RUN_C), body(&pose_rows));
    let runs = [&run_a, &run_b, &run_c, &run_b];
    let mk = |r: &Rows, p: &Pal, ax: Option<f64>| make_sprite(r, p, "Ll", ax, None);
    let set = |p: &Pal| HeroSet {
        pose: mk(&cat(head, &pose), p, None),
        idle: mk(&cat(head, &idle), p, None),
        run: runs.map(|b| mk(&cat(head, b), p, None)),
    };
    // long hair down the back for super saiyan 3
    let long_hair = |r: Rows| -> Rows {
        let mut g: Rows = r
            .iter()
            .map(|row| {
                let mut v = b"....".to_vec();
                v.extend_from_slice(row);
                while v.len() < 20 {
                    v.push(b'.');
                }
                v
            })
            .collect();
        let n = g.len();
        for j in 1..n - 3 {
            let Some(first) = g[j].iter().position(|&c| c != b'.') else { continue };
            let first = first as i64;
            let w = if j < 4 {
                2
            } else if j < 12 {
                5
            } else {
                2i64.max(js_round(5.0 - (j as f64 - 12.0) * 0.45) as i64)
            };
            let jag = if j % 3 == 0 { 1 } else { 0 };
            let mut c = first - 1;
            while c >= 1i64.max(first - w - jag) {
                if g[j][c as usize] == b'.' {
                    g[j][c as usize] = if c == first - 2 && j % 2 == 1 { b'H' } else { b'h' };
                }
                c -= 1;
            }
            if let Some(edge) = g[j].iter().position(|&c| c != b'.') {
                if edge > 0 && j < n - 4 {
                    g[j][edge - 1] = b'o';
                }
            }
        }
        g
    };
    let set_long = |p: &Pal| HeroSet {
        pose: mk(&long_hair(cat(head, &pose)), p, Some(12.0)),
        idle: mk(&long_hair(cat(head, &idle)), p, Some(12.0)),
        run: runs.map(|b| mk(&long_hair(cat(head, b)), p, Some(12.0))),
    };
    let hair = |h: u32, hh: u32| base.with(&[('h', h), ('H', hh)]);
    let mut forms = vec![
        set(&base),
        set(&hair(0xffe02e, 0xfffbc8)),
        set(&hair(0xffe640, 0xfffde0)),
        set_long(&hair(0xffe02e, 0xfffbc8)),
        set(&hair(0xd8344a, 0xff8a8a)),
        set(&hair(0x3fb8ff, 0xc8f2ff)),
        set(&hair(0x6a2fc8, 0xc49cff)),
        set(&base.with(&[('a', 0xc8302a), ('A', 0x8a1f1a)])),
        set(&hair(0xd8dce8, 0xffffff)),
    ];
    forms.extend(LATE_HAIR.iter().map(|&(h, hh)| set(&hair(h, hh))));
    // fused with bubbles: monkey ears and tail, potara earrings, an orange vest, fur-brown streaks in the hair
    let hl = head.len() as i64;
    let fuse = |r: Rows| -> Rows {
        r.into_iter()
            .enumerate()
            .map(|(j, mut g)| {
                let j = j as i64;
                let mut put = |i: usize, c: u8| {
                    if g[i] == b'.' {
                        g[i] = c;
                    }
                };
                if (8..=11).contains(&j) {
                    put(3, if j == 8 || j == 11 { b'o' } else { b'q' });
                    put(2, if j == 9 || j == 10 { b'o' } else { b'.' });
                }
                if j == 12 {
                    put(3, b'y');
                    put(2, b'o');
                }
                if j == 13 {
                    put(3, b'Y');
                }
                let b = j - hl;
                if b == 6 {
                    put(2, b'o');
                    put(1, b'o');
                }
                if b == 7 {
                    put(2, b'T');
                    put(1, b'T');
                    put(0, b'o');
                }
                if b == 8 {
                    put(1, b'T');
                    put(0, b'o');
                    put(2, b'o');
                }
                if b == 9 {
                    put(1, b'T');
                    put(0, b'o');
                    put(2, b'T');
                    put(3, b'o');
                }
                if b == 10 {
                    put(2, b'o');
                    put(1, b'o');
                }
                g
            })
            .collect()
    };
    let fpal = base.with(&[('a', 0xf28a1c), ('A', 0xc0601a), ('H', 0x8a5a36), ('q', 0xf0c9a0), ('T', 0x8a5a36)]);
    let fused = HeroSet {
        pose: mk(&fuse(cat(head, &pose)), &fpal, None),
        idle: mk(&fuse(cat(head, &idle)), &fpal, None),
        run: runs.map(|b| mk(&fuse(cat(head, b)), &fpal, None)),
    };
    let mut back_pals = vec![
        base.clone(),
        hair(0xffe02e, 0xfffbc8),
        hair(0xffe640, 0xfffde0),
        hair(0xffe02e, 0xfffbc8),
        hair(0xd8344a, 0xff8a8a),
        hair(0x3fb8ff, 0xc8f2ff),
        hair(0x6a2fc8, 0xc49cff),
        base.clone(),
        hair(0xd8dde8, 0xffffff),
    ];
    back_pals.extend(LATE_HAIR.iter().map(|&(h, hh)| hair(h, hh)));
    let backs = back_pals.iter().map(|p| [&run_a, &run_c].map(|b| make_sprite(&cat(&BACK_HEAD, b), p, "", None, None))).collect();
    Hero { forms, fused, backs }
}

/// The four playable heroes (`HEROES`), by id.
pub fn heroes() -> &'static [(&'static str, Hero); 4] {
    static H: OnceLock<[(&'static str, Hero); 4]> = OnceLock::new();
    H.get_or_init(|| {
        [
            ("vegeta", make_hero(&VEGETA_HEAD, &[], false)),
            (
                "goku",
                make_hero(
                    &GOKU_HEAD,
                    &[('y', 0xf08a24), ('Y', 0xc0641a), ('a', 0xf08a24), ('A', 0xc0641a), ('g', 0x2b4fc8), ('G', 0x1c3584), ('u', 0x2b4fc8), ('p', 0xf08a24), ('P', 0xc0641a), ('w', 0x2b4fc8), ('W', 0x1c3584)],
                    true,
                ),
            ),
            (
                "gohan",
                make_hero(
                    &GOHAN_HEAD,
                    &[
                        ('y', 0x6a3aa8), ('Y', 0x45227a), ('a', 0x6a3aa8), ('A', 0x45227a), ('b', 0x6a3aa8), ('B', 0x45227a), ('g', 0xd8323a), ('G', 0x962028), ('u', 0xd8323a),
                        ('p', 0x6a3aa8), ('P', 0x45227a), ('w', 0x7a4a2a), ('W', 0x553018),
                    ],
                    true,
                ),
            ),
            (
                "trunks",
                make_hero(
                    &TRUNKS_HEAD,
                    &[
                        ('h', 0xb8a0e8), ('H', 0xe2d4ff), ('y', 0x26346e), ('Y', 0x16204a), ('a', 0x26346e), ('A', 0x16204a), ('b', 0x1a1a22), ('B', 0x0c0c12), ('g', 0xf6c8a2),
                        ('G', 0xd99a73), ('u', 0x8a5a2a), ('p', 0x6a6e7a), ('P', 0x4a4e58), ('w', 0xf2c84a), ('W', 0xc49a24),
                    ],
                    true,
                ),
            ),
        ]
    })
}

/// A hero by id, vegeta when unknown (`HERO()`).
pub fn hero(id: &str) -> &'static Hero {
    let h = heroes();
    &h.iter().find(|x| x.0 == id).unwrap_or(&h[0]).1
}

/// Every other sprite game.js builds at load, by its path there (`"FRIEZA"`, `"NPCS.whis"`, `"TOP_SPR.boxB"`).
pub fn baked() -> &'static HashMap<String, Sprite> {
    static B: OnceLock<HashMap<String, Sprite>> = OnceLock::new();
    B.get_or_init(|| parse(include_bytes!("../data/sprites.bin")))
}

/// A baked sprite by its game.js path; panics on a name the bake doesn't have.
pub fn get(name: &str) -> &'static Sprite {
    baked().get(name).unwrap_or_else(|| panic!("no baked sprite {name}"))
}

/// Reads the bake format (`difftest/sprites.js`).
pub fn parse(b: &[u8]) -> HashMap<String, Sprite> {
    assert_eq!(&b[..4], b"SPR1");
    let u16_at = |o: usize| u16::from_le_bytes([b[o], b[o + 1]]) as usize;
    let n = u32::from_le_bytes(b[4..8].try_into().unwrap()) as usize;
    let mut o = 8;
    let mut m = HashMap::with_capacity(n);
    for _ in 0..n {
        let l = u16_at(o);
        let name = String::from_utf8(b[o + 2..o + 2 + l].to_vec()).unwrap();
        o += 2 + l;
        let (w, h) = (u16_at(o), u16_at(o + 2));
        let (ax, ay) = (i16::from_le_bytes([b[o + 4], b[o + 5]]), i16::from_le_bytes([b[o + 6], b[o + 7]]));
        let np = u16_at(o + 8);
        o += 10;
        let pal: Vec<i32> = (0..np).map(|i| u32::from_le_bytes(b[o + i * 4..o + i * 4 + 4].try_into().unwrap()) as i32).collect();
        o += np * 4;
        let px = &b[o..o + w * h];
        o += w * h;
        let col = px.iter().map(|&p| if p & 127 == 0 { -1 } else { pal[(p & 127) as usize - 1] }).collect();
        let emit = px.iter().map(|&p| p & 128 != 0).collect();
        m.insert(name, Sprite { w, h, col, emit, ax: ax as f64, ay: ay as f64 });
    }
    if o < b.len() {
        let na = u32::from_le_bytes(b[o..o + 4].try_into().unwrap()) as usize;
        o += 4;
        for _ in 0..na {
            let mut s = || {
                let l = u16_at(o);
                let v = String::from_utf8(b[o + 2..o + 2 + l].to_vec()).unwrap();
                o += 2 + l;
                v
            };
            let (a, c) = (s(), s());
            let spr = m[&c].clone();
            m.insert(a, spr);
        }
    }
    m
}
