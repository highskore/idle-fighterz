//! What the HTML HUD reads, as data: the per-frame snapshot game.js hands `ui.update`, the shop rows it hands
//! `ui.shop`, the dragon's offer for `ui.wish`, the one-shot cues (`ui.sfx`, `ui.fx`, ...), and the menus page.html asks
//! the game for (`menu()`, `angels()`, the confirm boxes' info, the share card). Every builder returns JSON in the
//! shape game.js returns its object in, so the page's code reads it unchanged. See rust/HUD.md.

use crate::data::*;
use crate::game::{Game, WishBuff};
use crate::json::{self, arr, num, Obj};
use crate::num::{fmt_short, js_round, to_fixed};
use crate::timeline::{uni_name, Phase};

/// A one-shot UI call game.js makes besides `ui.event`: a sound, a title effect, the tap bump.
#[derive(Clone, Debug, PartialEq)]
pub enum Cue {
    /// `ui.sfx(kind)`
    Sfx(&'static str),
    /// `ui.fx(kind)`
    Fx(&'static str),
    /// `ui.fx('form', i)`
    Form(usize),
    /// `ui.bump()`: the power number pops on a tap
    Bump,
    /// `ui.achieved()`: an achievement landed (the page recounts them)
    Achieved,
    /// `ui.zeno()`: zeno was tapped; the page asks about his button
    Zeno,
    /// `ui.treeGift(text)`
    TreeGift(String),
    /// `ui.wishDone()`: the dragon chose (or left) without the player; the page closes the wish box
    WishDone,
    /// `ui.itxPick(worlds, jump)`: instant transmission's picker, `[{key, label}, ...]` (the page calls back `itx_jump`)
    ItxPick(String),
    /// `ui.notify(kind, arg)`: the widget's desktop notifications (a pod, a trip, a raid, the dragon); the site has none
    Notify(&'static str, String),
}

impl Cue {
    /// `[call, arg?]`: the `ui` method to call and its argument.
    pub fn to_json(&self) -> String {
        match self {
            Cue::Sfx(k) => arr(["\"sfx\"".into(), json::str(k)]),
            Cue::Fx(k) => arr(["\"fx\"".into(), json::str(k)]),
            Cue::Form(i) => arr(["\"fx\"".into(), "\"form\"".into(), num(*i as f64)]),
            Cue::Bump => "[\"bump\"]".into(),
            Cue::Achieved => "[\"achieved\"]".into(),
            Cue::Zeno => "[\"zeno\"]".into(),
            Cue::TreeGift(s) => arr(["\"treeGift\"".into(), json::str(s)]),
            Cue::WishDone => "[\"wishDone\"]".into(),
            Cue::ItxPick(l) => arr(["\"itxPick\"".into(), l.clone()]),
            Cue::Notify(k, a) => arr(["\"notify\"".into(), json::str(k), json::str(a)]),
        }
    }
}

/// The HUD snapshot: what `ui.update` gets, plus the night (`ui.night`) and the world (`ui.world`). Values are what the
/// page shows, so the snapshot only changes when the HUD would: `time` in whole seconds, timers in whole seconds.
#[derive(Clone, Debug, PartialEq, Default)]
pub struct Hud {
    pub goal_text: &'static str,
    pub goal_p: f64,
    pub goal_n: f64,
    pub kaio_own: bool,
    pub kaio_ready: bool,
    pub kaio_left: f64,
    pub itx_own: bool,
    pub itx_ready: bool,
    pub itx_left: f64,
    pub pl: f64,
    pub best: f64,
    pub rate: f64,
    pub laps: u32,
    /// the session clock, floored to the second the HUD shows
    pub time: f64,
    pub effects: String,
    pub extra: String,
    pub combo: f64,
    pub form_name: &'static str,
    pub form_x: f64,
    pub form_next: String,
    pub form_p: f64,
    pub balls: u32,
    pub wishes: u32,
    pub ascend: String,
    pub snake: bool,
    pub busy: bool,
    pub night: bool,
    pub world: u32,
    /// the dragon is up (game.js puts `shen` on the body)
    pub shen: bool,
    /// a movie that recolours the world: "jelly", "earth" or "" (game.js's body classes)
    pub look: &'static str,
}

impl Hud {
    /// `ui.update`'s argument, with `night` and `world` alongside.
    pub fn to_json(&self) -> String {
        Obj::new()
            .raw("goal", Obj::new().str("text", self.goal_text).num("p", self.goal_p).num("n", self.goal_n).end())
            .raw("kaio", Obj::new().bool("own", self.kaio_own).bool("ready", self.kaio_ready).num("left", self.kaio_left).end())
            .raw("itx", Obj::new().bool("own", self.itx_own).bool("ready", self.itx_ready).num("left", self.itx_left).end())
            .num("pl", self.pl)
            .num("best", self.best)
            .num("rate", self.rate)
            .num("laps", self.laps as f64)
            .num("time", self.time)
            .str("effects", &self.effects)
            .str("extra", &self.extra)
            .num("combo", self.combo)
            .raw("form", Obj::new().str("name", self.form_name).num("x", self.form_x).str("next", &self.form_next).num("p", self.form_p).end())
            .num("balls", self.balls as f64)
            .num("wishes", self.wishes as f64)
            .str("ascend", &self.ascend)
            .bool("snake", self.snake)
            .bool("busy", self.busy)
            .bool("night", self.night)
            .num("world", self.world as f64)
            .bool("shen", self.shen)
            .str("look", self.look)
            .end()
    }
}

/// One shop row (`syncShop`): a key and what its button shows.
#[derive(Clone, Debug, PartialEq)]
pub struct ShopRow {
    pub key: &'static str,
    pub cost: f64,
    pub level: f64,
    pub label: &'static str,
    pub what: String,
    pub can: bool,
    pub open: bool,
    pub special: bool,
}

/// game.js `SHOP` key order (the shop's buttons, top to bottom).
pub const SHOP_ORDER: [&str; 18] = [
    "boots", "partner", "gravity", "itx", "cloud", "scouter", "galick", "senzu", "house", "armor", "tail", "kaio", "bigbang", "piccolo", "chamber", "ascend",
    "godki", "zeno",
];

/// Shenron's wishes as the wish box shows them, in `WISHES` order: (label, what), with `{}` filled at offer time.
const WISH_TEXT: [(&str, &str); 23] = [
    ("eternal power", "×1.25 to everything, forever, even after ascending"),
    ("", ""),
    ("the seeds of power", ""),
    ("a bigger great ape", "the next full moon makes a giant: bigger, +15s, +×1, and every tap stomps"),
    ("a fortune in power", "+10 minutes of income"),
    ("ki talent mastery", "+1 rank to every ki talent you've learned (training tree)"),
    ("capsule corp delivery", "+1 level to every shop upgrade you own"),
    ("the power of flight", "fly your laps for 30s: laps ×1.8"),
    ("flying nimbus legs", "run 50% faster for 3 minutes"),
    ("golden fists", "taps ×3 for 3 minutes"),
    ("a hundred clones", "idle income ×3 for 3 minutes"),
    ("road of the gods", "laps pay ×3 for 3 minutes"),
    ("scouter-proof", "every tap crits for 1 minute"),
    ("perfect rhythm", "max combo for 2 minutes"),
    ("a bag of senzu", "senzu ×1.5 for 2 minutes"),
    ("fusion ha!", "fuse with bubbles right now: ×2 for 30s"),
    ("king kai's blessing", ""),
    ("a bigger monkey", "bubbles +5 levels"),
    ("a space pod", "fly to the next world as soon as the dragon leaves"),
    ("dragon radar", "+3 dragon balls toward the next summon"),
    ("one more wish", "the dragon grants an extra wish"),
    ("mr. satan's autograph", "\"the world champion's signature!\" (a little power)"),
    ("bring krillin back", ""),
];

const BUFF_NAMES: [(WishBuff, &str); 7] = [
    (WishBuff::Fly, "flight laps ×1.8"),
    (WishBuff::Fast, "nimbus legs"),
    (WishBuff::Taps, "golden fists ×3"),
    (WishBuff::Idle, "clones ×3 idle"),
    (WishBuff::Laps, "laps ×3"),
    (WishBuff::Crit, "all crits"),
    (WishBuff::Combo, "max combo"),
];

pub fn tier_name(t: Tier) -> &'static str {
    match t {
        Tier::Common => "common",
        Tier::Rare => "rare",
        Tier::Epic => "epic",
        Tier::Legendary => "legendary",
    }
}

fn branch_name(b: Branch) -> &'static str {
    match b {
        Branch::Body => "body",
        Branch::Spirit => "spirit",
        Branch::Fate => "fate",
    }
}

/// game.js's `WORLDS[w].name`
pub const WORLD_FULL: [&str; 13] = [
    "king kai's planet",
    "namek",
    "planet vegeta",
    "snake way",
    "beerus' planet",
    "west city",
    "kame house",
    "mount paozu",
    "the future",
    "tournament of power",
    "kami's lookout",
    "the supreme kai's world",
    "yardrat",
];

/// `uniBadge(u)`: U9 … U11, then U-INF, U-INF 2, …
pub fn uni_badge(u: usize) -> String {
    let n = LADDER.len();
    if u < n {
        format!("U{}", LADDER[u].0)
    } else if u > n {
        format!("U-INF {}", u - n + 1)
    } else {
        "U-INF".into()
    }
}

fn ceil(x: f64) -> f64 {
    x.ceil()
}

impl Game {
    pub(crate) fn cue(&mut self, c: Cue) {
        self.cues.push(c);
    }

