//! Each world's palettes: game.js's `TONES` after `useWorld(w)`, its cloud sea, and the extra tones `W2L` worlds read
//! straight off their entry.

#[derive(Clone, Debug)]
pub struct Tones {
    pub grass: Vec<u32>,
    pub road: Vec<u32>,
    pub dome: Vec<u32>,
    pub band: Vec<u32>,
    pub leaf: Vec<u32>,
    pub trunk: Vec<u32>,
    pub stone: Vec<u32>,
    pub orb: Vec<u32>,
    pub glass: Vec<u32>,
    pub dragon: Vec<u32>,
    pub belly: Vec<u32>,
    pub dorb: Vec<u32>,
    pub bean: Vec<u32>,
    pub hull: Vec<u32>,
    pub cc: Vec<u32>,
    pub pane: Vec<u32>,
    pub peach: Vec<u32>,
    pub aqua: Vec<u32>,
    /// `W2L` extras: the lookout's underside, yardrat's spots and dots, the kais' pink grass and flowers
    pub under: Vec<u32>,
    pub spot: Vec<u32>,
    pub pinkg: Vec<u32>,
    pub dot: Vec<u32>,
    pub flower: Vec<u32>,
    pub sea: Vec<u32>,
}

fn v(a: &[u32]) -> Vec<u32> {
    a.to_vec()
}

pub fn kai() -> Tones {
    Tones {
        grass: v(&[0x2f7a26, 0x3f9330, 0x57ad3c, 0x78c64a, 0xa6de66, 0xd2f28e]),
        road: v(&[0xcfc8b6, 0xe6e1d4, 0xf6f3ec, 0xffffff]),
        dome: v(&[0x8a3418, 0xc04e26, 0xe8703a, 0xf6985a, 0xffc896]),
        band: v(&[0x9a8a6a, 0xcbbd98, 0xe9dcb8, 0xfff6e0]),
        leaf: v(&[0x1a4f1e, 0x2a7229, 0x429a36, 0x63bb46, 0x9edc68]),
        trunk: v(&[0x3d2414, 0x5a3720, 0x7a4d2b, 0x9a6640]),
        stone: v(&[0x4a4c56, 0x6c6f7c, 0x9497a4, 0xc2c5cf]),
        orb: v(&[0xff9a2a, 0xffc04a, 0xffe08a, 0xfff6d0, 0xffffff]),
        glass: v(&[0x2a5a8a, 0x5aa0d8, 0x9fdcff, 0xe6f6ff]),
        dragon: v(&[0x0c3418, 0x1a5e26, 0x2a8a36, 0x4cb84c, 0x9be27a]),
        belly: v(&[0x9a7a3a, 0xd2b060, 0xf2d48a, 0xfff0c0]),
        dorb: v(&[0xc4561a, 0xee7a1e, 0xffa63a, 0xffd27a, 0xfff2cc]),
        bean: v(&[0x2e6b22, 0x4a9a32, 0x76c64a, 0xb6ea7a]),
        hull: v(&[0xa8a49a, 0xccc8bc, 0xe8e4d8, 0xf8f6ee, 0xffffff]),
        cc: v(&[0x10306a, 0x1a4a9a, 0x2a6ac8, 0x4a8ae0]),
        pane: v(&[0x16244a, 0x24406e, 0x3a6aa0, 0x8ac0ec]),
        peach: v(&[0xb8642a, 0xe0884a, 0xf4ac72, 0xffd2a8]),
        aqua: v(&[0x2a7a8a, 0x40a0b0, 0x6ac8d0, 0xb0ecee]),
        under: vec![],
        spot: vec![],
        pinkg: vec![],
        dot: vec![],
        flower: vec![],
        sea: v(&[0xe2a93a, 0xf3c55a, 0xf9dd8c, 0xfff2c8]),
    }
}

const SKY_SEA: [u32; 4] = [0xd2dce8, 0xe6edf5, 0xf4f8fc, 0xffffff];
const W2P_GOLD: [u32; 4] = [0x8a5a10, 0xc08a1a, 0xe8b830, 0xffe07a];
const W2P_PINK: [u32; 5] = [0x9a3a6a, 0xc85a8e, 0xe88ab0, 0xf8bcd4, 0xffe4ee];
pub const W2P: (&[u32], &[u32]) = (&W2P_GOLD, &W2P_PINK);

