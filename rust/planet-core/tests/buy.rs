//! The shop's bulk buys, undo and hover card: ×10 is ten single buys, max never overspends, undo puts power and levels
//! back exactly (and only while nothing else hangs on the buy), and the card's numbers are what the next level does.

use planet_core::big::Big;
use planet_core::buy::{UNDO_MIN, UNDO_S};
use planet_core::data::Upg;
use planet_core::{Game, DT};

/// A game in play holding `pl`, in super saiyan 3 so a form-up can't land while it runs.
fn holding(pl: impl Into<Big>) -> Game {
    let mut g = Game::new(11);
    g.start();
    g.s.form = 3;
    g.s.pl = pl.into();
    g.s.best = g.s.pl.max(1e7);
    g.shop = g.shop_json();
    g
}

fn same(a: &Game, b: &Game) {
    assert_eq!(a.s.pl, b.s.pl);
    assert_eq!(a.s.levels, b.s.levels);
    assert_eq!(a.s.ach, b.s.ach);
    assert_eq!(a.shop, b.shop);
}

fn steps(g: &mut Game, n: u32) {
    for _ in 0..n {
        let t = g.t + DT;
        g.frame(t, DT);
    }
}

#[test]
fn ten_is_ten_single_buys() {
    for pl in [Big::from(3e6), Big::from(7.3e13), Big::from(1e17 + 3.0), Big::new(4.5, 1204)] {
        for u in Upg::ALL {
            let (mut a, mut b) = (holding(pl), holding(pl));
            for g in [&mut a, &mut b] {
                g.s.levels[u as usize] = 3;
            }
            let bulk = a.buy_n(u.key(), 10);
            let singles = (0..10).all(|_| b.buy(u.key()));
            assert_eq!(bulk, singles, "{} at {pl:?}", u.key());
            if !singles {
                b = holding(pl);
                b.s.levels[u as usize] = 3;
            }
            same(&a, &b);
        }
    }
}

#[test]
fn ten_is_all_or_nothing() {
    let mut g = holding(1000.0);
    let (pl, shop) = (g.s.pl, g.shop.clone());
    assert!(!g.buy_n("boots", 10), "ten boots cost more than 1000");
    assert_eq!((g.s.pl, g.s.lv(Upg::Boots), &g.shop), (pl, 0, &shop));
}

#[test]
fn max_is_single_buys_until_you_cant() {
    for pl in [Big::from(999.0), Big::from(123_456_789.0), Big::from(9.9e15), Big::from(2.5e40), Big::new(4.5, 400)] {
        for u in Upg::ALL {
            let (mut a, mut b) = (holding(pl), holding(pl));
            let bought = a.buy_n(u.key(), 0);
            let mut n = 0;
            while b.buy(u.key()) {
                n += 1;
            }
            assert_eq!(bought, n > 0, "{} at {pl:?}", u.key());
            assert_eq!(a.s.lv(u), n, "{} at {pl:?}", u.key());
            same(&a, &b);
            assert!(a.s.pl >= 0.0 && a.s.pl < a.cost(u), "max never overspends, and leaves no level it could buy");
        }
    }
}

#[test]
fn max_skips_levels_too_cheap_to_matter() {
    // levels whose price can't change what you hold are free one by one too, and max takes them in one search
    let mut g = holding(Big::new(7.1, 1_200_000));
    assert!(g.buy_n("boots", 0));
    assert_eq!(g.s.lv(Upg::Boots), planet_core::buy::BULK_MAX);
    assert_eq!(g.s.pl, Big::new(7.1, 1_200_000));
}

#[test]
fn bulk_prices_are_what_the_buys_spend() {
    let g = holding(5e7);
    let info: serde_json::Value = serde_json::from_str(&g.bulk_json(10)).unwrap();
    for (key, row) in info.as_object().unwrap() {
        let mut b = holding(5e7);
        let before = b.s.pl.to_f64();
        if b.buy_n(key, 10) {
            assert_eq!(row["cost"].as_f64().unwrap(), before - b.s.pl.to_f64(), "{key}");
        }
        assert_eq!(row["can"].as_bool().unwrap(), b.s.pl.to_f64() != before, "{key}");
    }
    let info: serde_json::Value = serde_json::from_str(&g.bulk_json(0)).unwrap();
    let mut b = holding(5e7);
    assert!(b.buy_n("partner", 0));
    assert_eq!(info["partner"]["n"].as_f64().unwrap(), b.s.lvf(Upg::Partner));
    assert_eq!(info["partner"]["cost"].as_f64().unwrap(), 5e7 - b.s.pl.to_f64());
}

#[test]
fn undo_puts_it_back_exactly() {
    let mut g = holding(1e6);
    g.s.levels[Upg::Partner as usize] = 12;
    g.shop = g.shop_json();
    let (pl, levels, shop) = (g.s.pl, g.s.levels, g.shop.clone());
    assert!(g.buy_n("partner", 0));
    let (id, text) = g.undo_offer.take().expect("a big buy offers undo");
    assert!(text.starts_with("bubbles ×"), "{text}");
    assert!(g.undo_live());
    assert!(!g.undo(id + 1), "only the offered buy");
    assert!(g.undo(id));
    assert_eq!((g.s.pl, g.s.levels, &g.shop), (pl, levels, &shop));
    assert!(!g.undo(id), "once");
}