    /// `kame()`: goku and gohan fire a kamehameha, the others a galick gun.
    pub fn kame(&self) -> bool {
        matches!(self.s.hero, Hero::Goku | Hero::Gohan)
    }

    /// The buffs line under the power (`fxs.join(' · ')`).
    pub fn effects(&self) -> String {
        let t = self.t;
        let (b, tl) = (&self.b, &self.tl);
        let mut fx: Vec<String> = Vec::new();
        let secs = |until: f64| num(ceil(until - t));
        if self.s.world != 0 && self.s.world != 9 {
            let left = 0f64.max(tl.namek_until - t);
            let wn = WORLD_NAMES[self.s.world as usize];
            if let Some(bz) = &tl.bz {
                fx.push(if bz.awake != 0.0 { "beerus AWAKE ×0.25 — find pudding".into() } else { format!("noise {}%", num(js_round(bz.noise * 100.0))) });
            }
            fx.push(match &tl.snk {
                Some(s) if self.s.world == 3 => format!("{wn} {}%", num((s.p * 100.0).floor())),
                _ if left > 60.0 => format!("{wn} {}m", num(ceil(left / 60.0))),
                _ => format!("{wn} {}s", num(ceil(left))),
            });
        }
        if let Some(s) = tl.storm.as_ref().filter(|s| t < s.until) {
            fx.push(format!("meteor storm {}s", secs(s.until)));
        }
        if let Some(s) = &tl.struggle {
            fx.push(format!("struggle {}s", secs(s.until)));
        }
        if let Some(bo) = tl.boss.as_ref().filter(|bo| bo.uni && !bo.dead) {
            fx.push(format!("{} {}s", bo.tag, secs(bo.until)));
        }
        if let Some(g) = &tl.greg {
            fx.push(format!("gregory {}s", secs(g.until)));
        }
        if b.chamber_until > t {
            fx.push(format!("time chamber ×{} {}s", num(self.chamber_x()), secs(b.chamber_until)));
        }
        if b.laugh_until > t {
            fx.push(format!("laughing ×1.25 {}s", secs(b.laugh_until)));
        }
        if let Some(g) = tl.ginyu.as_ref().filter(|g| g.done == 0.0) {
            fx.push(format!("ginyu force {}s", secs(g.until)));
        }
        if let Some(m) = &tl.movie {
            let s = if m.over != 0.0 {
                String::new()
            } else if let Some((_, t1)) = m.nova {
                format!("supernova {}s", num(0f64.max(ceil(t1 - t))))
            } else if m.web.is_some() {
                "psychic web — tap bujin".into()
            } else if m.flip_until > t {
                format!("mirrored {}s", secs(m.flip_until))
            } else {
                let left = m.minions.iter().filter(|h| !h.dead && !h.twin).count();
                let until = tl.boss.as_ref().filter(|bo| bo.id == m.boss).map_or(0.0, |bo| bo.until);
                if left > 0 {
                    format!("{left} to go before {}", m.o.who)
                } else {
                    format!("{} {}s", m.o.who, secs(until))
                }
            };
            if !s.is_empty() {
                fx.push(s);
            }
        }
        if b.fuse_until > t {
            fx.push(format!("fusion ×2 {}s", secs(b.fuse_until)));
        }
        if b.whis_until > t {
            fx.push(format!("whis' training: laps ×2, taps ×2 noise {}s", secs(b.whis_until)));
        }
        if b.chi_until > t {
            fx.push(format!("chi-chi ×1.5 {}s", secs(b.chi_until)));
        }
        for (k, name) in BUFF_NAMES {
            if self.wished(k) {
                fx.push(format!("{name} {}s", secs(self.wish_buff[k as usize])));
            }
        }
        if let Some((_, until)) = tl.preview {
            fx.push(format!("{} (wish) {}s", self.forms[self.s.form].name, secs(until)));
        }
        if b.daily_until > t {
            fx.push(format!("daily ×1.25 {}m", num(ceil((b.daily_until - t) / 60.0))));
        }
        if let Some(tr) = &tl.tour {
            fx.push(format!("tournament {}s · {} KO", secs(tr.until), tr.ko));
        }
        if b.kaio_until > t {
            fx.push(format!("kaioken ×{} {}s", num(self.kaio_x()), secs(b.kaio_until)));
        } else if b.tired_until > t {
            fx.push(format!("tired ×0.75 {}s", secs(b.tired_until)));
        }
        if b.boost_until > t {
            fx.push(format!("boost ×2 {}s", secs(b.boost_until)));
        }
        if b.senzu_until > t {
            fx.push(format!("senzu ×1.5 {}s", secs(b.senzu_until)));
        }
        if self.riding > 0.0 {
            fx.push("nimbus ×1.5".into());
        }
        if b.car_until > t {
            fx.push(format!("king kai's car ×1.5 {}s", secs(b.car_until)));
        }
        if b.ape_until > t {
            fx.push(format!("{} ×{} {}s", if tl.ape.giant { "giant ape" } else { "great ape" }, num(1.0 + self.ape_x()), secs(b.ape_until)));
        }
        fx.join(" · ")
    }

