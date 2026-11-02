//! Tables and tuning constants lifted from game.js (`mount` in the planet game). Names follow the JS.

/// Shop upgrades that reset on ascending (game.js `RESETS`, in that order).
#[derive(Clone, Copy, Debug, PartialEq, Eq, Hash)]
pub enum Upg {
    Boots,
    Partner,
    Gravity,
    Cloud,
    Scouter,
    Galick,
    Senzu,
    House,
    Armor,
    Kaio,
    Bigbang,
    Piccolo,
    Chamber,
    Tail,
    Itx,
}

impl Upg {
    pub const ALL: [Upg; 15] = [
        Upg::Boots,
        Upg::Partner,
        Upg::Gravity,
        Upg::Cloud,
        Upg::Scouter,
        Upg::Galick,
        Upg::Senzu,
        Upg::House,
        Upg::Armor,
        Upg::Kaio,
        Upg::Bigbang,
        Upg::Piccolo,
        Upg::Chamber,
        Upg::Tail,
        Upg::Itx,
    ];

    pub fn key(self) -> &'static str {
        SHOP[self as usize].key
    }

    pub fn from_key(k: &str) -> Option<Upg> {
        Upg::ALL.into_iter().find(|u| u.key() == k)
    }
}

pub struct ShopItem {
    pub key: &'static str,
    pub base: f64,
    pub k: f64,
    pub label: &'static str,
    pub what: &'static str,
}

/// Indexed by `Upg`. Unlock rules live in `Game::unlocked`.
pub const SHOP: [ShopItem; 15] = [
    ShopItem { key: "boots", base: 50.0, k: 1.7, label: "weighted boots", what: "+1 per step" },
    ShopItem { key: "partner", base: 250.0, k: 1.7, label: "bubbles", what: "+4/s, trains with you" },
    ShopItem { key: "gravity", base: 2500.0, k: 2.6, label: "gravity chamber", what: "×1.15 everything" },
    ShopItem { key: "cloud", base: 1000.0, k: 2.2, label: "flying nimbus", what: "comes more often" },
    ShopItem { key: "scouter", base: 800.0, k: 2.1, label: "scouter", what: "+10% crits (×2)" },
    ShopItem { key: "galick", base: 1500.0, k: 2.3, label: "galick charge", what: "hold to charge a beam" },
    ShopItem { key: "senzu", base: 4000.0, k: 2.2, label: "senzu tree", what: "beans: tap for ×1.5" },
    ShopItem { key: "house", base: 6000.0, k: 2.3, label: "capsule house", what: "+40/s (a new dome up to lv 9)" },
    ShopItem { key: "armor", base: 12000.0, k: 2.4, label: "saiyan armor", what: "+50% vs villains & saibamen" },
    ShopItem { key: "kaio", base: 20000.0, k: 2.6, label: "kaioken", what: "red button: big boost, then tired" },
    ShopItem { key: "bigbang", base: 60000.0, k: 2.5, label: "big bang attack", what: "double-tap: an exploding ki ball" },
    ShopItem { key: "piccolo", base: 30000.0, k: 2.4, label: "piccolo", what: "+60/s, zaps meteors" },
    ShopItem { key: "chamber", base: 150000.0, k: 2.8, label: "time chamber", what: "a door appears: train ×2 for 15s inside" },
    ShopItem { key: "tail", base: 40000.0, k: 2.5, label: "tail training", what: "great ape: +×0.25, +8% size, +2s (size and time slow past lv 10)" },
    ShopItem { key: "itx", base: 5e6, k: 2.6, label: "instant transmission", what: "two-finger tap or right-click: jump to a world you've been" },
];

/// Where instant transmission can jump: every world but home, snake way and the arena.
pub const ITX_WORLDS: [u32; 10] = [1, 2, 4, 5, 6, 7, 8, 10, 11, 12];

/// Producer milestones: these levels double output, then every 50 past 100.
pub const MILES: [Upg; 4] = [Upg::Boots, Upg::Partner, Upg::House, Upg::Piccolo];
pub const MS: [u32; 4] = [10, 25, 50, 100];

#[derive(Clone, Debug)]
pub struct Form {
    pub name: &'static str,
    pub at: f64,
    pub x: f64,
    /// the `ALL_FORMS` index he looks like (a limit-breaker form keeps the last form's look)
    pub look: usize,
    /// a limit-breaker form's number (1, 2, …); 0 for the canon forms
    pub lb: u32,
    /// a non-saiyan's own aura, in place of the super saiyan form's he'd look like
    pub own_aura: Option<[u32; 3]>,
}

impl Form {
    /// The aura's colours: the canon form's, or a limit breaker's (they cycle).
    pub fn aura(&self) -> [u32; 3] {
        if let Some(a) = self.own_aura.filter(|_| self.lb == 0) {
            a
        } else if self.lb == 0 {
            FORM_AURA[self.look]
        } else {
            LB_AURA[(self.lb as usize - 1) % LB_AURA.len()]
        }
    }
}

/// The limit-breaker forms' auras, in turn.
pub const LB_AURA: [[u32; 3]; 6] = [
    [0xffffff, 0xffd0ff, 0xff5ad8],
    [0xffffff, 0xc8fff0, 0x2ee8b0],
    [0xffffff, 0xffe0a0, 0xff8a1e],
    [0xffffff, 0xd8d0ff, 0x8a5aff],
    [0xffffff, 0xffb0b0, 0xff2a3a],
    [0xffffff, 0xf0f8ff, 0xb0c8ff],
];

fn roman(mut n: u32) -> String {
    let mut s = String::new();
    for (v, r) in
        [(1000, "M"), (900, "CM"), (500, "D"), (400, "CD"), (100, "C"), (90, "XC"), (50, "L"), (40, "XL"), (10, "X"), (9, "IX"), (5, "V"), (4, "IV"), (1, "I")]
    {
        while n >= v {
            s.push_str(r);
            n -= v;
        }
    }
    s
}

/// A number as roman numerals, kept for the life of the program (form and limit names are `&'static`).
pub fn roman_static(n: u32) -> &'static str {
    use std::sync::{Mutex, OnceLock};
    static NAMES: OnceLock<Mutex<Vec<&'static str>>> = OnceLock::new();
    let mut v = NAMES.get_or_init(|| Mutex::new(Vec::new())).lock().unwrap();
    while v.len() <= n as usize {
        let i = v.len() as u32;
        v.push(Box::leak(roman(i).into_boxed_str()));
    }
    v[n as usize]
}

