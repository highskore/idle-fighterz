//! The save: game.js keeps `S` in localStorage under `hs-power` as `JSON.stringify(S)`, and a new visit reads back only
//! the date of the last daily bonus (`KEEP = ['daily']`). `save_json` writes the same object, key for key (flags as
//! 0/1, the tree, angels and bosses beaten as `{id: n}`, achievements as `{id: Date.now()}`); `load_json` keeps what
//! game.js keeps. Keys game.js only creates once they're first set (`lapsTotal`, `stars`, ...) are always written here,
//! at the value game.js reads for a missing one.

use crate::data::{Upg, ANGELS, CHARS, TREE};
use crate::game::Game;
use crate::json::{self, arr, Obj};
use crate::timeline::Later;

/// The levels in `S`'s key order, where `save_json` writes them right after `best` (tail comes later: game.js only adds
/// it once it's bought).
const LEVEL_KEYS: [Upg; 14] = [
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
    Upg::Itx,
];

fn flag(b: bool) -> f64 {
    if b {
        1.0
    } else {
        0.0
    }
}

fn level(g: &Game, u: Upg) -> f64 {
    g.s.lvf(u)
}

impl Game {
    /// `JSON.stringify(S)`.
    pub fn save_json(&self) -> String {
        let s = &self.s;
        let mut o = Obj::new().big("pl", s.pl).big("best", s.best);
        for u in LEVEL_KEYS {
            o = o.num(u.key(), level(self, u));
        }
        let tree = TREE.iter().enumerate().filter(|(i, _)| s.tree[*i] > 0).fold(Obj::new(), |o, (i, n)| o.num(n.id, s.tree[i] as f64));
        let angel = ANGELS.iter().enumerate().filter(|(i, _)| s.angel[*i]).fold(Obj::new(), |o, (_, a)| o.num(a.id, 1.0));
        o = o
            .num("spirit", s.spirit as f64)
            .num("world", s.world as f64)
            .num("orbs7", s.orbs7 as f64)
            .num("wishes", s.wishes as f64)
            .num("granted", s.granted as f64)
            .big("ascend", s.ascend)
            .num("form", s.form as f64)
            .big("seeds", s.seeds)
            .raw("tree", tree.end())
            .num("saga", s.saga as f64)
            .big("runBest", s.run_best)
            .num("uni", s.uni as f64)
            .num("uniStage", s.uni_stage as f64)
            .num("multi", flag(s.multi))
            .num("multiT", s.multi_t)
            .num("uniBest", s.uni_best as f64)
            .num("ustars", s.ustars as f64)
            .num("mastery", s.mastery as f64)
            .num("godki", s.godki as f64)
            .num("godTotal", s.god_total as f64)
            .num("gods", s.gods as f64)
            .raw("angel", angel.end())
            .num("autoAt", s.auto_at as f64)
            .num("zeno", s.zeno as f64)
            .num("limits", s.limits as f64)
            .num("creep", s.creep)
            .num("meter", s.meter)
            .num("mile", s.mile as f64)
            .num("formTop", s.form_top as f64)
            .str("formTopName", s.form_top_name)
            .num("movies", s.movies as f64)
            .num("souls", s.souls as f64)
            .num("been", s.been as f64)
            .num("tail", level(self, Upg::Tail));
        let ach = s.ach.iter().fold(Obj::new(), |o, id| o.num(id, s.ach_at.get(id).copied().unwrap_or(0.0)));
        let hero = CHARS.iter().find(|c| c.0 == s.hero).map_or("vegeta", |c| c.1);
        o = o.raw("ach", ach.end()).str("hero", hero).raw("goal", Obj::new().str("id", s.goal).num("p", s.goal_p).end());
        if let Some(d) = &s.daily {
            o = o.str("daily", d);
        }
        let beaten = s.beaten.iter().fold(Obj::new(), |o, b| o.num(b, 1.0));
        o.num("goalsDone", s.goals_done as f64)
            .num("lapsTotal", s.laps_total as f64)
            .big("namekAt", s.namek_at)
            .num("trips", s.trips as f64)
            .num("namekLeft", s.namek_left)
            .num("bosses", s.bosses as f64)
            .raw("beaten", beaten.end())
            .raw("foes", arr(s.foes.iter().map(|f| json::str(f))))
            .num("tourBest", s.tour_best as f64)
            .num("o9k", flag(s.o9k))
            .num("geros", s.geros as f64)
            .num("krillinDead", flag(s.krillin_dead))
            .num("krillinAlly", flag(s.krillin_ally))
            .num("krillinRevives", s.krillin_revives as f64)
            .num("bigApe", flag(s.big_ape))
            .num("stars", s.stars as f64)
            .num("gregWins", s.greg_wins as f64)
            .num("aura", s.aura as f64)
            .end()
    }

    /// Reads a stored save the way game.js does: every visit starts from zero, keeping only the daily bonus's date.
    /// Anything unreadable is ignored, as game.js's try/catch ignores it.
    pub fn load_json(&mut self, text: &str) {
        if let Some(d) = json::parse(text).as_ref().and_then(|v| v.get("daily")).and_then(json::Value::as_str) {
            self.s.daily = Some(d.to_string());
        }
    }

    /// game.js `start()` on the day `today` (`new Date().toDateString()`): play begins, and the first visit of a day
    /// after an earlier one brings the daily bonus, ×1.25 for five minutes and a dragon ball.
    pub fn start_on(&mut self, today: &str) {
        self.start();
        if self.s.daily.as_deref() != Some(today) {
            let first = self.s.daily.as_deref().is_none_or(str::is_empty);
            self.s.daily = Some(today.to_string());
            if !first {
                self.b.daily_until = self.t + 300.0;
                self.s.orbs7 = 6.min(self.s.orbs7 + 1);
                self.after(0.9, Later::Event("daily bonus: ×1.25 for 5 min + a dragon ball".into(), 2600.0));
            }
        }
        // what the HUD shows until the first frame, so a page drawing it right away doesn't show an empty goal
        self.hud = self.hud_now();
    }
}
