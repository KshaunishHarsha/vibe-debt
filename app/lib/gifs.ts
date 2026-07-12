// Curated + URL-verified Giphy set. Picked deterministically per repo so a
// result page always shows the same GIF (stable screenshots).
const G = (id: string) => `https://media.giphy.com/media/${id}/giphy.gif`;

export const TIER_GIFS: Record<string, string[]> = {
  Raw: [G("3o7abKhOpu0NwenH3O"), G("xT5LMHxhOfscxPfIfm")], // spongebob thumbs / homer whoo-hoo
  Rare: [G("26tPplGWjN0xLybiU")], // bart celebrating
  Medium: [G("13FrpeVH09Zrb2")], // peter griffin vs the CSS blinds
  "Well-Done": [G("l2JehQ2GitHGdVG9y"), G("3o6Zt6ML6BklcajjsA")], // homer whimpering / "erase disk?"
  Burnt: [G("QMHoU66sBXqqLqYvGO")], // this is fine
};

export const LOADING_GIFS = [
  G("l0IylOPCNkiqOgMyA"), // pepe silvia conspiracy board
  G("3orieUe6ejxSFxYCXe"), // simpsons magnifying glass a-ha
  G("5xtDarmwsuR9sDRObyU"), // the office panic table
];

export const FAILED_GIF = G("YyKPbc5OOTSQE"); // glitchy 404

export function pickTierGif(tier: string, seed: string): string {
  const pool = TIER_GIFS[tier] ?? TIER_GIFS.Medium;
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return pool[h % pool.length];
}