fn lb_name(n: u32) -> &'static str {
    use std::sync::{Mutex, OnceLock};
    static NAMES: OnceLock<Mutex<Vec<&'static str>>> = OnceLock::new();
    let mut v = NAMES.get_or_init(|| Mutex::new(Vec::new())).lock().unwrap();
    while v.len() <= n as usize {
        let i = v.len() as u32;
        v.push(Box::leak(format!("limit breaker {}", roman(i)).into_boxed_str()));
    }
    v[n as usize]
}

/// `ALL_FORMS`: the first nine are shared; 9.. are the late canon forms each hero picks from.
pub const ALL_FORMS: [(&str, f64, f64); 14] = [
    ("base", 0.0, 1.0),
    ("super saiyan", 2e4, 1.5),
    ("super saiyan 2", 2e5, 2.0),
    ("super saiyan 3", 2e6, 3.0),
    ("super saiyan god", 2e7, 4.0),
    ("super saiyan blue", 2e8, 6.0),
    ("ultra ego", 2e9, 8.0),
    ("super saiyan 4", 2e10, 12.0),
    ("ultra instinct", 2e11, 16.0),
    ("mastered ultra instinct", 0.0, 0.0),
    ("super saiyan blue evolved", 0.0, 0.0),
    ("beast", 0.0, 0.0),
    ("true ultra ego", 0.0, 0.0),
    ("super saiyan rage", 0.0, 0.0),
];
pub const UI_FORM: usize = 8;
pub const MUI_FORM: usize = 9;
pub const LATE_STEP: f64 = 1000.0;
/// The first late form's mark (a saiyan's tenth form): god ki and mastery stars go by it for every hero.
pub const LATE_AT: f64 = 2e14;
/// From this limit on, every limit broken is also a form-up.
pub const LB_FROM: u32 = 3;
const LATE_X: [f64; 3] = [24.0, 40.0, 64.0];

#[derive(Clone, Copy, Debug, PartialEq, Eq, Default)]
pub enum Hero {
    #[default]
    Vegeta,
    Goku,
    Gohan,
    Trunks,
    Piccolo,
    Krillin,
    Goten,
    Tien,
    A17,
}

impl Hero {
    /// Saiyans climb the super saiyan ladder; the others name the same nine marks their own way.
    pub fn saiyan(self) -> bool {
        matches!(self, Hero::Vegeta | Hero::Goku | Hero::Gohan | Hero::Trunks | Hero::Goten)
    }
}

/// The non-Saiyans' names for the shared nine marks. Placeholders until their forms are picked.
fn own_names(h: Hero) -> Option<[&'static str; 9]> {
    Some(match h {
        Hero::Piccolo => {
            ["base", "weights off", "demon king", "super namekian", "namekian warrior", "potential unleashed", "namekian god", "orange piccolo", "orange giant"]
        }
        Hero::Krillin => [
            "base",
            "unlocked potential",
            "guru's unlock",
            "turtle master",
            "destructo master",
            "old kai's unlock",
            "strongest human",
            "earth's guardian",
            "beyond human",
        ],
        Hero::Tien => ["base", "max power", "crane master", "kikoho stance", "tri-beam master", "neo crane", "all-seeing", "dojo master", "heaven's eye"],
        Hero::A17 => ["base", "limiter off", "barrier", "ranger", "perpetual core", "overclock", "survivor", "last one standing", "infinite"],
        _ => return None,
    })
}

/// A non-saiyan's aura at every canon form: piccolo's namekian white-green, the others the plain base aura until
/// their forms are picked.
fn own_aura(h: Hero) -> Option<[u32; 3]> {
    match h {
        Hero::Piccolo => Some([0xffffff, 0xe2f8d8, 0x8ad87a]),
        _ if h.saiyan() => None,
        _ => Some(FORM_AURA[0]),
    }
}

