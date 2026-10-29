//! The simulation: game.js `frame(t, dt)` and the inputs that change state (training taps, the shop, kaioken, the tree,
//! ascending), with the economy as methods. Expressions keep game.js's operand order so floats round the same way.

use crate::data::*;
use crate::geom::{Cam, Frame};
use crate::hud::{Cue, Hud};
use crate::input::Input;
use crate::num::js_round;
use crate::rng::Lcg;
use crate::state::Save;
use crate::timeline::Tl;

/// Timed buffs. Each is the `st.t` it runs out at.
#[derive(Clone, Debug, Default)]
pub struct Buffs {
    pub car_until: f64,
    pub boost_until: f64,
    pub ape_until: f64,
    pub senzu_until: f64,
    pub kaio_until: f64,
    pub tired_until: f64,
    pub kaio_ready: f64,
    pub asc_ready: f64,
    pub daily_until: f64,
    pub fuse_until: f64,
    pub fused: Option<(f64, f64)>, // (x, until)
    pub laugh_until: f64,
    pub chamber_until: f64,
    pub rage: f64,
    pub rage_until: f64,
    pub chi_until: f64,
    pub roshi_until: f64,
    pub calm_until: f64,
    pub gadget_until: f64,
    pub whis_until: f64,
    pub pose_until: f64,
    /// west city gadgets: a robot that taps, a hover bike that sprints
    pub robot_until: f64,
    pub bike_until: f64,
}

/// Shenron's timed wish buffs (`wishBuff`), by key.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum WishBuff {
    Fly,
    Fast,
    Taps,
    Idle,
    Laps,
    Crit,
    Combo,
}

pub struct Game {
    pub s: Save,
    pub rng: Lcg,
    pub forms: Vec<Form>,
    pub b: Buffs,
    pub wish_buff: [f64; 7],
    /// `st.t`: the time of the last frame
    pub t: f64,
    pub session: f64,
    pub playing: bool,
    pub phi: f64,
    pub laps: u32,
    pub last_lap: f64,
    pub sprint: f64,
    pub riding: f64,
    pub acc: f64,
    pub auto_acc: f64,
    pub combo: f64,
    pub last_click: f64,
    pub shake: f64,
    /// prefers-reduced-motion (`st.calm`): the screen doesn't shake, and the shake's random draw isn't made
    pub calm: bool,
    /// `ui.event` toasts (text, ms), oldest first; the HUD bridge drains them
    pub events: Vec<(String, f64)>,
    pub cam: Cam,
    pub frame3: Frame,
    /// the timeline: visitors, raids, trips, the dragon
    pub tl: Tl,
    /// the pointer: drag and spin, beam charge, the big bang
    pub inp: Input,
    /// sounds and title effects (`ui.sfx`, `ui.fx`, ...), oldest first; the HUD bridge drains them
    pub cues: Vec<Cue>,
    /// the HUD as game.js hands it to `ui.update`, rebuilt at that point of every frame while playing
    pub hud: Hud,
    /// `ui.shop`'s last argument: rebuilt where game.js calls `syncShop` (the HUD point of a frame, buys, the tree)
    pub shop: String,
    /// the wall clock at t = 0, in ms (achievements are stamped with it); the host sets it
    pub epoch_ms: f64,
    /// how high the hero is drawn off the road and whether he faces left: the renderer sets these
    pub lift_now: f64,
    pub flip_now: bool,
    /// whether the hero was in view the last time he was drawn (a full beam charge makes the screen tremble then)
    pub hero_seen: bool,
}

impl Game {
    pub fn new(seed: u32) -> Self {
        let s = Save::new();
        let forms = ladder_of(s.hero);
        let mut g = Game {
            s,
            rng: Lcg::new(seed),
            forms,
            b: Buffs { rage: 2.0, ..Default::default() },
            wish_buff: [0.0; 7],
            t: 0.0,
            session: 0.0,
            playing: false,
            phi: 0.0,
            laps: 0,
            last_lap: 0.0,
            sprint: 0.0,
            riding: 0.0,
            acc: 0.0,
            auto_acc: 0.0,
            combo: 1.0,
            last_click: -9.0,
            shake: 0.0,
            calm: false,
            events: Vec::new(),
            cam: Cam::new(200.0, 134.0), // the harness's 600×400 canvas in game.js pixels; the HUD bridge resizes it
            frame3: Frame::new(),
            tl: Tl::default(),
            inp: Input::default(),
            cues: Vec::new(),
            hud: Hud::default(),
            shop: String::new(),
            epoch_ms: 0.0,
            lift_now: 0.0,
            flip_now: false,
            hero_seen: false,
        };
        g.sync_shop();
        g
    }

    /// game.js `start()`; the daily bonus needs a date and waits for the save bridge.
    pub fn start(&mut self) {
        self.playing = true;
        self.sync_shop();
    }

    /// `syncShop()`: what `ui.shop` gets now.
    pub(crate) fn sync_shop(&mut self) {
        self.shop = self.shop_json();
    }

    // ── economy

    pub fn lvl(&self, node: usize) -> f64 {
        self.s.tree[node] as f64
    }