/// The tournament of power's look (`TOP_LOOK`).
pub mod top {
    pub const TILE: f64 = 0.19;
    pub const TILES: [u32; 6] = [0x5e6078, 0x80849c, 0xa6aabe, 0xc8ccda, 0xe2e4ee, 0xf8f8fc];
    pub const TRIM: [u32; 4] = [0x3a3e66, 0x50578a, 0x6c76b0, 0x96a2d6];
    pub const BG: [u32; 3] = [0x0c0618, 0x1c0c34, 0x2e1450];
    pub const NEB: [u32; 3] = [0x3e1a6a, 0x5a2a8e, 0x8a4ac0];
    pub const ROCK: [u32; 4] = [0x140c22, 0x2a1e40, 0x443660, 0x66568a];
    pub const RIM: u32 = 0xa898d8;
    pub const STAR: [u32; 2] = [0xffffff, 0xd8c8ff];
}

/// `TONES` once `useWorld(w)` has run.
pub fn tones(w: u32) -> Tones {
    let mut t = kai();
    match w {
        1 => {
            t.grass = v(&[0x1f6a5a, 0x2a8a72, 0x3fa88a, 0x62c4a0, 0x96deb8, 0xc8f2d8]);
            t.road = v(&[0xc9cdb8, 0xdfe2d0, 0xf0f2e6, 0xffffff]);
            t.dome = v(&[0x8f9aa0, 0xbcc6ca, 0xdfe6e8, 0xf4f8f8, 0xffffff]);
            t.band = v(&[0x8a9aa0, 0xb4c2c6, 0xd6e0e2, 0xf0f6f6]);
            t.glass = v(&[0x1c3a4a, 0x2a5a6a, 0x4a8a9a, 0x9adada]);
            t.leaf = v(&[0x1c4a5e, 0x245f78, 0x2f7f98, 0x4aa2b8, 0x86cfe0]);
            t.trunk = v(&[0x5a5a40, 0x7a7a58, 0x9a9a74, 0xbebe96]);
            t.sea = v(&[0x1e7a7a, 0x2fa59a, 0x6cd1bf, 0xc6f2e6]);
        }
        2 => {
            t.grass = v(&[0x6a2414, 0x8a341c, 0xa84a26, 0xc46632, 0xdc8848, 0xf0b070]);
            t.road = v(&[0x4a3020, 0x6a4a34, 0x8a6a4e, 0xac8e70]);
            t.dome = v(&[0x8e8a8a, 0xb2aeae, 0xd2cece, 0xeceaea, 0xffffff]);
            t.band = v(&[0x9a7414, 0xc8961e, 0xe8bc3a, 0xffe08a]);
            t.glass = v(&[0x3a1418, 0x6a2028, 0xa83a3a, 0xe86a5a]);
            t.stone = v(&[0x4a2418, 0x6a3422, 0x8a4a30, 0xaa6644]);
            t.leaf = v(&[0x3a1612, 0x5a2218, 0x7a3220, 0x9a4a2c, 0xc06a40]);
            t.trunk = v(&[0x2a1410, 0x3a1c14, 0x4a2618, 0x5a3020]);
            t.sea = v(&[0xa03a1c, 0xc85a2c, 0xe88a4a, 0xfcc080]);
        }
        3 => t.sea = v(&[0xc8642a, 0xe08a3a, 0xf4b45a, 0xfde0a0]),
        4 => {
            t.grass = v(&[0x2a1f5a, 0x3a2a7a, 0x4e3a9a, 0x6a52b8, 0x8f78d2, 0xbcaaec]);
            t.road = v(&[0x8a7aa8, 0xa898c4, 0xc6b8dc, 0xe4dcf2]);
            t.dome = v(&[0x6a6478, 0x8a8498, 0xaaa4b8, 0xcac6d6, 0xeceaf2]);
            t.band = v(&[0x4a4458, 0x6a6478, 0x8a8498, 0xaaa4b8]);
            t.leaf = v(&[0x6a1a5a, 0x8a2a78, 0xb04a9a, 0xd47abc, 0xf0b4e0]);
            t.trunk = v(&[0x1a4a4a, 0x226060, 0x2e7a7a, 0x46a0a0]);
            t.sea = v(&[0x4a2a7a, 0x6a3ea0, 0x9a6ad0, 0xd8c0f0]);
        }
        5 => {
            t.grass = v(&[0x2a6a2a, 0x3a8a34, 0x52a83e, 0x72c450, 0x9ade6e, 0xcaf29a]);
            t.road = v(&[0x3a3c44, 0x50525c, 0x686a76, 0x8a8c98]);
            t.dome = v(&[0xb8b0a0, 0xd8d0c0, 0xece6d8, 0xf8f4ec, 0xffffff]);
            t.band = v(&[0xb88a1a, 0xd8a82a, 0xf2c84a, 0xffe08a]);
            t.glass = v(&[0x1c3a6a, 0x2a5a9a, 0x4a8ad0, 0x9fd0ff]);
            t.sea = v(&SKY_SEA);
        }
        6 => {
            t.grass = v(&[0x123e86, 0x1a52a2, 0x2268bc, 0x2e80d0, 0x4a9ee0, 0x7cc0ee]);
            t.glass = v(&[0x1a7aa8, 0x2a9ac0, 0x48bcd2, 0x7adae0, 0xb8f0ec]);
            t.road = v(&[0xc8a464, 0xe0c080, 0xf0d89c, 0xfaecc4, 0xfff8e4]);
            t.band = v(&[0x9a7a48, 0xb8945a, 0xcfac70, 0xe2c488]);
            t.leaf = v(&[0x174a22, 0x23692c, 0x338a36, 0x52ac44, 0x8ad466]);
            t.trunk = v(&[0x5a3a1c, 0x7a5228, 0x9a6c36, 0xbe8e4e]);
            t.stone = v(&[0x5a5048, 0x7a7068, 0x9e968a, 0xc8c0b2]);
            t.sea = v(&SKY_SEA);
        }
        7 => {
            t.grass = v(&[0x1c5a22, 0x26722a, 0x348c32, 0x4aa63c, 0x72c454, 0xa8e080]);
            t.road = v(&[0x8a6a44, 0xa8885a, 0xc6a676, 0xe2c89a]);
            t.dome = v(&[0xa8a49a, 0xccc8bc, 0xe8e4d8, 0xf8f6ee, 0xffffff]);
            t.band = v(&[0x7a2a18, 0xa83e22, 0xd05a30, 0xee8a54]);
            t.glass = v(&[0x1c3a5a, 0x2a5a8a, 0x5a9ad0, 0xb0e0ff]);
            t.leaf = v(&[0x0e3a18, 0x185a22, 0x24782c, 0x3a983a, 0x6ab852]);
            t.trunk = v(&[0x3a2414, 0x553620, 0x74502e, 0x94683e]);
            t.stone = v(&[0x3e4a4a, 0x5e6c68, 0x84928a, 0xb0bcb0, 0xd8e0d4]);
            t.sea = v(&SKY_SEA);
        }
        8 => {
            t.grass = v(&[0x1e2228, 0x2a3038, 0x384048, 0x4a525a, 0x5e666e, 0x767e86]);
            t.road = v(&[0x14161a, 0x1e2226, 0x2a2e34, 0x3a4048]);
            t.dome = v(&[0x3a4048, 0x545a62, 0x6e747c, 0x8a9098, 0xa8aeb4]);
            t.band = v(&[0x22262c, 0x30343c, 0x40464e, 0x545a62]);
            t.glass = v(&[0x1a1a22, 0x2a2a36, 0x4a4a5a, 0x8a8aa0]);
            t.leaf = v(&[0x22262a, 0x30343a, 0x40464c, 0x545a60, 0x6a7076]);
            t.trunk = v(&[0x1a1412, 0x2e221c, 0x4a3022, 0x6a4028]);
            t.stone = v(&[0x2e3238, 0x464c54, 0x60666e, 0x7e848c]);
            t.sea = v(&[0x1e242c, 0x323a44, 0x4e5864, 0x7a8692]);
        }
        9 => {
            t.grass = v(&top::TILES);
            t.road = v(&top::TRIM);
            t.stone = v(&top::TILES[1..5]);
            t.leaf = v(&top::ROCK);
            t.sea = v(&top::BG);
        }
        10 => {
            t.grass = v(&[0x8a92b0, 0xaab2cc, 0xc8cee2, 0xe2e6f2, 0xf4f6fc, 0xffffff]);
            t.road = v(&[0x5a6a9a, 0x7686b6, 0x96a4cc, 0xbac4e2]);
            t.stone = v(&[0x5a6a9a, 0x7686b6, 0x96a4cc, 0xbac4e2]);
            t.under = v(&[0x6a4a24, 0x8e6a38, 0xb08c50, 0xcaa86a, 0xe2c88e]);
            t.dome = v(&[0x9aa4b4, 0xc4ccd8, 0xe6eaf0, 0xf8fafc, 0xffffff]);
            t.band = v(&[0x2a3a8a, 0x3a52b0, 0x5a74d0, 0x8aa4ec]);
            t.glass = v(&[0x1c2a4a, 0x2a4070, 0x4a6aa0, 0x9ab8e0]);
            t.leaf = v(&[0x124a3a, 0x1c6a4a, 0x2a8a56, 0x48ac64, 0x84d080]);
            t.trunk = v(&[0x5a3a1c, 0x7a5228, 0x9a6c36, 0xbe8e4e]);
            t.sea = v(&SKY_SEA);
        }
        11 => {
            t.grass = v(&[0x1e6a2a, 0x2c8a34, 0x44a840, 0x66c450, 0x92dc6e, 0xc4f09a]);
            t.road = v(&[0x9a7a4a, 0xb8986a, 0xd4b88a, 0xead6ae]);
            t.leaf = v(&[0x1a5a2a, 0x24783a, 0x34984a, 0x52b85a, 0x8ad87a]);
            t.trunk = v(&[0x5a3a24, 0x7a5232, 0x9a6c44, 0xbc8e5e]);
            t.stone = v(&[0x5a5a62, 0x7a7a84, 0x9e9ea6, 0xc4c4ca]);
            t.pinkg = v(&W2P_PINK);
            t.flower = v(&[0xff9ac8, 0xffffff]);
            t.sea = v(&[0xd89ab8, 0xeab6cc, 0xf6d4e2, 0xfff0f6]);
        }
        12 => {
            t.grass = v(&[0x8a7aa8, 0xa898c2, 0xc4b6da, 0xdcd0ec, 0xeee6f6, 0xfaf6fe]);
            t.road = v(&[0xc89ab0, 0xdcb4c6, 0xecd0dc, 0xf8e8f0]);
            t.spot = v(&[0x7a6a9a, 0x8e7eae, 0xa494c2, 0xbaaad6]);
            t.leaf = v(&[0x5a8ac8, 0x7aa6dc, 0x9ec2ee, 0xc4dcf8, 0xe8f2ff]);
            t.trunk = v(&[0x9a7aa8, 0xb496c2, 0xceb4da, 0xe6d2ee]);
            t.dome = v(&[0xa898b8, 0xc8b8d6, 0xe2d6ee, 0xf4eefa, 0xffffff]);
            t.band = v(&[0x6a5a8a, 0x8a7aaa, 0xaa9ac8, 0xcabce2]);
            t.dot = v(&[0xffffff, 0xfff0f8]);
            t.sea = v(&[0xc89ab8, 0xdab4cc, 0xeacede, 0xfaeaf2]);
        }
        _ => {}
    }
    t
}