/// `ladderOf`: the shared nine, then the hero's late forms at 2e14, ×1000 each; then, once limit III is broken, a
/// limit-breaker form for each limit broken past it (×2 each, held at the last canon form's mark).
pub fn ladder_of(h: Hero, limits: u32) -> Vec<Form> {
    let late: &[usize] = match h {
        Hero::Vegeta => &[10, 12],
        Hero::Goku => &[9],
        Hero::Gohan => &[11],
        Hero::Trunks => &[13],
        // their own late forms come below; the rest aren't built yet: their ladders stop at the shared nine
        Hero::Piccolo | Hero::Krillin | Hero::Goten | Hero::Tien | Hero::A17 => &[],
    };
    // a non-saiyan's own late forms, each with its aura: their looks follow the shared nine in his sprites
    let own_late: &[(&str, [u32; 3])] = match h {
        Hero::Piccolo => &[
            ("synced with nail", [0xffffff, 0xd8ffc8, 0x6ae05a]),
            ("synced with kami", [0xffffff, 0xe8f0ff, 0x3a6ad8]),
            ("complete namekian", [0xffffff, 0xfff6c0, 0xe8d040]),
        ],
        Hero::Krillin => &[("solar flare", [0xffffff, 0xfffbe0, 0xffe680]), ("taiyoken sun", [0xffffff, 0xfff8b0, 0xffd60a])],
        Hero::Tien => &[("four witches", [0xffffff, 0xd8ffe0, 0x3aa86a]), ("multi-form", [0xffffff, 0xe8f0ff, 0x8ab0e0])],
        // android 17's marks past the nine: unseen, like all his marks (a17.rs)
        Hero::A17 => &[("infinite ii", [0xffffff, 0xd8e8ff, 0x7a9ad8]), ("infinite iii", [0xffffff, 0xd8e8ff, 0x7a9ad8])],
        _ => &[],
    };
    let own = own_names(h);
    // goten was born super saiyan: his marks come at a tenth (he can't hold a form for long, heroes.rs)
    let mark = if h == Hero::Goten { crate::heroes::GOTEN_MARK } else { 1.0 };
    let mut v: Vec<Form> = ALL_FORMS[..9]
        .iter()
        .enumerate()
        .map(|(i, &(name, at, x))| Form { name: own.map_or(name, |n| n[i]), at: at * mark, x, look: i, lb: 0, own_aura: own_aura(h) })
        .collect();
    for (j, &i) in late.iter().enumerate() {
        v.push(Form { name: ALL_FORMS[i].0, at: 2e14 * crate::jsmath::pow(LATE_STEP, j as f64), x: LATE_X[j], look: i, lb: 0, own_aura: None });
    }
    for (j, &(name, aura)) in own_late.iter().enumerate() {
        v.push(Form { name, at: 2e14 * crate::jsmath::pow(LATE_STEP, j as f64), x: LATE_X[j], look: 9 + j, lb: 0, own_aura: Some(aura) });
    }
    // piccolo's forms each have their own aura: demon king's dark, the orange forms' orange
    if h == Hero::Piccolo {
        v[2].own_aura = Some([0xffffff, 0xc8a8e8, 0x4a2a6a]);
        v[7].own_aura = Some([0xffffff, 0xffd8a8, 0xf2913a]);
        v[8].own_aura = Some([0xffffff, 0xffd8a8, 0xf2913a]);
    }
    // android 17 has no forms to look like: every mark wears his base look (his overclock picks his look, a17.rs)
    if h == Hero::A17 {
        for f in v.iter_mut() {
            f.look = 0;
        }
    }
    let top = v[v.len() - 1].clone();
    for n in 1..=limits.saturating_sub(LB_FROM - 1) {
        v.push(Form { name: lb_name(n), at: top.at, x: top.x * 2f64.powi(n as i32), look: top.look, lb: n, own_aura: None });
    }
    v
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Branch {
    Body,
    Spirit,
    Fate,
}

pub struct Node {
    pub id: &'static str,
    pub branch: Branch,
    pub tier: usize,
    pub name: &'static str,
    pub what: &'static str,
    pub max: u32,
}

const INF: u32 = u32::MAX;

/// The training tree. `N_*` index into it and into `Save::tree`.
pub const TREE: [Node; 21] = [
    Node { id: "fist", branch: Branch::Body, tier: 0, name: "iron fist", what: "taps +50% a rank", max: INF },
    Node { id: "crit", branch: Branch::Body, tier: 0, name: "eagle eye", what: "+8% crit chance a rank", max: 5 },
    Node { id: "legs", branch: Branch::Body, tier: 1, name: "road work", what: "lap bonus +50% a rank", max: INF },
    Node { id: "stride", branch: Branch::Body, tier: 1, name: "long stride", what: "he runs 10% faster a rank: more laps", max: 5 },
    Node { id: "brawl", branch: Branch::Body, tier: 1, name: "brawler", what: "villain taps +50% a rank", max: INF },
    Node { id: "critx", branch: Branch::Body, tier: 2, name: "pressure point", what: "crits hit ×1 harder a rank", max: INF },
    Node { id: "pride", branch: Branch::Body, tier: 3, name: "saiyan pride", what: "combo goes to ×4", max: 1 },
    Node { id: "idle", branch: Branch::Spirit, tier: 0, name: "meditation", what: "idle income +50% a rank", max: INF },
    Node { id: "beam", branch: Branch::Spirit, tier: 0, name: "ki control", what: "beams +25% a rank", max: INF },
    Node { id: "chamber", branch: Branch::Spirit, tier: 1, name: "patience", what: "the chamber door comes 25% more often a rank", max: INF },
    Node { id: "senzu", branch: Branch::Spirit, tier: 1, name: "senzu farmer", what: "senzu beans last 5s longer a rank", max: INF },
    Node { id: "seedx", branch: Branch::Spirit, tier: 1, name: "zenkai", what: "each ki seed +2% more a rank", max: INF },
    Node { id: "auto", branch: Branch::Spirit, tier: 2, name: "instinct", what: "an auto tap every second a rank", max: INF },
    Node { id: "eternal", branch: Branch::Spirit, tier: 3, name: "eternal ki", what: "idle income ×3", max: 1 },
    Node { id: "pods", branch: Branch::Fate, tier: 0, name: "pod magnet", what: "space pods 12% sooner a rank", max: 5 },
    Node { id: "balls", branch: Branch::Fate, tier: 0, name: "dragon radar", what: "+5% dragon ball orbs a rank", max: 5 },
    Node { id: "bounty", branch: Branch::Fate, tier: 1, name: "bounty hunter", what: "villain prizes +50% a rank", max: INF },
    Node { id: "deal", branch: Branch::Fate, tier: 1, name: "bulma's discount", what: "every upgrade costs 5% less a rank", max: 5 },
    Node { id: "wish", branch: Branch::Fate, tier: 1, name: "shenron's favour", what: "each wish +5% more a rank", max: INF },
    Node { id: "head", branch: Branch::Fate, tier: 2, name: "head start", what: "keep 1% of your power a rank when you ascend", max: 3 },
    Node { id: "saga", branch: Branch::Fate, tier: 3, name: "legend", what: "saga villains drop a ki seed", max: 1 },
];
pub const N_FIST: usize = 0;
pub const N_CRIT: usize = 1;
pub const N_LEGS: usize = 2;
pub const N_STRIDE: usize = 3;
pub const N_CRITX: usize = 5;
pub const N_PRIDE: usize = 6;
pub const N_IDLE: usize = 7;
pub const N_SEEDX: usize = 11;
pub const N_AUTO: usize = 12;
pub const N_ETERNAL: usize = 13;
pub const N_DEAL: usize = 17;
pub const N_WISH: usize = 18;
pub const N_HEAD: usize = 19;

pub fn node_ix(id: &str) -> Option<usize> {
    TREE.iter().position(|n| n.id == id)
}

/// Seeds per rank by tier, and branch points needed to open the tier.
pub const TIER_COST: [u32; 4] = [1, 2, 5, 15];
pub const TIER_NEED: [u32; 4] = [0, 4, 8, 12];

pub struct Angel {
    pub id: &'static str,
    pub who: &'static str,
    pub tier: usize,
    pub cost: u32,
}

pub const ANGELS: [Angel; 8] = [
    Angel { id: "divine", who: "whis", tier: 0, cost: 1 },
    Angel { id: "golden", who: "whis", tier: 0, cost: 1 },
    Angel { id: "staff", who: "whis", tier: 1, cost: 2 },
    Angel { id: "auto", who: "whis", tier: 2, cost: 3 },
    Angel { id: "notes", who: "vados", tier: 0, cost: 1 },
    Angel { id: "skip", who: "vados", tier: 0, cost: 1 },
    Angel { id: "stars", who: "vados", tier: 1, cost: 2 },
    Angel { id: "priest", who: "vados", tier: 2, cost: 3 },
];
pub const A_DIVINE: usize = 0;
pub const A_GOLDEN: usize = 1;
pub const A_AUTO: usize = 3;
pub const A_NOTES: usize = 4;
pub const A_STARS: usize = 6;
pub const A_PRIEST: usize = 7;

pub fn angel_ix(id: &str) -> Option<usize> {
    ANGELS.iter().position(|a| a.id == id)
}

pub const AUTO_AT: [f64; 6] = [0.0, 1e9, 1e12, 1e15, 1e18, 1e21];

pub struct Goal {
    pub id: &'static str,
    pub n: f64,
    pub text: &'static str,
}

pub const GOALS: [Goal; 9] = [
    Goal { id: "combo", n: 1.0, text: "hit a ×2 combo" },
    Goal { id: "laps", n: 10.0, text: "run 10 laps" },
    Goal { id: "star", n: 3.0, text: "catch 3 space pods" },
    Goal { id: "saiba", n: 15.0, text: "defeat 15 saibamen" },
    Goal { id: "meteor", n: 10.0, text: "bust 10 meteors" },
    Goal { id: "boss", n: 1.0, text: "defeat a villain" },
    Goal { id: "ball", n: 2.0, text: "find 2 dragon balls" },
    Goal { id: "beam", n: 5.0, text: "fire 5 full-power beams" },
    Goal { id: "tour", n: 20.0, text: "score 20 KO in a tournament" },
];

// economy tuning
pub const ECON: f64 = 0.35;
pub const SEED_SOFT: f64 = 10.0;
pub const SEED_EXP: f64 = 0.5;
pub const CEIL0: f64 = 20.0;
pub const CEIL_T: f64 = 1.04;
pub const CEIL_STEP: f64 = 2.0;
pub const CEIL_EXP: f64 = 0.15;
/// limit I sits at a ki ceiling of 1e6; each limit after it doubles the exponent
pub const LIMIT0: f64 = 6.0;
/// strain (in strain-seconds) to break limit I, and how much more each limit after it takes
pub const BREAK_S: f64 = 1200.0;
pub const BREAK_G: f64 = 1.2;
/// strain from play: a training tap (at most one every `TAP_GAP`s counts), a full-charge beam, a big bang; kaioken
/// multiplies it while it's on
pub const STRAIN_TAP: f64 = 0.8;
pub const STRAIN_TAP_GAP: f64 = 0.25;
pub const STRAIN_BEAM: f64 = 10.0;
pub const STRAIN_BANG: f64 = 6.0;
pub const STRAIN_KAIO: f64 = 1.4;
/// the named limits' rewards: II eases the seed soft cap, IV makes god ki compound, V lifts universe stars
pub const SEED_EXP_II: f64 = 0.75;
pub const GOD_X_IV: f64 = 1.5;
pub const STAR_X_V: f64 = 1.75;
pub const STAR_X: f64 = 1.5;
pub const GOD_X: f64 = 1.0;
pub const MASTERY_X: f64 = 1.25;
pub const ZENO_X: f64 = 10.0;
pub const ZENO_GODS: u32 = 2;
/// seconds between ascends: rank spam can't outrun the ki ceiling, and an idle player checking in now and then never waits
pub const ASC_CD: f64 = 600.0;
/// game.js laps at 6.283, a hair short of 2π; kept so lap timing matches
#[allow(clippy::approx_constant)]
pub const LAP: f64 = 6.283;
/// Each form's aura colours (`FORMS[i].aura`), by `ALL_FORMS` index.
pub const FORM_AURA: [[u32; 3]; 14] = [
    [0xffffff, 0xbfe9ff, 0x6fb0ff],
    [0xffffff, 0xfff8b0, 0xffe02e],
    [0xffffff, 0xfff8b0, 0xffe02e],
    [0xffffff, 0xfff8b0, 0xffd60a],
    [0xffd0c0, 0xff7a5a, 0xd8344a],
    [0xffffff, 0x9fe6ff, 0x2f9ae0],
    [0xe6d6ff, 0xa070f0, 0x4a1f9a],
    [0xffffff, 0xff9a8a, 0xc8302a],
    [0xffffff, 0xd8e8ff, 0x8aa0c8],
    [0xffffff, 0xeef2ff, 0xa8b4d0],
    [0xc8e8ff, 0x3a74d8, 0x122e78],
    [0xffffff, 0xe2d4ff, 0x8a4ae0],
    [0xd8c0ff, 0x7a3ad0, 0x2a0a5a],
    [0xffffff, 0xfff4b0, 0x6ab8f0],
];

pub const N_BRAWL: usize = 4;
pub const N_BEAM: usize = 8;
pub const N_CHAMBER: usize = 9;
pub const N_SENZU: usize = 10;
pub const N_PODS: usize = 14;
pub const N_BALLS: usize = 15;
pub const N_BOUNTY: usize = 16;
pub const N_SAGA: usize = 20;
pub const A_STAFF: usize = 2;
pub const A_SKIP: usize = 5;

// ── the timeline (stage 3)

/// Seconds at home before a trip happens anyway, and the best power of the first trip.
pub const TRIP_WAIT: f64 = 120.0;
pub const PLANET_EVERY: f64 = 1e6;
/// The trip rotation: namek, planet vegeta, snake way, beerus, west city, kame house, paozu, the future, the lookout, kai world, yardrat.
/// Snake way's slot is skipped while it's parked (`SNAKE_WAY_ENABLED`).
pub const TRIPS: [u32; 11] = [1, 2, 3, 4, 5, 6, 7, 8, 10, 11, 12];
/// Snake way is parked: false skips its slot in the trip rotation (the `#snake` preview hook still runs it); true
/// puts it back.
pub const SNAKE_WAY_ENABLED: bool = false;
/// The achievements only snake way gives: hidden while it's parked.
pub const SNAKE_ACH: [&str; 4] = ["snakeway", "hfil", "streak", "souls10"];
/// The great ape's achievements: only saiyans see them, since only saiyans transform on the full moon.
pub const APE_ACH: [&str; 5] = ["ape", "giantape", "tail10", "tail25", "tail50"];
/// Worlds that sit the planet bigger or higher (`W2L`): (world, zoom, dy).
pub const W2L: [(u32, f64, f64); 4] = [(2, 1.22, 0.0), (10, 0.82, -0.07), (11, 1.0, 0.0), (12, 1.0, 0.0)];
pub const WORLD_NAMES: [&str; 13] =
    ["", "namek", "vegeta", "snake way", "beerus", "west city", "kame house", "paozu", "the future", "the arena", "lookout", "kai world", "yardrat"];
pub const WORLD_ACH: [(u32, &str); 7] = [(1, "namek"), (6, "kame"), (7, "paozu"), (8, "future"), (10, "lookout"), (11, "kaiworld"), (12, "yardrat")];

/// A sprite's size: the timeline aims at and hit-tests sprites by their width and height.
#[derive(Clone, Copy, Debug, PartialEq, Default)]
pub struct Dim {
    pub w: f64,
    pub h: f64,
}

const fn dim(w: u32, h: u32) -> Dim {
    Dim { w: w as f64, h: h as f64 }
}

/// The sagas in story order (`VILLAINS`), with their sprite sizes.
pub const VILLAINS: [(&str, Dim); 13] = [
    ("raditz", dim(26, 34)),
    ("nappa", dim(28, 34)),
    ("vegeta", dim(24, 34)),
    ("frieza", dim(26, 34)),
    ("cell", dim(33, 43)),
    ("kid buu", dim(29, 34)),
    ("broly", dim(30, 38)),
    ("beerus", dim(26, 34)),
    ("hit", dim(26, 36)),
    ("goku black", dim(26, 36)),
    ("jiren", dim(28, 36)),
    ("moro", dim(26, 36)),
    ("gas", dim(28, 38)),
];
pub const NAPPA: Dim = dim(28, 34);
pub const GINYU: [(&str, Dim); 5] = [("ginyu", dim(16, 22)), ("jeice", dim(16, 22)), ("burter", dim(16, 22)), ("recoome", dim(16, 22)), ("guldo", dim(16, 22))];
pub const A17: Dim = dim(20, 25);
pub const A18: Dim = dim(16, 24);
pub const A16: Dim = dim(20, 28);
pub const A19: Dim = dim(18, 24);
pub const A20: Dim = dim(18, 26);
pub const APE0: Dim = dim(22, 25);

/// The movie villains and their henchmen.
pub const MOVIE: [(&str, Dim); 10] = [
    ("cooler", dim(28, 38)),
    ("janemba", dim(32, 40)),
    ("bojack", dim(28, 38)),
    ("salza", dim(18, 26)),
    ("dore", dim(18, 26)),
    ("neiz", dim(18, 26)),
    ("zangya", dim(18, 26)),
    ("bujin", dim(18, 26)),
    ("bido", dim(18, 26)),
    ("kogu", dim(18, 26)),
];

pub fn movie_dim(name: &str) -> Dim {
    MOVIE.iter().find(|m| m.0 == name).map(|m| m.1).unwrap()
}

#[derive(Debug)]
pub struct MovieDef {
    pub who: &'static str,
    pub hp: [f64; 2],
    pub minions: &'static [&'static str],
    pub nova: f64,
    pub jelly: bool,
    pub split: bool,
    pub flip: bool,
    pub earth: bool,
    pub web: bool,
    pub intro: &'static str,
    pub win: &'static str,
    pub ach: &'static str,
}