    pub fn ang(&self, a: usize) -> bool {
        self.s.angel[a]
    }

    pub fn wished(&self, k: WishBuff) -> bool {
        self.wish_buff[k as usize] > self.t
    }

    /// Producer milestone multiplier.
    pub fn ms(&self, u: Upg) -> f64 {
        let l = self.s.lv(u);
        let hit = MS.iter().filter(|&&n| l >= n).count() as f64;
        let past = ((l as f64 - 100.0) / 50.0).floor().max(0.0);
        2f64.powf(hit + past)
    }

    pub fn seed_boost_of(&self, a: f64) -> f64 {
        let b = 1.0 + a * (0.1 + 0.02 * self.lvl(N_SEEDX));
        if b <= SEED_SOFT {
            b
        } else {
            SEED_SOFT * (b / SEED_SOFT).powf(SEED_EXP)
        }
    }

    pub fn seed_boost(&self) -> f64 {
        self.seed_boost_of(self.s.ascend)
    }

    pub fn combo_cap(&self) -> f64 {
        if self.lvl(N_PRIDE) > 0.0 {
            4.0
        } else {
            2.0
        }
    }

    pub fn tree_open(&self) -> bool {
        self.s.seeds > 0.0 || self.s.tree.iter().any(|&v| v > 0)
    }

    pub fn seeds_now(&self) -> f64 {
        let p = self.s.pl / 1e4;
        (if self.ang(A_DIVINE) { p.powf(0.55) } else { p.sqrt() }).floor().max(1.0)
    }

    pub fn god_now(&self) -> u32 {
        (if self.s.gods > 0 { 0 } else { 1 }).max(self.s.uni) * if self.ang(A_PRIEST) { 2 } else { 1 }
    }

    pub fn zeno_ready(&self) -> bool {
        self.s.gods >= ZENO_GODS * (1 + self.s.zeno)
    }

    pub fn god_boost_of(n: f64) -> f64 {
        1.0 + GOD_X * n
    }

    /// The ki ceiling: the capped engine shrinks to a small power past it.
    pub fn ceiling(&self) -> f64 {
        let time = if self.s.multi { CEIL_T.powf(((self.session - self.s.multi_t) / 60.0).max(0.0)) } else { 1.0 };
        CEIL0 * time * CEIL_STEP.powf(self.s.uni_best as f64)
    }

    pub fn capped(&self, m: f64) -> f64 {
        let c = self.ceiling();
        if m <= c {
            m
        } else {
            c * (m / c).powf(CEIL_EXP)
        }
    }

    pub fn late_boost(&self) -> f64 {
        let stars = self.s.ustars as f64 * if self.ang(A_STARS) { 2.0 } else { 1.0 };
        STAR_X.powf(stars) * MASTERY_X.powf(self.s.mastery as f64) * Self::god_boost_of(self.s.god_total as f64) * ZENO_X.powf(self.s.zeno as f64)
    }

    /// The engine the ceiling caps; forms sit outside it.
    pub fn core(&self) -> f64 {
        let w = self.s.wishes as f64;
        1.15f64.powf(self.s.lvf(Upg::Gravity)) * 1.25f64.powf(w) * (1.0 + 0.05 * self.lvl(N_WISH) * w) * self.seed_boost() * ECON
    }

    pub fn tail_lv(&self) -> f64 {
        let t = self.s.lvf(Upg::Tail);
        if t <= 10.0 {
            t
        } else {
            10.0 + 2.0 * (t - 10.0).sqrt()
        }
    }

    /// His bonus on top of ×1; only his size and time slow past lv 10.
    pub fn ape_x(&self) -> f64 {
        2.0 + 0.25 * self.s.lvf(Upg::Tail) + if self.tl.ape.giant { 1.0 } else { 0.0 }
    }

    /// Crit chance past 100%: each 10% of it is +20% crit damage.
    pub fn crit_over(&self) -> f64 {
        (self.s.lvf(Upg::Scouter) * 0.1 + self.lvl(N_CRIT) * 0.08 - 1.0).max(0.0)
    }

    pub fn crit_hit(&self) -> f64 {
        (2.0 + self.lvl(N_CRITX)) * (1.0 + 2.0 * self.crit_over())
    }

    /// A senzu bean's boost at a senzu tree level: ×1.5, +0.1 a level past lv 3 (when beans come round fast enough).
    pub fn senzu_x_at(lv: f64) -> f64 {
        (15.0 + (lv - 3.0).max(0.0)) / 10.0
    }

    pub fn senzu_x(&self) -> f64 {
        Self::senzu_x_at(self.s.lvf(Upg::Senzu))
    }

    /// A full charge's pay at a galick level: +5% a level.
    pub fn beam_x_at(lv: f64) -> f64 {
        (19.0 + lv.max(1.0)) / 20.0
    }

    /// A big bang's pay, in full beams, at a level: 1.3, +0.05 a level.
    pub fn bang_x_at(lv: f64) -> f64 {
        (25.0 + lv) / 20.0
    }