    /// The run's standing under the buffs (`extra`).
    pub fn extra(&self) -> String {
        let s = &self.s;
        let f = &self.forms[s.form];
        let stars = s.ustars as f64 * if self.ang(A_STARS) { 2.0 } else { 1.0 };
        let parts = [
            if s.form > 0 {
                format!("{} ×{}", f.name, num(f.x))
            } else if s.pl > 2000.0 {
                "next form at 20K".into()
            } else {
                String::new()
            },
            if s.orbs7 > 0 || s.granted > 0 { format!("dragon balls {}/7", s.orbs7) } else { String::new() },
            if s.granted > 0 { format!("wishes {}", s.granted) } else { String::new() },
            if s.multi { format!("{} · fight {}/{}", uni_name(s.uni as usize), s.uni_stage + 1, UNI_STAGES.len()) } else { String::new() },
            if (s.saga as usize) < VILLAINS.len() && (s.saga > 0 || self.session > 110.0) {
                format!("saga {}/{}", s.saga + 1, VILLAINS.len())
            } else {
                String::new()
            },
            if self.core() > self.ceiling() {
                if s.multi {
                    "ki ceiling — it rises with time; clearing universes lifts it too".into()
                } else {
                    "ki ceiling — reach ultra instinct or finish the sagas: the multiverse lifts it".into()
                }
            } else {
                String::new()
            },
            if s.ustars > 0 { format!("universe stars {} ×{}", s.ustars, fmt_short(js_round(STAR_X.powf(stars)))) } else { String::new() },
            if s.mastery > 0 { format!("mastery {}", s.mastery) } else { String::new() },
            if s.seeds != 0.0 { format!("ki seeds {}", num(s.seeds)) } else { String::new() },
            if s.ascend != 0.0 { format!("ki seeds ×{}", to_fixed(self.seed_boost(), 1)) } else { String::new() },
            if s.god_total > 0 { format!("god ki {} · ×{}", s.godki, fmt_short(Self::god_boost_of(s.god_total as f64))) } else { String::new() },
            if s.zeno > 0 { format!("zeno's favour ×{}", fmt_short(ZENO_X.powf(s.zeno as f64))) } else { String::new() },
            if s.krillin_ally { "krillin: idle ×1.5".into() } else { String::new() },
        ];
        parts.into_iter().filter(|p| !p.is_empty()).collect::<Vec<_>>().join(" · ")
    }

