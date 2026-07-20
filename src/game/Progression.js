// The whole point of the game, straight from the game designers (ages 6 & 8):
// paper → wood → copper → stone → iron → steel → titanium → diamond → BEDROCK.
// `cost` is the XP you spend to upgrade INTO that tier from the one before it.
// (Yes, diamond→bedrock really is only 100 XP — bedrock is a bargain. Design
// decision by the designers; change one number here if they change their minds.)
export const TIERS = [
  { key: 'paper',    name: 'Paper',    cost: 0,   color: 0xf3ecd2, accent: 0xd9cfa8, dmg: 6,  guard: 0.00, emissive: 0x000000 },
  { key: 'wood',     name: 'Wood',     cost: 25,  color: 0x8b5a2b, accent: 0x5e3a17, dmg: 9,  guard: 0.08, emissive: 0x000000 },
  { key: 'copper',   name: 'Copper',   cost: 50,  color: 0xc47f3a, accent: 0x8f5420, dmg: 13, guard: 0.14, emissive: 0x000000 },
  { key: 'stone',    name: 'Stone',    cost: 150, color: 0x8d8d94, accent: 0x5d5d63, dmg: 17, guard: 0.20, emissive: 0x000000 },
  { key: 'iron',     name: 'Iron',     cost: 200, color: 0xd8dae2, accent: 0x9a9dab, dmg: 22, guard: 0.27, emissive: 0x000000 },
  { key: 'steel',    name: 'Steel',    cost: 300, color: 0xaebdd4, accent: 0x6f819e, dmg: 28, guard: 0.34, emissive: 0x000000 },
  { key: 'titanium', name: 'Titanium', cost: 500, color: 0xc9d4dd, accent: 0x4a5a66, dmg: 35, guard: 0.42, emissive: 0x112233 },
  { key: 'diamond',  name: 'Diamond',  cost: 800, color: 0x8ef0ff, accent: 0x2cc6e8, dmg: 45, guard: 0.50, emissive: 0x0a4a5a },
  { key: 'bedrock',  name: 'BEDROCK',  cost: 100, color: 0x3a3244, accent: 0x181321, dmg: 60, guard: 0.60, emissive: 0x5a1fa8 },
];

export const MAX_TIER = TIERS.length - 1;

// Tracks XP wallet plus the current sword/armor tiers. Armor upgrades cost
// exactly the same XP as the matching sword material (designer requirement).
export class Progression {
  constructor() {
    this.xp = 0;
    this.swordTier = 0;
    this.armorTier = 0;
    this.onChange = null; // () => void, for the HUD
  }

  addXP(amount) {
    this.xp += amount;
    this.onChange?.();
  }

  nextCost(kind) {
    const tier = kind === 'sword' ? this.swordTier : this.armorTier;
    if (tier >= MAX_TIER) return null;
    return TIERS[tier + 1].cost;
  }

  canUpgrade(kind) {
    const cost = this.nextCost(kind);
    return cost !== null && this.xp >= cost;
  }

  upgrade(kind) {
    if (!this.canUpgrade(kind)) return false;
    const cost = this.nextCost(kind);
    this.xp -= cost;
    if (kind === 'sword') this.swordTier += 1;
    else this.armorTier += 1;
    this.onChange?.();
    return true;
  }

  get swordDamage() { return TIERS[this.swordTier].dmg; }
  get damageReduction() { return TIERS[this.armorTier].guard; }
}