    pub fn kaio_x(&self) -> f64 {
        1.25 + 0.25 * self.s.lvf(Upg::Kaio)
    }

    /// Instant transmission's cooldown, from the end of a jump's trip: 5 min, down to 90s.
    pub fn itx_cd(&self) -> f64 {
        (300.0 / (1.0 + 0.1 * (self.s.lvf(Upg::Itx) - 1.0))).max(90.0)
    }

    /// How much sooner pods, the nimbus and trips come with instant transmission: up to 30%.
    pub fn soon(&self) -> f64 {
        (1.0 / (1.0 + 0.04 * self.s.lvf(Upg::Itx))).max(0.7)
    }

    pub fn chamber_x(&self) -> f64 {
        1.5 + 0.5 * self.s.lvf(Upg::Chamber)
    }

    /// Permanent boosts multiply; timed ones add their bonuses. `bare` leaves the timed ones out (windfalls, villain hp).
    pub fn mult(&self, bare: bool) -> f64 {
        let t = self.t;
        let b = &self.b;
        let on = |until: f64, x: f64| if until > t { x } else { 0.0 };
        let bonus = if bare {
            1.0
        } else {
            1.0 + on(b.car_until, 0.5)
                + on(b.boost_until, 1.0)
                + on(b.ape_until, self.ape_x())
                + on(b.senzu_until, self.senzu_x() - 1.0)
                + if self.riding > 0.0 { 0.5 } else { 0.0 }
                + on(b.kaio_until, self.kaio_x() - 1.0)
                + on(b.daily_until, 0.25)
                + on(b.fuse_until, 1.0)
                + b.fused.map_or(0.0, |(x, until)| on(until, x - 1.0))
                + on(b.laugh_until, 0.25)
                + on(b.chamber_until, self.chamber_x() - 1.0)
                + on(b.rage_until, b.rage - 1.0)
                + on(b.chi_until, 0.5)
                + on(b.roshi_until, 0.5)
                + on(b.calm_until, 0.25)
                + on(b.gadget_until, 0.5)
        };
        let tired = if b.kaio_until <= t && b.tired_until > t { 0.75 } else { 1.0 };
        let awake = if self.tl.bz.as_ref().is_some_and(|b| b.awake != 0.0) { 0.25 } else { 1.0 };
        let m = self.capped(self.core()) * self.forms[self.s.form].x * self.late_boost() * bonus * tired * awake;
        if m < MAX_MULT {
            m
        } else {
            MAX_MULT
        }
    }

    pub fn lap_value(&self) -> f64 {
        30.0 * (1.0 + self.s.lvf(Upg::Boots) * self.ms(Upg::Boots))
    }

    pub fn passive(&self) -> f64 {
        let s = &self.s;
        (s.lvf(Upg::Partner) * 4.0 * self.ms(Upg::Partner)
            + s.lvf(Upg::House) * 40.0 * self.ms(Upg::House)
            + s.lvf(Upg::Piccolo) * 60.0 * self.ms(Upg::Piccolo))
            * (1.0 + 0.5 * self.lvl(N_IDLE))
            * if self.wished(WishBuff::Idle) { 3.0 } else { 1.0 }
            * if self.lvl(N_ETERNAL) > 0.0 { 3.0 } else { 1.0 }
            * if s.krillin_ally { 1.5 } else { 1.0 }
    }

    /// Power a second, buffs included: what the HUD shows.
    pub fn rate(&self) -> f64 {
        js_round((self.lap_value() / 7.0 + self.passive()) * self.mult(false))
    }

    /// The rate without timed buffs: windfalls and villain hp are sized on it.
    pub fn wrate(&self) -> f64 {
        js_round((self.lap_value() / 7.0 + self.passive()) * self.mult(true))
    }

    pub fn unlocked(&self, u: Upg) -> bool {
        let best = self.s.best;
        match u {
            Upg::Boots | Upg::Partner | Upg::Gravity | Upg::Cloud => true,
            Upg::Scouter => best >= 150.0,
            Upg::Galick => best >= 400.0,
            Upg::Senzu => best >= 1000.0,
            Upg::House => best >= 2000.0,
            Upg::Armor => best >= 5000.0,
            Upg::Tail => self.s.ach.contains("ape"),
            Upg::Kaio => best >= 8000.0,
            Upg::Bigbang => best >= 20000.0,
            Upg::Piccolo => best >= 10000.0,
            Upg::Chamber => best >= 40000.0,
            Upg::Itx => self.s.ach.contains("yardrat"),
        }
    }

    pub fn ascend_unlocked(&self) -> bool {
        self.s.best >= 1e6 || self.tree_open()
    }

    pub fn cost(&self, u: Upg) -> f64 {
        let it = &SHOP[u as usize];
        (it.base * it.k.powf(self.s.lvf(u)) * (1.0 - 0.05 * self.lvl(N_DEAL))).floor()
    }

    /// Ascending spends all you hold, 1M at least.
    pub fn ascend_cost(&self) -> f64 {
        self.s.pl.floor().max(1e6)
    }

    pub fn god_cost(&self) -> f64 {
        self.s.pl.floor().max(2e14)
    }

    // ── state changes