    /// The HUD as it stands (game.js builds it once a frame, while playing: see `Game::hud`).
    pub fn hud_now(&self) -> Hud {
        let (s, t) = (&self.s, self.t);
        let g = GOALS.iter().find(|g| g.id == s.goal).unwrap();
        let cf = &self.forms[s.form];
        let (next_name, next_at) = match self.forms.get(s.form + 1) {
            Some(nf) => (nf.name.to_string(), nf.at),
            None => (format!("mastery {}", s.mastery + 1), cf.at * LATE_STEP.powf(s.mastery as f64 + 1.0)),
        };
        let tl = &self.tl;
        Hud {
            goal_text: g.text,
            goal_p: s.goal_p.min(g.n),
            goal_n: g.n,
            kaio_own: s.lv(Upg::Kaio) > 0,
            kaio_ready: t >= self.b.kaio_ready,
            kaio_left: ceil(self.b.kaio_ready - t),
            itx_own: s.lv(Upg::Itx) > 0,
            itx_ready: self.itx_can(),
            itx_left: 0f64.max(ceil(self.tl.itx_ready - t)),
            pl: s.pl,
            best: s.best,
            rate: self.rate(),
            laps: self.laps,
            time: self.session.floor(),
            effects: self.effects(),
            extra: self.extra(),
            combo: self.combo,
            form_name: if s.form > 0 { cf.name } else { "base" },
            form_x: cf.x,
            form_next: next_name,
            form_p: 1f64.min(s.pl / next_at),
            balls: s.orbs7,
            wishes: s.granted,
            ascend: if s.ascend != 0.0 { to_fixed(self.seed_boost(), 1) } else { String::new() },
            snake: s.world == 3,
            busy: s.world == 3 || self.boss_up() || tl.ginyu.as_ref().is_some_and(|g| g.done == 0.0) || tl.moon.is_some() || tl.storm.is_some(),
            night: tl.moon.as_ref().is_some_and(|m| !m.leaving) || self.b.ape_until > t,
            world: s.world,
            shen: tl.shen.is_some(),
            look: tl.movie.as_ref().map_or("", |m| {
                if m.o.jelly {
                    "jelly"
                } else if m.o.earth {
                    "earth"
                } else {
                    ""
                }
            }),
        }
    }