/// `MV`, in the order a random pick sees them.
pub const MOVIES: [MovieDef; 3] = [
    MovieDef {
        who: "cooler",
        hp: [16.0, 34.0],
        minions: &["salza", "dore", "neiz"],
        nova: 14.0,
        jelly: false,
        split: false,
        flip: false,
        earth: false,
        web: false,
        intro: "cooler's armoured squadron drops in — beat salza, dore and neiz, then stop his supernova",
        win: "cooler: \"impossible… not again\"",
        ach: "coolerdown",
    },
    MovieDef {
        who: "janemba",
        hp: [70.0, 0.0],
        minions: &[],
        nova: 0.0,
        jelly: true,
        split: true,
        flip: true,
        earth: false,
        web: false,
        intro: "reality turns to jelly — janemba! he splits in two and space flips as he does",
        win: "janemba bursts like a bubble — the world sets back to normal",
        ach: "unwarped",
    },
    MovieDef {
        who: "bojack",
        hp: [55.0, 20.0],
        minions: &["zangya", "bujin", "bido", "kogu"],
        nova: 0.0,
        jelly: false,
        split: false,
        flip: false,
        earth: true,
        web: true,
        intro: "bojack's gang drags the fight to earth — and bujin's psychic web is up: tap him or fire a beam",
        win: "bojack and his gang are sealed away again",
        ach: "sealed",
    },
];

