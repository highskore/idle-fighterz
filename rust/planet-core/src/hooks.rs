//! The preview hooks (`hooks.txt`): the list `Game::preview` reads its keys from, and test/browser/hooks.spec.mjs plays.

const LIST: &str = include_str!("hooks.txt");

/// Every listed hook, `#raid` style.
pub fn hooks() -> impl Iterator<Item = &'static str> {
    LIST.lines().filter(|l| l.starts_with('#')).filter_map(|l| l.split_whitespace().next())
}

/// A key a preview hook is matched by; planet-core's own tests fail on one that no listed hook has.
pub(crate) fn key(k: &str) -> &str {
    if cfg!(test) {
        assert!(hooks().any(|h| h.contains(k)), "preview reads `{k}`, which no hook in hooks.txt has");
    }
    k
}

#[cfg(test)]
mod tests {
    use crate::Game;

    #[test]
    fn every_key_preview_reads_is_listed() {
        assert!(super::hooks().count() > 50);
        // `key` asserts: the empty hash reads every top-level key, each hook the ones nested under it
        Game::new(1).preview("");
        for h in super::hooks() {
            Game::new(1).preview(h);
        }
    }
}