    /// `ui.event(text)`: a toast for the default 2.6s.
    pub(crate) fn event(&mut self, s: impl Into<String>) {
        self.events.push((s.into(), 2600.0));
    }

    /// `ui.event(text, ms)`: a toast that stays up `ms` milliseconds.
    pub(crate) fn event_ms(&mut self, s: impl Into<String>, ms: f64) {
        self.events.push((s.into(), ms));
    }

    /// `ach(id)`: an achievement, once, stamped with the wall clock; its toast follows 0.9s later.
    pub(crate) fn ach(&mut self, id: &str) {
        if !self.playing || self.s.ach.contains(id) {
            return;
        }
        let Some(&(id, name, _)) = ACH.iter().find(|a| a.0 == id) else { return };
        self.s.ach.insert(id);
        self.s.ach_at.insert(id, self.now_ms());
        let unlocks = CHARS.iter().find(|c| c.3 == Some(id)).map_or(String::new(), |c| format!(" · {} unlocked", c.2));
        self.after(0.9, crate::timeline::Later::Event(format!("achievement — {name}{unlocks}"), 3200.0));
        self.cue(Cue::Sfx("coin"));
        self.cue(Cue::Achieved);
    }

    /// `Date.now()`: the host's wall clock at `t` (`epoch_ms` is the clock at t = 0).
    pub fn now_ms(&self) -> f64 {
        self.epoch_ms + (self.t * 1000.0).floor()
    }

    pub fn gain(&mut self, n: f64) {
        let n = if n > 1.0 { MAX_PL.min(js_round(n)) } else { 1.0 };
        self.s.pl = MAX_PL.min(self.s.pl + n);
        if self.s.pl > self.s.best {
            self.s.best = self.s.pl;
        }
        if self.s.pl > self.s.run_best {
            self.s.run_best = self.s.pl;
        }
    }

    fn goal_need(&self, id: &str) -> bool {
        match id {
            "beam" => self.s.lv(Upg::Galick) > 0,
            "tour" => self.s.best >= 3000.0,
            _ => true,
        }
    }

    fn next_goal(&mut self) {
        let i = GOALS.iter().position(|g| g.id == self.s.goal).unwrap_or(0);
        for k in 1..=GOALS.len() {
            let g = &GOALS[(i + k) % GOALS.len()];
            if self.goal_need(g.id) {
                self.s.goal = g.id;
                self.s.goal_p = 0.0;
                return;
            }
        }
    }

    /// Training goals: progress, and a prize (and every fifth, a dragon ball) when one is done.
    pub fn goal(&mut self, id: &str, amount: f64, set: bool) {
        if id == "meteor" {
            if let Some(s) = self.tl.storm.as_mut() {
                s.hit += 1;
            }
        }
        if !self.playing || self.s.goal != id {
            return;
        }
        let g = GOALS.iter().find(|g| g.id == id).unwrap();
        self.s.goal_p = if set { self.s.goal_p.max(amount) } else { self.s.goal_p + amount };
        if self.s.goal_p >= g.n {
            self.s.goals_done += 1;
            let prize = (self.wrate() * 90.0 * (1.0 + (self.s.goals_done.min(20) as f64) * 0.15)).max(200.0);
            self.gain(prize);
            let mut msg = format!("training done: {} — +{}", g.text, crate::num::fmt_short(js_round(prize)));
            if self.s.goals_done.is_multiple_of(5) {
                self.s.orbs7 += 1;
                msg += " and a dragon ball";
                if self.s.orbs7 >= 7 {
                    self.s.orbs7 = 0;
                    self.after(1.5, crate::timeline::Later::Summon);
                }
            }
            self.event(msg);
            self.cue(Cue::Fx("buy"));
            self.next_goal();
        }
    }

    pub(crate) fn victory(&mut self) {
        self.b.pose_until = self.t + 1.6;
    }

    pub(crate) fn transform(&mut self, preview: bool) {
        self.s.form += 1;
        self.victory();
        if !preview {
            let f = self.s.form;
            if f >= 1 {
                self.ach("ss");
            }
            if f >= UI_FORM {
                self.ach("ui");
            }
            if f >= MUI_FORM {
                self.ach("mui");
            }
            if let Some(&(_, a)) = LATE_ACH.iter().find(|l| l.0 == self.forms[f].name) {
                self.ach(a);
            }
            if f > self.s.form_top {
                self.s.form_top = f;
                self.s.form_top_name = self.forms[f].name;
            }
        }
        self.cue(Cue::Sfx("form"));
        let f = &self.forms[self.s.form];
        let msg = format!("{}!  ×{}{}", f.name, f.x, if preview { " — a taste, for 60s" } else { "" });
        self.event(msg);
        self.cue(Cue::Form(self.s.form));
        self.rng.skip(RNG_TRANSFORM);
    }

    /// game.js `train()`: a tap just off the hero, so nothing on the planet takes it and it trains.
    pub fn train(&mut self) {
        let k = self.kid_screen(14.0);
        self.click(k.x + 999.0, k.y + 999.0);
    }