#[test]
fn undo_rewinds_power_earned_since() {
    let mut g = holding(1e6);
    let pl = g.s.pl;
    assert!(g.buy_n("gravity", 0));
    let (id, _) = g.undo_offer.take().unwrap();
    let after = g.s.pl;
    steps(&mut g, 60);
    assert!(g.s.pl > after, "the run earned power meanwhile");
    assert!(g.undo(id));
    assert_eq!(g.s.pl, pl);
}

#[test]
fn undo_lapses() {
    // after UNDO_S
    let mut g = holding(1e6);
    g.buy_n("partner", 0);
    let (id, _) = g.undo_offer.take().unwrap();
    steps(&mut g, (UNDO_S / DT) as u32 + 2);
    assert!(!g.undo_live() && !g.undo(id));
    assert_eq!(g.undo_lapse(), Some(id));
    assert_eq!(g.undo_lapse(), None);

    // after another buy, a level granted, a learn, a form, a drain or kaioken
    let pokes: [fn(&mut Game); 6] = [
        |g| assert!(g.buy("boots")),
        |g| g.s.levels[Upg::Partner as usize] += 5,
        |g| {
            g.s.seeds = 100.0.into();
            g.learn("fist");
        },
        |g| g.s.form += 1,
        |g| g.drains += 1,
        |g| g.b.kaio_ready = g.t + 45.0,
    ];
    for poke in pokes {
        let mut g = holding(1e6);
        g.buy_n("partner", 0);
        let (id, _) = g.undo_offer.take().unwrap();
        poke(&mut g);
        assert!(!g.undo(id));
    }

    // when what you earned since is more than the buy cost, undo would take power: it's gone
    let mut g = holding(1e6);
    g.buy_n("partner", 0);
    let (id, _) = g.undo_offer.take().unwrap();
    g.gain(2e6);
    assert!(!g.undo(id));
}

#[test]
fn small_buys_offer_no_undo() {
    let mut g = holding(1e6);
    assert!(g.buy("boots")); // 50 of 1M
    assert!(g.undo_offer.is_none() && g.undo.is_none());
    let mut g = holding(UNDO_MIN * 2.0);
    g.s.levels[Upg::Boots as usize] = 0;
    assert!(g.buy("boots")); // half your power, but 50
    assert!(g.undo_offer.is_none());
    // a buy that lands an achievement can't be taken back
    let mut g = holding(5e9);
    g.s.ach.insert("ape");
    g.s.levels[Upg::Tail as usize] = 9;
    assert!(g.buy_n("tail", 0));
    assert!(g.s.ach.contains("tail10") && g.undo_offer.is_none());
}

#[test]
fn the_card_says_what_the_next_level_does() {
    let mut g = holding(1e6);
    let card = |g: &mut Game, k: &str| serde_json::from_str::<serde_json::Value>(&g.shop_info_json(k)).unwrap();
    g.s.levels[Upg::Piccolo as usize] = 1;
    let c = card(&mut g, "piccolo");
    assert_eq!((c["now"].as_str().unwrap(), c["next"].as_str().unwrap()), ("+60/s", "+120/s"));
    // a milestone doubles: lv 10 boots are +20 a step, not +10
    g.s.levels[Upg::Boots as usize] = 9;
    let c = card(&mut g, "boots");
    assert_eq!((c["now"].as_str().unwrap(), c["next"].as_str().unwrap()), ("+9 per step", "+20 per step"));
    let c = card(&mut g, "gravity");
    assert_eq!((c["now"].as_str().unwrap(), c["next"].as_str().unwrap()), ("×1 everything", "×1.15 everything"));
    let c = card(&mut g, "galick");
    assert_eq!((c["now"].as_str().unwrap(), c["next"].as_str().unwrap()), ("none", "beams ×1"));
    // the rate it shows next is the rate you get
    for k in ["boots", "partner", "gravity", "house", "piccolo"] {
        let c = card(&mut g, k);
        let (cost, next) = (c["cost"].as_f64().unwrap(), c["rate"][1].as_f64().unwrap());
        let mut b = holding(1e6);
        b.s.levels = g.s.levels;
        assert_eq!(cost, b.cost(Upg::from_key(k).unwrap()).to_f64(), "{k}");
        assert!(b.buy(k));
        assert_eq!(b.wrate().to_f64(), next, "{k}");
        assert_eq!(c["rate"][0].as_f64().unwrap(), g.wrate().to_f64(), "{k}");
    }
    // and the card leaves the game as it was
    g.shop = g.shop_json();
    let shop = g.shop.clone();
    card(&mut g, "house");
    g.shop = g.shop_json();
    assert_eq!(g.shop, shop);
}

#[test]
fn undo_is_an_input_like_any_other() {
    // the same inputs, undo among them, play the same game
    let run = || {
        let mut g = holding(1e6);
        steps(&mut g, 30);
        g.buy_n("partner", 0);
        let (id, _) = g.undo_offer.take().unwrap();
        steps(&mut g, 45);
        assert!(g.undo(id));
        steps(&mut g, 300);
        (g.s.pl, g.s.levels, g.rng.draws(), g.shop.clone())
    };
    assert_eq!(run(), run());
}