/// The universe ladder: (number, name, colour, its three fighters).
pub const LADDER: [(u32, &str, u32, [&str; 3]); 7] = [
    (9, "universe 9", 0xc84a4a, ["bergamo", "lavender", "basil"]),
    (10, "universe 10", 0x58b848, ["obuni", "murichim", "rubalt"]),
    (4, "universe 4", 0x8a6ad0, ["ganos", "caway", "dercori"]),
    (3, "universe 3", 0x9aa6b8, ["anilaza", "paparoni", "koitsukai"]),
    (2, "universe 2", 0xf08ac0, ["ribrianne", "rozie", "kakunsa"]),
    (6, "universe 6", 0x48d0a8, ["kefla", "caulifla", "kale"]),
    (11, "universe 11", 0xe0473e, ["dyspo", "toppo", "jiren"]),
];
pub const UNI_HP: f64 = 6e14;
pub const UNI_STEP: f64 = 20.0;
pub const UNI_STAGES: [f64; 3] = [0.2, 0.45, 1.0];

/// Each tournament fighter's takes (idle, two attacking, powered up); jiren has one.
pub fn fighter_takes(name: &str) -> Vec<Dim> {
    let one = |d: Dim| vec![d; 4];
    match name {
        "bergamo" => vec![dim(32, 42), dim(32, 42), dim(32, 42), dim(36, 46)],
        "lavender" | "kakunsa" | "kefla" | "caulifla" | "obuni" | "dercori" => one(dim(30, 38)),
        "basil" => one(dim(30, 40)),
        "murichim" => one(dim(34, 42)),
        "rubalt" => one(dim(32, 40)),
        "ganos" => one(dim(40, 48)),
        "caway" | "paparoni" | "rozie" => one(dim(28, 38)),
        "anilaza" => one(dim(48, 56)),
        "koitsukai" => one(dim(26, 30)),
        "ribrianne" => one(dim(38, 42)),
        "kale" => one(dim(38, 44)),
        "dyspo" => one(dim(24, 32)),
        "toppo" => one(dim(36, 42)),
        "jiren" => vec![dim(28, 36)],
        _ => unreachable!("no fighter {name}"),
    }
}