    /// The HUD as game.js last handed it to `ui.update` (built at that point in the frame).
    pub fn hud(&self) -> &Hud {
        &self.hud
    }

    fn next_mile(&self, u: Upg) -> f64 {
        let l = self.s.lv(u);
        MS.iter().find(|&&n| l < n).map_or(100.0 + 50.0 * (((l as f64 - 100.0) / 50.0).floor() + 1.0), |&n| n as f64)
    }

    fn shop_what(&self, key: &str) -> String {
        let s = &self.s;
        match key {
            "ascend" => return format!("reset for +{} ki seeds", num(self.seeds_now())),
            "godki" => return format!("reset for +{} god ki", self.god_now()),
            "zeno" => return format!("erase it all: zeno's favour ×{}", fmt_short(ZENO_X.powf(s.zeno as f64 + 1.0))),
            _ => {}
        }
        let u = Upg::from_key(key).unwrap();
        let l = s.lv(u);
        let base = SHOP[u as usize].what;
        if u == Upg::Itx && l > 0 {
            let min: f64 = to_fixed(self.itx_cd() / 60.0, 1).parse().unwrap();
            return format!("jump every {} min · trips {}% sooner", num(min), num(js_round(100.0 - 100.0 * self.soon())));
        }
        if MILES.contains(&u) && l > 0 {
            return format!("{base} · ×2 at lv {}{}", num(self.next_mile(u)), if l >= 100 { " (every 50)" } else { "" });
        }
        match u {
            Upg::Chamber if l > 0 => format!("train ×{} inside · next ×{}", num(self.chamber_x()), num(1.5 + 0.5 * (s.lvf(u) + 1.0))),
            Upg::Kaio if l > 0 => format!("×{} for 15s, then ×0.75", num(self.kaio_x())),
            Upg::Bigbang if l > 0 => format!("blast radius +{}%", l * 25),
            Upg::Galick if l == 4 => format!("beams hit harder · next: {}", if self.kame() { "super kamehameha" } else { "final flash" }),
            Upg::Galick if l >= 5 => "beams hit harder · full charge ×1.25".into(),
            Upg::Galick if l > 0 => "beams hit harder".into(),
            _ => base.into(),
        }
    }

