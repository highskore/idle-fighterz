//! The shop's bulk buys and hover card: ×10 is ten single buys, max never overspends, and the card's numbers are what
//! the next level does.

use planet_core::big::Big;
use planet_core::data::Upg;
use planet_core::Game;

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