pub const POWER_UP: [(&str, &str); 20] = [
    ("bergamo", "bergamo soaked up every hit — he's grown huge!"),
    ("lavender", "lavender goes blind with rage and lunges!"),
    ("basil", "basil powers up: bulkier, pink fur, a red aura!"),
    ("obuni", "obuni shouts and fires a blue ki blast!"),
    ("murichim", "murichim's eyes glow — an orange aura!"),
    ("rubalt", "rubalt winds up a gold-aura punch!"),
    ("ganos", "ganos sheds his vest: max power!"),
    ("caway", "caway throws up both hands — energy bolts!"),
    ("dercori", "the lights go out — dercori looms in the dark!"),
    ("anilaza", "anilaza gathers a destruction burst!"),
    ("paparoni", "paparoni cackles and waves his cane!"),
    ("koitsukai", "koitsukai's eye turns red!"),
    ("ribrianne", "super ribrianne! butterfly wings and a love blast!"),
    ("rozie", "rozie throws up both arms — love hearts everywhere!"),
    ("kakunsa", "kakunsa rears up on her hind legs!"),
    ("kefla", "kefla goes super saiyan 2!"),
    ("caulifla", "caulifla charges a crush cannon!"),
    ("kale", "kale lunges to grab you!"),
    ("dyspo", "dyspo hits super maximum light speed mode!"),
    ("toppo", "toppo unleashes hakai!"),
];

pub const PUNS: [&str; 6] = [
    "why did the saiyan bring a ladder? to reach the next level!",
    "what's a namekian's favourite drink? green tea!",
    "what do you call a villain with no heat? frieza!",
    "why was the cricket so good at training? he always hopped to it!",
    "how does vegeta stay so sharp? he's always on point!",
    "what do saiyans eat at the beach? sand-wiches — then the whole buffet!",
];

/// Wish rarity: how often each makes the dragon's three (`TIERS`), in `RANK` order.
#[derive(Clone, Copy, Debug, PartialEq, Eq, PartialOrd, Ord)]
pub enum Tier {
    Common,
    Rare,
    Epic,
    Legendary,
}

/// The seeds wish: this many ki seeds, however strong you are.
pub const WISH_SEEDS: f64 = 5.0;

impl Tier {
    pub fn odds(self) -> f64 {
        match self {
            Tier::Common => 1.0,
            Tier::Rare => 0.5,
            Tier::Epic => 0.25,
            Tier::Legendary => 0.08,
        }
    }
}

/// The dragon's wishes in `WISHES` order (krillin last: he's offered on top of the three while he's dead).
pub const WISHES: [(&str, Tier); 23] = [
    ("power", Tier::Epic),
    ("form", Tier::Rare),
    ("seeds", Tier::Rare),
    ("bigape", Tier::Rare),
    ("fortune", Tier::Common),
    ("skills", Tier::Legendary),
    ("gear", Tier::Epic),
    ("fly", Tier::Rare),
    ("fast", Tier::Common),
    ("taps", Tier::Common),
    ("idle", Tier::Rare),
    ("laps", Tier::Common),
    ("crit", Tier::Rare),
    ("combo", Tier::Common),
    ("senzu", Tier::Common),
    ("fuse", Tier::Rare),
    ("kaio", Tier::Rare),
    ("bubbles", Tier::Common),
    ("trip", Tier::Common),
    ("radar", Tier::Common),
    ("again", Tier::Epic),
    ("satan", Tier::Common),
    ("krillin", Tier::Common),
];
pub const KRILLIN_WISH: usize = 22;

