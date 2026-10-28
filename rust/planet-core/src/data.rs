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
}

impl Upg {
    pub const ALL: [Upg; 14] = [
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
pub const SHOP: [ShopItem; 14] = [
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
    ShopItem { key: "tail", base: 40000.0, k: 2.5, label: "tail training", what: "great ape: +8% size, +2s, +×0.25 (less past lv 10)" },
];

/// Producer milestones: these levels double output, then every 50 past 100.
pub const MILES: [Upg; 4] = [Upg::Boots, Upg::Partner, Upg::House, Upg::Piccolo];
pub const MS: [u32; 4] = [10, 25, 50, 100];

#[derive(Clone, Debug)]
pub struct Form {
    pub name: &'static str,
    pub at: f64,
    pub x: f64,
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
const LATE_X: [f64; 2] = [24.0, 40.0];

#[derive(Clone, Copy, Debug, PartialEq, Eq, Default)]
pub enum Hero {
    #[default]
    Vegeta,
    Goku,
    Gohan,
    Trunks,
}

/// `ladderOf`: the shared nine, then the hero's late forms at 2e14, ×1000 each.
pub fn ladder_of(h: Hero) -> Vec<Form> {
    let late: &[usize] = match h {
        Hero::Vegeta => &[10, 12],
        Hero::Goku => &[9],
        Hero::Gohan => &[11],
        Hero::Trunks => &[13],
    };
    let mut v: Vec<Form> = ALL_FORMS[..9].iter().map(|&(name, at, x)| Form { name, at, x }).collect();
    for (j, &i) in late.iter().enumerate() {
        v.push(Form { name: ALL_FORMS[i].0, at: 2e14 * crate::jsmath::pow(LATE_STEP, j as f64), x: LATE_X[j] });
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
pub const CEIL_T: f64 = 1.08;
pub const CEIL_STEP: f64 = 2.0;
pub const CEIL_EXP: f64 = 0.15;
pub const STAR_X: f64 = 1.5;
pub const GOD_X: f64 = 1.0;
pub const MASTERY_X: f64 = 1.25;
pub const ZENO_X: f64 = 1000.0;
pub const ZENO_GODS: u32 = 2;
/// game.js laps at 6.283, a hair short of 2π; kept so lap timing matches
#[allow(clippy::approx_constant)]
pub const LAP: f64 = 6.283;
/// Cosmetic particles game.js draws from Math.random at these moments; planet-core burns the same draws.
pub const RNG_TRANSFORM: u32 = 180;
pub const RNG_CRIT: u32 = 20;
pub const RNG_KAIOKEN: u32 = 80;

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
pub const TRIPS: [u32; 11] = [1, 2, 3, 4, 5, 6, 7, 8, 10, 11, 12];
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