    /// The fall-through of `onClick`: a training tap.
    pub(crate) fn train_tap(&mut self) {
        let t = self.t;
        let cap = self.combo_cap();
        self.combo = if self.wished(WishBuff::Combo) {
            cap
        } else if t - self.last_click < 0.6 {
            (self.combo + 0.1).min(cap)
        } else {
            1.0
        };
        self.last_click = t;
        if self.combo >= 2.0 {
            self.goal("combo", 1.0, false);
        }
        self.sprint = (self.sprint + 0.5).min(1.2);
        let whis = self.b.whis_until > t;
        if let Some(bz) = self.tl.bz.as_mut().filter(|b| b.awake == 0.0) {
            bz.noise += if whis { 0.08 } else { 0.04 };
        }
        if self.tl.jump_h <= 0.0 {
            self.tl.jump_v = 120.0;
        }
        let crit = self.wished(WishBuff::Crit) || self.rng.random() < self.s.lvf(Upg::Scouter) * 0.1 + self.lvl(N_CRIT) * 0.08;
        let n = (1.0 + self.s.lvf(Upg::Boots) * self.ms(Upg::Boots))
            * self.mult(false)
            * self.combo
            * if crit { self.crit_hit() } else { 1.0 }
            * (1.0 + 0.5 * self.lvl(N_FIST))
            * if self.wished(WishBuff::Taps) { 3.0 } else { 1.0 };
        self.gain(n);
        self.cue(Cue::Sfx("tap"));
        if crit {
            self.rng.skip(RNG_CRIT);
        }
        self.cue(Cue::Bump);
    }

    /// Buys a shop item by its game.js key; false if it can't be afforded.
    pub fn buy(&mut self, key: &str) -> bool {
        match key {
            "ascend" => {
                if self.s.pl < self.ascend_cost() {
                    return false;
                }
                self.ascend();
                true
            }
            "godki" => {
                if self.s.pl < self.god_cost() {
                    return false;
                }
                self.god_reset();
                true
            }
            "zeno" => {
                self.zeno_erase();
                true
            }
            _ => {
                let Some(u) = Upg::from_key(key) else { return false };
                let c = self.cost(u);
                if self.s.pl < c {
                    return false;
                }
                self.s.pl -= c;
                self.s.levels[u as usize] += 1;
                self.cue(Cue::Fx("buy"));
                for (n, id) in [(10, "tail10"), (25, "tail25"), (50, "tail50")] {
                    if self.s.lv(Upg::Tail) >= n {
                        self.ach(id);
                    }
                }
                let first = self.s.lv(u) == 1;
                let note = match u {
                    Upg::Partner if first => "bubbles wants to train with you",
                    Upg::Galick if first => {
                        if self.kame() {
                            "hold anywhere to charge a kamehameha"
                        } else {
                            "hold anywhere to charge a galick gun"
                        }
                    }
                    Upg::House => "a new capsule house lands",
                    Upg::Piccolo if first => "piccolo lands to meditate",
                    Upg::Chamber if first => "the time chamber door will appear — tap it",
                    Upg::Kaio if first => "kaioken unlocked — hit the red button",
                    Upg::Bigbang if first => "big bang attack — double-tap anywhere",
                    Upg::Itx if first => "instant transmission — tap with two fingers (or right-click), or press its button, to jump to a world you've been",
                    Upg::Armor if first => "saiyan armor on — hit villains harder",
                    _ => "",
                };
                if !note.is_empty() {
                    self.event(note);
                }
                self.sync_shop();
                true
            }
        }
    }

    /// The worlds instant transmission can reach: every one you've been but snake way and the arena.
    pub fn itx_worlds(&self) -> Vec<u32> {
        ITX_WORLDS.into_iter().filter(|w| self.s.been & 1 << w != 0).collect()
    }

    /// game.js `calm()`: nothing on (no fight, the dragon, the dance or a struggle). Not `self.calm`, reduced motion.
    pub fn calm(&self) -> bool {
        let tl = &self.tl;
        tl.tour.is_none()
            && tl.shen.is_none()
            && tl.boss.is_none()
            && tl.dance.is_none()
            && tl.struggle.is_none()
            && !tl.ginyu.as_ref().is_some_and(|g| g.done == 0.0)
            && tl.movie.is_none()
    }

    /// game.js `itxCan()`: owned, recharged, at home, and calm.
    pub fn itx_can(&self) -> bool {
        self.playing && self.s.lv(Upg::Itx) > 0 && self.t >= self.tl.itx_ready && self.s.world == self.home() && self.calm()
    }

    /// game.js `itxNo()`: why it won't go (said only once it's owned and the game is on).
    fn itx_no(&mut self) {
        if self.s.lv(Upg::Itx) == 0 || !self.playing {
            return;
        }
        if self.t < self.tl.itx_ready {
            let msg = format!("instant transmission recharges in {}s", (self.tl.itx_ready - self.t).ceil());
            self.event(msg);
        } else {
            self.event("instant transmission only works from home, with no fight on");
        }
    }