/// Achievements for reaching the late forms.
pub const LATE_ACH: [(&str, &str); 5] = [
    ("mastered ultra instinct", "f_mui"),
    ("super saiyan blue evolved", "f_ssbe"),
    ("beast", "f_beast"),
    ("true ultra ego", "f_tue"),
    ("super saiyan rage", "f_rage"),
];
/// `ACH`: every achievement, in game.js order: (id, name, what earns it).
pub const ACH: [(&str, &str, &str); 87] = [
    ("lap1", "first steps", "run a lap of the planet"),
    ("laps100", "marathon", "run 100 laps"),
    ("ss", "super saiyan", "reach super saiyan"),
    ("ui", "ultra instinct", "reach ultra instinct"),
    ("o9k", "it's over 9000", "pass 9,000 power"),
    ("villains10", "villain slayer", "beat 10 villains"),
    ("frieza", "emperor down", "beat frieza"),
    ("cell", "perfect no more", "beat cell"),
    ("beerus", "god of destruction", "beat beerus"),
    ("all4", "clean sweep", "beat frieza, cell, kid buu and beerus"),
    ("ginyu", "ginyu force", "defeat the ginyu force"),
    ("fleet", "frieza's fleet", "drop every soldier from frieza's ship"),
    ("greg5", "faster than gregory", "win 5 gregory races · learn the spirit bomb"),
    ("yamcha", "yamcha!", "help yamcha out of his crater"),
    ("stars25", "pod catcher", "catch 25 space pods"),
    ("storm20", "meteor buster", "bust 20 meteors in one storm"),
    ("spirit", "spirit bomb", "throw a spirit bomb"),
    ("struggle", "beam struggle", "win a beam struggle"),
    ("ape", "great ape", "look at the full moon"),
    ("fusion", "fusion ha!", "fuse with bubbles"),
    ("dance", "fu · sion · ha!", "do the fusion dance"),
    ("kaioken", "kaioken", "use the kaioken"),
    ("shenron", "eternal dragon", "summon shenron"),
    ("porunga", "namekian dragon", "summon porunga"),
    ("chamber", "a year in a day", "enter the time chamber"),
    ("tournament", "tournament of power", "finish a tournament"),
    ("ascend", "ascended", "ascend for the first time"),
    ("vegeta", "homeworld", "visit planet vegeta"),
    ("nappa", "bald and beaten", "beat nappa on planet vegeta"),
    ("snakeway", "one million kilometres", "run all of snake way"),
    ("hfil", "home for infinite losers", "send a lost soul back to HFIL"),
    ("pudding", "pudding diplomacy", "calm beerus with pudding"),
    ("androids", "seventeen and eighteen", "beat androids 17 and 18"),
    ("wallet", "krillin's wallet", "take krillin's wallet while 18 visits"),
    ("gero", "not my power", "make dr. gero let go"),
    ("birds", "gentle giant", "free one of 16's birds"),
    ("westcity", "capsule corp", "open a gadget capsule in west city"),
    ("sagas", "the whole story", "clear all 8 sagas"),
    ("satan", "the champ", "take mr. satan's prize money"),
    ("roshi", "max power", "watch roshi go max power"),
    ("krillin", "you monster", "watch krillin die (again)"),
    ("coolerdown", "cooler down", "beat cooler and his armoured squadron"),
    ("unwarped", "janemba unwarped", "beat janemba, double and all"),
    ("sealed", "bojack sealed", "beat bojack and his gang"),
    ("mui", "beyond instinct", "reach your hero's first form past ultra instinct"),
    ("universe", "universe star", "clear a universe"),
    ("multiverse", "last one standing", "clear universe 11 in the tournament of power"),
    ("mastery", "beyond the forms", "earn a mastery star"),
    ("godki", "god ki", "reset for god ki"),
    ("zeno", "zeno's friend", "push the zeno button"),
    ("limit1", "limit breaker", "break your first limit"),
    ("limit5", "the grand priest takes notice", "break 5 limits"),
    ("lbform", "beyond your limits", "transform into a limit breaker"),
    ("googol", "a googol", "pass 1e100 power"),
    ("infinity", "past infinity", "pass 1.8e308 power"),
    ("applause", "zeno claps", "pass 1e1000 power"),
    ("u10", "obuni goes quiet", "clear universe 10"),
    ("u4", "now you see me", "clear universe 4"),
    ("u3", "anilaza unplugged", "clear universe 3"),
    ("u2", "love lost", "clear universe 2"),
    ("u6", "kefla, split", "clear universe 6"),
    ("inf1", "to infinity", "clear universe ∞"),
    ("inf5", "off the edge of the multiverse", "clear universe ∞ 5"),
    ("inf10", "the grand priest is impressed", "clear universe ∞ 10"),
    ("whis", "whis's homework", "learn a rule from the angels"),
    ("f_mui", "the body moves on its own", "reach mastered ultra instinct"),
    ("f_ssbe", "blue, evolved", "reach super saiyan blue evolved"),
    ("f_beast", "the beast awakens", "reach beast"),
    ("f_tue", "pride of the saiyans", "reach true ultra ego"),
    ("f_rage", "rage of the future", "reach super saiyan rage"),
    ("giantape", "oozaru rampage", "go giant great ape"),
    ("tail10", "tail of steel", "train your tail to lv 10"),
    ("tail25", "king of the apes", "train your tail to lv 25"),
    ("tail50", "golden great ape", "train your tail to lv 50"),
    ("flight", "bukujutsu", "wish for the power of flight"),
    ("flash", "final flash!", "fire a fully charged beam at beam lv 5"),
    ("movies3", "triple feature", "beat cooler, janemba and bojack"),
    ("namek", "namekian holiday", "visit namek"),
    ("kame", "turtle school", "visit kame house"),
    ("paozu", "dinosaur country", "visit mount paozu"),
    ("future", "hope of the future", "visit trunks' future"),
    ("lookout", "mr. popo's tiles", "visit kami's lookout"),
    ("kaiworld", "sacred world of the kais", "visit the supreme kai's world"),
    ("yardrat", "instant transmission", "visit yardrat"),
    ("itx", "we have to go… instantly", "jump to another world with instant transmission"),
    ("streak", "golden hop", "hit a ×3 orb streak on snake way"),
    ("souls10", "ghost buster", "send 10 lost souls back to HFIL"),
];