    /// `syncShop()`: the rows the shop shows, in `SHOP` order.
    pub fn shop(&self) -> Vec<ShopRow> {
        let s = &self.s;
        let mut rows = Vec::new();
        for key in SHOP_ORDER {
            let (unlock, level, cost, label) = match key {
                "ascend" => (self.ascend_unlocked(), s.ascend, self.ascend_cost(), "ascend"),
                "godki" => (s.form >= MUI_FORM && self.god_now() > 0, s.gods as f64, self.god_cost(), "god ki"),
                "zeno" => (self.zeno_ready(), s.zeno as f64, 0.0, "zeno button"),
                _ => {
                    let u = Upg::from_key(key).unwrap();
                    let label = if u == Upg::Galick && self.kame() { "kamehameha" } else { SHOP[u as usize].label };
                    (self.unlocked(u), s.lvf(u), self.cost(u), label)
                }
            };
            let held = match key {
                "ascend" => s.ascend,
                "godki" => s.godki as f64,
                "zeno" => s.zeno as f64,
                _ => level,
            };
            if !(unlock || held > 0.0 && key != "godki" && key != "zeno") {
                continue;
            }
            rows.push(ShopRow {
                key,
                cost,
                level,
                label,
                what: self.shop_what(key),
                can: s.pl >= cost && (key != "ascend" || s.best >= 1e6),
                open: key == "ascend" && self.tree_open(),
                special: matches!(key, "ascend" | "godki" | "zeno"),
            });
        }
        rows
    }

    /// `ui.shop`'s argument: `{key: {cost, level, label, what, can, open, special}}` in shop order.
    pub fn shop_json(&self) -> String {
        self.shop()
            .iter()
            .fold(Obj::new(), |o, r| {
                o.raw(
                    r.key,
                    Obj::new()
                        .num("cost", r.cost)
                        .num("level", r.level)
                        .str("label", r.label)
                        .str("what", &r.what)
                        .bool("can", r.can)
                        .bool("open", r.open)
                        .bool("special", r.special)
                        .end(),
                )
            })
            .end()
    }

    /// A wish as the box shows it: (key, label, what, tier).
    pub fn wish_text(&self, w: usize) -> (&'static str, String, String, &'static str) {
        let (key, tier) = WISHES[w];
        let (label, what) = WISH_TEXT[w];
        let (label, what) = match key {
            "form" => {
                let nf = &self.forms[(self.s.form + 1).min(self.forms.len() - 1)];
                (format!("a taste of {}", nf.name), format!("×{} for 60 seconds", num(nf.x)))
            }
            "seeds" => (label.into(), format!("+{} ki seeds, kept forever", num(3f64.max((self.seeds_now() / 5.0).ceil())))),
            "kaio" => (label.into(), format!("kaioken ×{} now, no tiredness after", num(self.kaio_x()))),
            "krillin" => (label.into(), format!("he trains with you: idle ×1.5 and destructo discs. next death: rage ×{}", 3 + self.s.krillin_revives)),
            _ => (label.into(), what.into()),
        };
        (key, label, what, tier_name(tier))
    }

    /// `ui.wish`'s list for an offer, worded as things stand.
    pub(crate) fn offer_json(&self, offer: &[usize]) -> String {
        arr(offer.iter().map(|&w| {
            let (key, label, what, tier) = self.wish_text(w);
            Obj::new().str("key", key).str("label", &label).str("what", &what).str("tier", tier).end()
        }))
    }

    /// The dragon's offer while it waits for a pick: the phase time that identifies it, and `ui.wish`'s list.
    pub fn wish_offer(&self) -> Option<(f64, String)> {
        let sh = self.tl.shen.as_ref().filter(|s| s.phase == Phase::Wish)?;
        Some((sh.phase_t, sh.offer_json.clone()))
    }

    fn branch_pts_of(&self, b: Branch) -> u32 {
        TREE.iter().enumerate().filter(|(_, n)| n.branch == b).map(|(i, _)| self.s.tree[i]).sum()
    }

    fn hero_open(&self, h: Hero) -> bool {
        CHARS.iter().find(|c| c.0 == h).is_some_and(|c| c.3.is_none_or(|need| self.s.ach.contains(need)))
    }