    /// game.js `itxOpen()` (the gesture or the button): the picker, or why it won't open.
    pub fn itx_open(&mut self) {
        if !self.itx_can() {
            self.itx_no();
            return;
        }
        let list = crate::json::arr(
            self.itx_worlds().into_iter().map(|w| crate::json::Obj::new().num("key", w as f64).str("label", crate::hud::WORLD_FULL[w as usize]).end()),
        );
        self.cue(crate::hud::Cue::ItxPick(list));
    }

    /// game.js `itxJump(w)`: that world's normal trip, starting now, on top of the natural ones (their timer and power
    /// mark stay); the cooldown starts when it ends.
    pub fn itx_jump(&mut self, w: u32) {
        if !self.itx_can() {
            self.itx_no();
            return;
        }
        if !self.itx_worlds().contains(&w) {
            return;
        }
        self.trip(w);
        self.tl.itx_trip = true;
        self.ach("itx");
        self.cue(crate::hud::Cue::Sfx("itx"));
    }

    /// game.js `itxHome()`: a jumped trip is over, so the cooldown starts.
    pub(crate) fn itx_home(&mut self) {
        self.tl.itx_trip = false;
        self.tl.itx_ready = self.t + self.itx_cd();
        self.tl.itx_back = self.session;
    }

    pub fn kaioken(&mut self) {
        if !self.playing || self.s.lv(Upg::Kaio) == 0 || self.t < self.b.kaio_ready {
            return;
        }
        self.ach("kaioken");
        self.b.kaio_until = self.t + 15.0;
        self.b.tired_until = self.t + 25.0;
        self.b.kaio_ready = self.t + 45.0;
        self.shake = 0.5;
        let msg = format!("kaioken! ×{}", self.kaio_x());
        self.event(msg);
        self.rng.skip(RNG_KAIOKEN);
    }

    fn branch_pts(&self, b: Branch) -> u32 {
        TREE.iter().enumerate().filter(|(_, n)| n.branch == b).map(|(i, _)| self.s.tree[i]).sum()
    }

    /// Uncapped nodes cost double every 5 ranks.
    pub fn rank_cost(n: &Node, r: u32) -> f64 {
        TIER_COST[n.tier] as f64 * 2f64.powf((r / 5) as f64)
    }

    pub fn node_open(&self, i: usize) -> bool {
        self.branch_pts(TREE[i].branch) >= TIER_NEED[TREE[i].tier]
    }

    pub fn learn(&mut self, id: &str) {
        let Some(i) = node_ix(id) else { return };
        let n = &TREE[i];
        let c = Self::rank_cost(n, self.s.tree[i]);
        if !self.node_open(i) || self.s.tree[i] >= n.max || self.s.seeds < c {
            return;
        }
        self.s.seeds -= c;
        self.s.tree[i] += 1;
        self.cue(Cue::Sfx("buy"));
        self.sync_shop();
    }

    pub fn respec(&mut self) {
        for (i, n) in TREE.iter().enumerate() {
            for r in 0..self.s.tree[i] {
                self.s.seeds += Self::rank_cost(n, r);
            }
        }
        self.s.tree = [0; TREE.len()];
        self.sync_shop();
    }

    pub fn ascend(&mut self) {
        if self.t < self.b.asc_ready {
            return;
        }
        self.b.asc_ready = self.t + ASC_CD;
        let gain = self.seeds_now();
        let keep = (self.s.pl * 0.01 * self.lvl(N_HEAD)).floor();
        self.s.ascend += gain;
        self.s.seeds += gain;
        self.ach("ascend");
        self.s.pl = keep;
        self.s.run_best = keep;
        self.s.namek_at = 0.0;
        self.s.foes.clear();
        let notes = self.ang(A_NOTES);
        for l in self.s.levels.iter_mut() {
            *l = if notes { (*l as f64 * 0.1).floor() as u32 } else { 0 };
        }
        self.s.form = if self.ang(A_GOLDEN) { 1 } else { 0 };
        self.tl.preview = None;
        self.cue(Cue::Form(self.s.form));
        let msg = format!(
            "ascended — +{gain} ki seed{} (×{} on everything), back to {}",
            if gain > 1.0 { "s" } else { "" },
            crate::num::to_fixed(self.seed_boost(), 1),
            self.forms[self.s.form].name
        );
        self.event_ms(msg, 4500.0);
        self.cue(Cue::Fx("super"));
        self.sync_shop();
    }