/// What opens a hero: nothing, an achievement, or beating a saga villain (a story beat).
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum Need {
    Open,
    Ach(&'static str),
    Beat(&'static str),
}

/// `CHARS`: the heroes you can play and what unlocks each: (id, name, need). game.js has the first four.
pub const CHARS: [(Hero, &str, &str, Need); 9] = [
    (Hero::Vegeta, "vegeta", "vegeta", Need::Open),
    (Hero::Goku, "goku", "goku", Need::Ach("ss")),
    (Hero::Gohan, "gohan", "gohan", Need::Ach("cell")),
    (Hero::Trunks, "trunks", "future trunks", Need::Ach("frieza")),
    (Hero::Krillin, "krillin", "krillin", Need::Open),
    (Hero::Piccolo, "piccolo", "piccolo", Need::Beat("raditz")),
    (Hero::A17, "a17", "android 17", Need::Ach("androids")),
    (Hero::Tien, "tien", "tien", Need::Ach("yamcha")),
    (Hero::Goten, "goten", "goten", Need::Beat("kid buu")),
];

/// Each hero's beam as the game names it: (the beam, its full-power form at beam lv 5).
pub fn hero_beam(h: Hero) -> (&'static str, &'static str) {
    match h {
        Hero::Vegeta => ("galick gun", "final flash"),
        Hero::Goku | Hero::Gohan | Hero::Krillin | Hero::Goten => ("kamehameha", "super kamehameha"),
        Hero::Trunks => ("burning attack", "heat dome attack"),
        Hero::Piccolo => ("special beam cannon", "full-power special beam cannon"),
        Hero::A17 => ("power blitz", "full-power blitz"),
        Hero::Tien => ("kikoho", "full-power kikoho"),
    }
}

/// Each hero's boost (the kaioken upgrade's red button) and blast (the big bang's double-tap), as the game names them.
pub fn hero_moves(h: Hero) -> (&'static str, &'static str) {
    match h {
        Hero::Vegeta => ("majin power", "big bang attack"),
        Hero::Goku => ("kaioken", "dragon fist"),
        Hero::Gohan => ("potential unleashed", "masenko"),
        Hero::Trunks => ("burning rage", "finish buster"),
        // "max power" is his giant mode and "weights off" piccolo's first form
        Hero::Krillin => ("full power", "scattering bullet"),
        Hero::Piccolo => ("cape off", "hellzone grenade"),
        Hero::A17 => ("infinite energy", "barrier burst"),
        Hero::Tien => ("kiai", "dodon ray"),
        Hero::Goten => ("tantrum", "jan ken"),
    }
}

/// A hero's boost as the button and his aura show it: the button's short label, fill, pale fill while recharging and
/// ink; the colour his sprite is washed toward, the rim (pulse up, down), the flames (tip to base) and their embers;
/// the sparks (white, light, deep); and the beam and blast while it's on (ball, glow, mid, edge).
#[derive(Clone, Copy, Debug, Default, PartialEq)]
pub struct Boost {
    pub short: &'static str,
    pub fill: u32,
    pub pale: u32,
    pub ink: u32,
    pub wash: u32,
    pub rim: [u32; 2],
    pub flame: [u32; 3],
    pub ember: u32,
    pub spark: [u32; 3],
    pub ball: u32,
    pub glow: u32,
    pub mid: u32,
    pub edge: u32,
}

/// The kaioken's red.
const RED: Boost = Boost {
    short: "kaioken",
    fill: 0xe0332b,
    pale: 0xf1b9b4,
    ink: 0xffffff,
    wash: 0xff0000,
    rim: [0xff4a3a, 0xe0332b],
    flame: [0xffd0c0, 0xff8a6a, 0xff4a3a],
    ember: 0xb0201a,
    spark: [0xffffff, 0xff9a8a, 0xe0332b],
    ball: 0xffb0a4,
    glow: 0xff6a5a,
    mid: 0xffc8bf,
    edge: 0xc8201a,
};
/// The plain white aura, rimmed in a cool grey so it reads on the pale worlds.
const WHITE: Boost = Boost {
    short: "",
    fill: 0xe6eaf0,
    pale: 0xf2f4f7,
    ink: 0x2a2f3a,
    wash: 0xffffff,
    rim: [0xffffff, 0xc8d4e2],
    flame: [0xffffff, 0xeef4ff, 0xc8d8ea],
    ember: 0x8a9ab0,
    spark: [0xffffff, 0xeef4ff, 0xb0c0d4],
    ball: 0xf4f8ff,
    glow: 0xdce8f6,
    mid: 0xffffff,
    edge: 0xa0b4cc,
};
/// Super saiyan gold.
const GOLD: Boost = Boost {
    short: "",
    fill: 0xf5c518,
    pale: 0xf8e3a0,
    ink: 0x3a2a00,
    wash: 0xffd000,
    rim: [0xffe04a, 0xf0b820],
    flame: [0xfff4c0, 0xffe070, 0xf0c030],
    ember: 0xc08a10,
    spark: [0xffffff, 0xfff0a0, 0xe8b020],
    ball: 0xfff0a8,
    glow: 0xffd850,
    mid: 0xfff6c8,
    edge: 0xd09a10,
};
/// Super saiyan rage's electric blue.
const BLUE: Boost = Boost {
    short: "",
    fill: 0x2a5cf0,
    pale: 0xbccbf8,
    ink: 0xffffff,
    wash: 0x2a8aff,
    rim: [0x4ac8ff, 0x1a7ae8],
    flame: [0xd0f4ff, 0x7ad8ff, 0x3aa8ff],
    ember: 0x1a5ac0,
    spark: [0xffffff, 0x9ae0ff, 0x2a8ae8],
    ball: 0xb0e8ff,
    glow: 0x5ac0ff,
    mid: 0xd0f0ff,
    edge: 0x1a6ad8,
};
/// Android 17's barrier green.
const GREEN: Boost = Boost {
    short: "",
    fill: 0x1fa855,
    pale: 0xb4e4c4,
    ink: 0xffffff,
    wash: 0x20d060,
    rim: [0x4ae87a, 0x22b850],
    flame: [0xd0ffe0, 0x7af0a0, 0x3ad86a],
    ember: 0x1a8a40,
    spark: [0xffffff, 0xa0f4c0, 0x22b850],
    ball: 0xb8ffd0,
    glow: 0x5ae890,
    mid: 0xd4ffe2,
    edge: 0x1a9a48,
};

/// Each hero's boost look: canon colours where the show has one, his plain aura otherwise.
pub fn hero_boost(h: Hero) -> Boost {
    match h {
        Hero::Vegeta => Boost { short: "majin", ..GOLD },
        Hero::Goku => RED,
        Hero::Gohan => Boost { short: "unleash", ..WHITE },
        Hero::Trunks => Boost { short: "rage", ..BLUE },
        Hero::Krillin => Boost { short: "power", ..WHITE },
        Hero::Piccolo => Boost { short: "cape off", ..WHITE },
        Hero::A17 => Boost { short: "infinite", ..GREEN },
        Hero::Tien => Boost { short: "kiai", ..WHITE },
        Hero::Goten => Boost { short: "tantrum", ..GOLD },
    }
}

/// Each hero's playstyle in one line, as the settings panel's hero row shows it.
pub fn hero_style(h: Hero) -> &'static str {
    match h {
        Hero::Vegeta => "the classic: tap to train, hold to charge the galick gun",
        Hero::Goku | Hero::Gohan => "the classic rules, with the kamehameha",
        Hero::Trunks => "the classic rules, with the burning attack",
        Hero::Krillin => "taps throw destructo discs that cut saibamen, meteors and orbs",
        Hero::Piccolo => "meditates: idle builds focus, taps and his beam spend it",
        Hero::Goten => "born super saiyan: forms come early but don't hold; taps cheer him back up",
        Hero::Tien | Hero::A17 => "the classic rules, with forms of his own",
    }
}

/// The angels' rules as the menu shows them, in `ANGELS` order: (name, what).
pub const ANGEL_TEXT: [(&str, &str); 8] = [
    ("divine seeds", "ki seeds grow with power^0.55, not its square root"),
    ("born golden", "every ascension starts at super saiyan"),
    ("whis' staff", "whis' training is always on at beerus' planet"),
    ("self-ascension", "ascends on its own at the power you pick"),
    ("vados' notes", "ascending keeps a tenth of every upgrade"),
    ("time skip", "universe fights last 45s, not 30"),
    ("twin stars", "universe stars count double"),
    ("grand priest's nod", "every god ki reset pays double"),
];