    /// `menu()`: the training tree, achievements and characters. An uncapped node's `max` is `null` (Infinity in JS).
    pub fn menu_json(&self) -> String {
        let s = &self.s;
        let branches =
            [Branch::Body, Branch::Spirit, Branch::Fate].map(|b| Obj::new().str("name", branch_name(b)).num("pts", self.branch_pts_of(b) as f64).end());
        let tree = TREE.iter().enumerate().map(|(i, n)| {
            let cost = Self::rank_cost(n, s.tree[i]);
            let open = self.node_open(i);
            Obj::new()
                .str("id", n.id)
                .str("branch", branch_name(n.branch))
                .num("tier", n.tier as f64)
                .num("need", TIER_NEED[n.tier] as f64)
                .bool("open", open)
                .str("name", n.name)
                .str("what", n.what)
                .num("lvl", s.tree[i] as f64)
                .raw("max", if n.max == u32::MAX { "null".into() } else { num(n.max as f64) })
                .num("cost", cost)
                .bool("can", open && s.tree[i] < n.max && s.seeds >= cost)
                .end()
        });
        let ach = ACH.iter().map(|&(id, name, text)| Obj::new().str("id", id).str("name", name).str("text", text).bool("done", s.ach.contains(id)).end());
        let chars = CHARS.iter().map(|&(h, id, name, need)| {
            let mut o = Obj::new().str("id", id).str("name", name).bool("open", self.hero_open(h));
            if let Some(need) = need {
                o = o.str("need", ACH.iter().find(|a| a.0 == need).unwrap().2);
            }
            o.bool("on", s.hero == h).end()
        });
        Obj::new()
            .num("seeds", s.seeds)
            .str("boost", &to_fixed(self.seed_boost(), 1))
            .raw("branches", arr(branches))
            .raw("tree", arr(tree))
            .bool("spent", s.tree.iter().any(|&l| l > 0))
            .raw("ach", arr(ach))
            .raw("chars", arr(chars))
            .end()
    }

    fn angel_open(&self, i: usize) -> bool {
        let a = &ANGELS[i];
        ANGELS.iter().enumerate().filter(|(j, x)| x.who == a.who && self.ang(*j)).count() >= a.tier
    }

    /// `angels()`: god ki and the angels' rules.
    pub fn angels_json(&self) -> String {
        let s = &self.s;
        let auto = if self.ang(A_AUTO) {
            if s.auto_at > 0 {
                fmt_short(AUTO_AT[s.auto_at])
            } else {
                "off".into()
            }
        } else {
            String::new()
        };
        let list = ANGELS.iter().enumerate().map(|(i, a)| {
            let (on, open) = (self.ang(i), self.angel_open(i));
            Obj::new()
                .str("id", a.id)
                .str("who", a.who)
                .num("tier", a.tier as f64)
                .num("cost", a.cost as f64)
                .str("name", ANGEL_TEXT[i].0)
                .str("what", ANGEL_TEXT[i].1)
                .bool("on", on)
                .bool("open", open)
                .num("need", a.tier as f64)
                .bool("can", !on && open && s.godki >= a.cost)
                .end()
        });
        Obj::new()
            .num("godki", s.godki as f64)
            .num("gods", s.gods as f64)
            .str("boost", &fmt_short(Self::god_boost_of(s.god_total as f64)))
            .str("auto", &auto)
            .raw("list", arr(list))
            .end()
    }

    /// `learnAngel(id)`: spends god ki on one of the angels' rules.
    pub fn learn_angel(&mut self, id: &str) {
        let Some(i) = angel_ix(id) else { return };
        if self.ang(i) || !self.angel_open(i) || self.s.godki < ANGELS[i].cost {
            return;
        }
        self.s.godki -= ANGELS[i].cost;
        self.s.angel[i] = true;
        self.ach("whis");
        self.cue(Cue::Sfx("buy"));
    }

    /// `autoNext()`: steps self-ascension's threshold (off, 1B, 1T, ...).
    pub fn auto_next(&mut self) {
        self.s.auto_at = (self.s.auto_at + 1) % AUTO_AT.len();
    }

    /// `pick(id)`: plays as another hero, if he's unlocked; the forms past ultra instinct follow him.
    pub fn pick_hero(&mut self, id: &str) -> bool {
        let Some(&(h, ..)) = CHARS.iter().find(|c| c.1 == id) else { return false };
        if !self.hero_open(h) {
            return false;
        }
        self.s.hero = h;
        self.forms = ladder_of(h);
        self.s.form = self.s.form.min(self.forms.len() - 1);
        true
    }