/// Worlds with their own look in `W2L` (planet vegeta, the lookout, the kais' world, yardrat).
pub fn is_w2(w: u32) -> bool {
    matches!(w, 2 | 10 | 11 | 12)
}

/// janemba's jelly world (`JELLY`): candy-pink ground, mint roads, gummy trees.
pub fn jelly() -> Tones {
    let mut t = kai();
    t.grass = v(&[0xb83a8a, 0xd8569e, 0xf07ab8, 0xff9ccc, 0xffc0de, 0xffe2f0]);
    t.road = v(&[0x5ac8a8, 0x7ae0c0, 0xa6f2d8, 0xdafff0]);
    t.dome = v(&[0x7a4ac8, 0x9a6ae0, 0xb890f0, 0xd6b8ff, 0xf0e2ff]);
    t.band = v(&[0xe0a020, 0xf2c040, 0xffdc6a, 0xfff2b0]);
    t.leaf = v(&[0x2a9a3a, 0x48c050, 0x78e070, 0xa8f498, 0xdaffc8]);
    t.trunk = v(&[0xc82a3a, 0xf6f0f0, 0xc82a3a, 0xf6f0f0]);
    t.stone = v(&[0x6a3a9a, 0x8a5ab8, 0xac80d8, 0xd0b0f2]);
    t.glass = v(&[0x2a8ae0, 0x5ab0f2, 0x9ad6ff, 0xdaf2ff]);
    t
}
