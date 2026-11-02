//! Looks the milestones unlock: aura colours, decor on the planet, share-card frames and trails behind the hero. The
//! named milestones at 1e10, 1e100 and 1e1000 each unlock one of every kind. Like everything else they last the run
//! (nothing is saved but the daily bonus's date); the menu's achievements tab wears them, one of each kind at a time.

use crate::game::Game;
use crate::limits::milestone;
use crate::sprite::Sprite;

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum LookKind {
    Aura,
    Decor,
    Frame,
    Trail,
}

impl LookKind {
    pub const ALL: [LookKind; 4] = [LookKind::Aura, LookKind::Decor, LookKind::Frame, LookKind::Trail];

    pub fn key(self) -> &'static str {
        match self {
            LookKind::Aura => "aura",
            LookKind::Decor => "decor",
            LookKind::Frame => "frame",
            LookKind::Trail => "trail",
        }
    }

    pub fn label(self) -> &'static str {
        match self {
            LookKind::Aura => "aura",
            LookKind::Decor => "on the planet",
            LookKind::Frame => "share card",
            LookKind::Trail => "trail",
        }
    }
}

pub struct Look {
    pub kind: LookKind,
    pub id: &'static str,
    pub name: &'static str,
    /// the named milestone that unlocks it (`limits::milestone`'s index: 0 is 1e10, 1 is 1e100, 3 is 1e1000)
    pub mile: u32,
    /// its colours (aura and trail: the particle palette)
    pub cols: [u32; 4],
}

pub const LOOKS: [Look; 12] = [
    Look { kind: LookKind::Aura, id: "scouter", name: "scouter green", mile: 0, cols: [0xffffff, 0xb8ffc8, 0x34d873, 0x34d873] },
    Look { kind: LookKind::Aura, id: "realm", name: "the gods' violet", mile: 1, cols: [0xffffff, 0xd8c8ff, 0x8a5aff, 0x8a5aff] },
    Look { kind: LookKind::Aura, id: "zeno", name: "zeno's gold", mile: 3, cols: [0xffffff, 0xffe02e, 0xff9ad8, 0xff9ad8] },
    Look { kind: LookKind::Decor, id: "scouter", name: "the broken scouter", mile: 0, cols: [0; 4] },
    Look { kind: LookKind::Decor, id: "staff", name: "whis's staff", mile: 1, cols: [0; 4] },
    Look { kind: LookKind::Decor, id: "button", name: "zeno's button", mile: 3, cols: [0; 4] },
    Look { kind: LookKind::Frame, id: "scouter", name: "scouter readout", mile: 0, cols: [0; 4] },
    Look { kind: LookKind::Frame, id: "angel", name: "angel's ring", mile: 1, cols: [0; 4] },
    Look { kind: LookKind::Frame, id: "zeno", name: "zeno's stars", mile: 3, cols: [0; 4] },
    Look { kind: LookKind::Trail, id: "sparks", name: "ki sparks", mile: 0, cols: [0xffffff, 0x9cf0b8, 0x34d873, 0x1f9e55] },
    Look { kind: LookKind::Trail, id: "starlight", name: "starlight", mile: 1, cols: [0xffffff, 0xe8dcff, 0xb59cff, 0x8a5aff] },
    Look { kind: LookKind::Trail, id: "confetti", name: "confetti", mile: 3, cols: [0xffe02e, 0xff9ad8, 0x9fe6ff, 0xffffff] },
];

/// The power that unlocks a look, as the HUD prints it.
pub fn look_need(l: &Look) -> &'static str {
    match l.mile {
        0 => "1e10",
        1 => "1e100",
        _ => "1e1000",
    }
}

fn grid(rows: &[&str], pal: &[(char, u32)]) -> Sprite {
    let (w, h) = (rows[0].len(), rows.len());
    let mut col = vec![-1i32; w * h];
    for (j, r) in rows.iter().enumerate() {
        for (i, ch) in r.chars().enumerate() {
            if let Some(&(_, c)) = pal.iter().find(|p| p.0 == ch) {
                col[j * w + i] = c as i32;
            }
        }
    }
    Sprite { w, h, col, emit: vec![false; w * h], ax: (w as f64 / 2.0).floor(), ay: h as f64 - 1.0 }
}