    /// God ki: seeds, the tree, forms and universes go; wishes, sagas and mastery stars stay.
    pub fn god_reset(&mut self) {
        if self.s.form < MUI_FORM || self.god_now() == 0 {
            return;
        }
        let g = self.god_now();
        self.s.godki += g;
        self.s.god_total += g;
        self.s.gods += 1;
        self.ach("godki");
        let s = &mut self.s;
        s.pl = 0.0;
        s.run_best = 0.0;
        s.namek_at = 0.0;
        s.levels = [0; Upg::ALL.len()];
        s.seeds = 0.0;
        s.ascend = 0.0;
        s.tree = [0; TREE.len()];
        s.form = if s.angel[A_GOLDEN] { 1 } else { 0 };
        s.uni = 0;
        s.uni_stage = 0;
        s.ustars = 0;
        s.foes.clear();
        self.tl.preview = None;
        if let Some(b) = self.tl.boss.as_mut().filter(|b| b.uni && !b.dead) {
            b.dead = true;
            b.fled = true;
            b.t1 = self.t;
        }
        self.cue(Cue::Form(self.s.form));
        let boost = crate::num::fmt_short(Self::god_boost_of(self.s.god_total as f64));
        self.event_ms(format!("whis: \"ohoho, not bad.\" — +{g} god ki (×{boost} on everything). back to universe 9: spend god ki in menu → angels"), 5000.0);
        self.cue(Cue::Fx("super"));
        if self.zeno_ready() {
            self.after(5.2, crate::timeline::Later::Event("something tiny and very powerful is watching…".into(), 3500.0));
        }
        self.sync_shop();
    }

    /// The zeno button: everything but his favour (and achievements) is erased.
    pub fn zeno_erase(&mut self) {
        if !self.zeno_ready() {
            return;
        }
        let erased = self.tl.boss.as_ref().filter(|b| !b.dead).map(|b| b.name.clone());
        if let Some(b) = self.tl.boss.as_mut().filter(|b| !b.dead) {
            b.dead = true;
            b.fled = true;
            b.t1 = self.t;
        }
        let s = &mut self.s;
        s.levels = [0; Upg::ALL.len()];
        (s.pl, s.granted, s.multi, s.multi_t, s.uni_best, s.run_best, s.seeds, s.ascend, s.form, s.wishes, s.saga) =
            (0.0, 0, false, 0.0, 0, 0.0, 0.0, 0.0, 0, 0, 0);
        (s.uni, s.uni_stage, s.ustars, s.mastery, s.godki, s.god_total, s.gods, s.auto_at, s.orbs7, s.namek_at) = (0, 0, 0, 0, 0, 0, 0, 0, 0, 0.0);
        s.tree = [0; TREE.len()];
        s.angel = [false; ANGELS.len()];
        s.trips = 0;
        s.foes.clear();
        s.zeno += 1;
        self.tl.zen = None;
        self.tl.preview = None;
        self.tl.next_boss = 60.0;
        self.ach("zeno");
        if self.s.world != 0 {
            self.travel(0);
            self.tl.namek_until = 0.0;
        }
        if self.tl.itx_trip {
            self.itx_home();
        }
        self.shake = 1.0;
        self.cue(Cue::Form(self.s.form));
        self.cue(Cue::Fx("super"));
        self.cue(Cue::Sfx("boom"));
        let favour = crate::num::fmt_short(ZENO_X.powf(self.s.zeno as f64));
        self.event_ms(
            match erased {
                Some(v) => format!("zeno: \"{v}? he's no fun.\" — {v} is erased. then so is everything else. zeno's favour ×{favour}"),
                None => format!("zeno: \"friend! let's play again!\" — the whole universe is erased. zeno's favour ×{favour}"),
            },
            6000.0,
        );
        self.after(6.2, crate::timeline::Later::Event("villains line up to meet zeno's friend — the sagas come 4× as often".into(), 4000.0));
        self.sync_shop();
    }

    // ── the fixed step