    /// `ascendInfo()`: what the ascend box spells out.
    pub fn ascend_info_json(&self) -> String {
        let g = self.seeds_now();
        Obj::new()
            .bool("ok", self.s.pl >= self.ascend_cost() && self.s.best >= 1e6)
            .str("pl", &fmt_short(self.s.pl.floor()))
            .num("seeds", g)
            .str("now", &to_fixed(self.seed_boost(), 1))
            .str("next", &to_fixed(self.seed_boost_of(self.s.ascend + g), 1))
            .num("keep", self.lvl(N_HEAD))
            .end()
    }

    /// `godInfo()`: what the god ki box spells out.
    pub fn god_info_json(&self) -> String {
        let s = &self.s;
        Obj::new()
            .str("pl", &fmt_short(s.pl.floor()))
            .num("gain", self.god_now() as f64)
            .str("now", &fmt_short(Self::god_boost_of(s.god_total as f64)))
            .str("next", &fmt_short(Self::god_boost_of((s.god_total + self.god_now()) as f64)))
            .str("seeds", &fmt_short(s.ascend))
            .num("stars", s.ustars as f64)
            .end()
    }

    /// `zenoInfo()`: what the zeno box spells out.
    pub fn zeno_info_json(&self) -> String {
        let s = &self.s;
        Obj::new()
            .str("now", &fmt_short(ZENO_X.powf(s.zeno as f64)))
            .str("next", &fmt_short(ZENO_X.powf(s.zeno as f64 + 1.0)))
            .num("gods", s.gods as f64)
            .num("stars", (s.ustars + s.mastery) as f64)
            .end()
    }

    /// `card()`: the share card's facts, newest achievement first. The hero's sprite and the scene come from the
    /// renderer (`spr`, `scene` in game.js), so they're not here.
    pub fn card_json(&self) -> String {
        let s = &self.s;
        let mut done: Vec<(usize, &str, f64)> =
            ACH.iter().enumerate().filter(|(_, a)| s.ach.contains(a.0)).map(|(i, a)| (i, a.1, s.ach_at.get(a.0).copied().unwrap_or(0.0))).collect();
        done.sort_by(|a, b| b.2.partial_cmp(&a.2).unwrap().then(a.0.cmp(&b.0)));
        let hero = CHARS.iter().find(|c| c.0 == s.hero).unwrap_or(&CHARS[0]).2;
        let uni = if s.multi || s.uni_best > 0 { uni_badge(s.uni.max(s.uni_best) as usize) } else { String::new() };
        Obj::new()
            .raw("ach", arr(done.iter().map(|d| json::str(d.1))))
            .num("achN", ACH.len() as f64)
            .num("laps", self.laps as f64)
            .num("time", self.session)
            .num("best", s.best.floor())
            .num("pl", s.pl.floor())
            .str("form", self.forms[s.form].name)
            .str("hero", hero)
            .num("world", s.world as f64)
            .str("worldName", WORLD_FULL[s.world as usize])
            .num("wishes", s.granted as f64)
            .num("orbs", s.orbs7 as f64)
            .num("seeds", s.ascend)
            .num("sagas", VILLAINS.len() as f64)
            .num("saga", s.saga as f64)
            .str("peak", if s.form_top > s.form { s.form_top_name } else { "" })
            .str("uni", &uni)
            .num("ustars", s.ustars as f64)
            .num("godki", s.god_total as f64)
            .str("zeno", &if s.zeno > 0 { fmt_short(ZENO_X.powf(s.zeno as f64)) } else { String::new() })
            .num("mastery", s.mastery as f64)
            .num("movies", s.movies as f64)
            .num("tail", s.lvf(Upg::Tail))
            .end()
    }

    /// Drains the toasts as `[[text, ms], ...]`.
    pub fn take_events_json(&mut self) -> String {
        arr(self.events.drain(..).map(|(s, ms)| arr([json::str(&s), num(ms)])))
    }

    /// Drains the cues as `[[call, arg?], ...]`.
    pub fn take_cues_json(&mut self) -> String {
        arr(self.cues.drain(..).map(|c| c.to_json()))
    }
}