/// A decor's sprite: standing on the planet, anchored at its foot.
pub fn decor_sprite(id: &str) -> &'static Sprite {
    use std::sync::OnceLock;
    static S: OnceLock<[Sprite; 3]> = OnceLock::new();
    let s = S.get_or_init(|| {
        let k = ('k', 0x1e140c);
        [
            // the scouter that exploded at 1e10, its glass cracked, on a stone pedestal
            grid(
                &[
                    "..rww....",
                    "..wGgg...",
                    "..wgWg...",
                    "..wGgx...",
                    "...www...",
                    "....s....",
                    ".sssssss.",
                    "..SSSSS..",
                    "..SsSSS..",
                    "..SSSSS..",
                    ".sssssss.",
                    "kkkkkkkkk",
                ],
                &[('r', 0xe0473e), ('w', 0xf2f2f2), ('g', 0x34d873), ('G', 0x9cf0b8), ('W', 0xffffff), ('x', 0x0e3a1c), ('s', 0xc8c0b0), ('S', 0x9a9284), k],
            ),
            // whis's staff, planted in the ground: the dark orb with its sheen, the gold ring, the long pole
            grid(
                &[
                    "..bbb..", ".bBbbb.", ".bbbcb.", ".bbccb.", "..bbb..", ".yyyyy.", "..yYy..", "...y...", "...Y...", "...y...", "...y...", "...Y...",
                    "...y...", "...y...", "...y...", "..ddd..", ".kkkkk.",
                ],
                &[('b', 0x1c2a3a), ('B', 0x9fe6ff), ('c', 0x4a7a9a), ('y', 0xd8a020), ('Y', 0xffe08a), ('d', 0x6a4a2a), k],
            ),
            // zeno's button on its little gold stand
            grid(
                &["...ppp...", "..pPppp..", "..ppppp..", ".ggggggg.", ".gGGGGGg.", ".ggggggg.", "..g...g..", "..g...g..", ".kkkkkkk."],
                &[('p', 0xff5aa8), ('P', 0xffc2e2), ('g', 0xd8a020), ('G', 0xffe08a), k],
            ),
        ]
    });
    match id {
        "staff" => &s[1],
        "button" => &s[2],
        _ => &s[0],
    }
}

impl Game {
    /// Whether a look is unlocked: its milestone has been passed this run.
    pub fn look_open(&self, l: &Look) -> bool {
        let mut i = 0;
        while milestone(i).1 != Some(l.mile) {
            i += 1;
        }
        self.s.mile > i
    }

    /// The look worn of a kind, if any.
    pub fn look(&self, k: LookKind) -> Option<&'static Look> {
        let id = self.s.wear[k as usize]?;
        LOOKS.iter().find(|l| l.kind == k && l.id == id)
    }

    /// `wear(kind, id)`: wears an unlocked look, or takes it off (`id` empty, or the one already worn).
    pub fn wear(&mut self, kind: &str, id: &str) {
        let Some(k) = LookKind::ALL.into_iter().find(|k| k.key() == kind) else { return };
        if id.is_empty() || self.s.wear[k as usize] == Some(id) {
            self.s.wear[k as usize] = None;
            return;
        }
        if let Some(l) = LOOKS.iter().find(|l| l.kind == k && l.id == id).filter(|l| self.look_open(l)) {
            self.s.wear[k as usize] = Some(l.id);
        }
    }

    /// The looks a named milestone unlocks, for its toast.
    pub(crate) fn looks_of(k: u32) -> Vec<&'static str> {
        LOOKS.iter().filter(|l| l.mile == k).map(|l| l.name).collect()
    }
}

impl Game {
    /// Preview hook `#looks0` (`#looks1`, `#looks3`): that milestone's looks unlocked and worn, one of every kind.
    pub(crate) fn looks_preview(&mut self, hash: &str) {
        let Some(i) = hash.find(crate::hooks::key("looks")) else { return };
        let k: u32 = hash[i + 5..].chars().take_while(|c| c.is_ascii_digit()).collect::<String>().parse().unwrap_or(0);
        let mut n = 0;
        while milestone(n).1 != Some(k) {
            n += 1;
        }
        self.s.mile = n + 1;
        self.s.o9k = true;
        self.s.ach.insert("o9k");
        for l in LOOKS.iter().filter(|l| l.mile == k) {
            self.s.wear[l.kind as usize] = Some(l.id);
        }
    }
}