    /// One frame of game.js `frame(t, dt)`: `t` is the new time, `dt` the step.
    pub fn frame(&mut self, t: f64, dt: f64) {
        self.t = t;
        let rdt = dt;
        let dt = if self.b.chamber_until > t && self.s.world != 3 { dt * 0.3 } else { dt };
        if self.playing {
            self.session += dt;
        }
        self.cam.bob = if self.shake > 0.0 && !self.calm { js_round((self.rng.random() - 0.5) * 5.0 * self.shake) } else { 0.0 };
        self.shake = (self.shake - dt).max(0.0);
        self.spin(dt);

        // running: sprint decays; laps pay
        self.sprint = (self.sprint - dt * 0.8).max(0.0);
        self.riding = (self.riding - dt).max(0.0);
        let snake = self.s.world == 3;
        let pace = (0.42 + self.sprint * if snake { 0.45 } else { 0.9 })
            * (1.0 + 0.1 * self.lvl(N_STRIDE))
            * if self.wished(WishBuff::Fast) { 1.5 } else { 1.0 }
            * if self.riding > 0.0 { 1.6 } else { 1.0 }
            * if self.wished(WishBuff::Fly) && !snake { 1.8 } else { 1.0 }
            * if self.b.pose_until > t || self.tl.struggle.is_some() { 0.0 } else { 1.0 };
        self.phi += pace * dt;
        if self.phi - self.last_lap > LAP {
            self.last_lap += LAP;
            if self.playing {
                self.laps += 1;
                self.s.laps_total += 1;
                self.ach("lap1");
                if self.s.laps_total >= 100 {
                    self.ach("laps100");
                }
                self.goal("laps", 1.0, false);
                self.cue(Cue::Fx("lap"));
                let n = self.lap_value()
                    * 4.0
                    * self.mult(false)
                    * (1.0 + 0.5 * self.lvl(N_LEGS))
                    * if self.wished(WishBuff::Laps) { 3.0 } else { 1.0 }
                    * if self.tl.bz.is_some() { 3.0 } else { 1.0 }
                    * if self.b.whis_until > t { 2.0 } else { 1.0 };
                self.gain(n);
            }
        }
        if self.tl.jump_h > 0.0 || self.tl.jump_v > 0.0 {
            self.tl.jump_v -= 520.0 * dt;
            self.tl.jump_h = (self.tl.jump_h + self.tl.jump_v * dt).max(0.0);
            if self.tl.jump_h == 0.0 {
                self.tl.jump_v = 0.0;
            }
        }
        if self.playing {
            // income: lap steps + passive, once a second
            self.acc += rdt;
            if self.acc >= 1.0 {
                self.acc -= 1.0;
                let n = (self.lap_value() / 7.0 + self.passive()) * self.mult(false);
                self.gain(n);
            }
            // the timeline: all of it waits while you're on snake way
            if self.s.world == 3 {
                self.update_snake(t, dt);
            } else {
                self.timeline_home(t, dt);
            }
            self.timeline_trips(t);
            if self.s.world != 3 {
                self.timeline_fights(t, dt);
            }
            // a wished form wears off: back to the best form your held power earns
            if let Some((from, until)) = self.tl.preview.filter(|p| t > p.1) {
                let _ = until;
                let mut f = from;
                while f < self.forms.len() - 1 && self.s.pl >= self.forms[f + 1].at {
                    f += 1;
                }
                if f < self.s.form {
                    self.s.form = f;
                    self.cue(Cue::Form(f));
                    let msg = format!("the wish wears off — back to {}", self.forms[f].name);
                    self.event(msg);
                } else {
                    let msg = format!("the wish wears off — but you're holding enough power: {} stays", self.forms[self.s.form].name);
                    self.event(msg);
                }
                self.tl.preview = None;
            }
            // a form you hold the power for comes one a frame and stays for the run
            if self.s.form < self.forms.len() - 1 && self.s.pl >= self.forms[self.s.form + 1].at {
                self.transform(self.tl.preview.is_some());
            }
            let last = self.forms.len() - 1;
            if self.s.form == last && self.tl.preview.is_none() && self.s.pl >= self.forms[last].at * LATE_STEP.powf(self.s.mastery as f64 + 1.0) {
                self.s.mastery += 1;
                self.ach("mastery");
                let next = crate::num::fmt_short(self.forms[last].at * LATE_STEP.powf(self.s.mastery as f64 + 1.0));
                self.event_ms(format!("mastery star {} — ×{MASTERY_X} on everything, kept through god ki. next at {next}", self.s.mastery), 3500.0);
                self.cue(Cue::Fx("star"));
            }
            if self.ang(A_AUTO)
                && self.s.auto_at > 0
                && self.s.pl >= AUTO_AT[self.s.auto_at]
                && self.tl.boss.is_none()
                && self.tl.shen.is_none()
                && self.s.world == self.home()
            {
                self.ascend();
            }
            self.timeline_after(t, dt);
            if t - self.last_click > 0.9 {
                self.combo = 1.0;
            }
            self.timeline_moon(t, dt);
            self.hud = self.hud_now();
            self.sync_shop();
        }
        self.shen_step(t);
        self.draw_step(t, dt);
        self.run_later();
    }

    /// Test hook: sets one save field by its game.js name, the way the JS harness pokes `S`.
    pub fn debug_set(&mut self, key: &str, v: f64) {
        let s = &mut self.s;
        match key {
            "pl" => s.pl = v,
            "best" => s.best = v,
            "wishes" => s.wishes = v as u32,
            "ascend" => s.ascend = v,
            "seeds" => s.seeds = v,
            "multi" => s.multi = v != 0.0,
            "multiT" => s.multi_t = v,
            "world" => s.world = v as u32,
            "uniBest" => s.uni_best = v as u32,
            "ustars" => s.ustars = v as u32,
            "godTotal" => s.god_total = v as u32,
            "zeno" => s.zeno = v as u32,
            "mastery" => s.mastery = v as u32,
            "autoAt" => s.auto_at = v as usize,
            "gods" => s.gods = v as u32,
            "uni" => s.uni = v as u32,
            "krillinDead" => s.krillin_dead = v != 0.0,
            "orbs7" => s.orbs7 = v as u32,
            "trips" => s.trips = v as u32,
            "form" => s.form = v as usize,
            _ => {
                if let Some(a) = key.strip_prefix("angel.").and_then(angel_ix) {
                    s.angel[a] = v != 0.0;
                } else if let Some(u) = Upg::from_key(key) {
                    s.levels[u as usize] = v as u32;
                } else {
                    panic!("debug_set: unknown key {key}");
                }
            }
        }
    }
}

impl Game {
    /// `layout()` for a new canvas: `w`×`h` buffer pixels at `scale` CSS pixels each.
    pub fn resize(&mut self, w: f64, h: f64, scale: f64) {
        (self.cam.w, self.cam.h, self.cam.scale) = (w, h, scale);
        self.cam.layout(self.s.world);
    }
}
