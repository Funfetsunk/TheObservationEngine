export interface PolicyEffects {
  hungerDecayMultiplier: number;
  socialDecayMultiplier: number;
  wageMultiplier: number;
}

export const activePolicyEffects: PolicyEffects = {
  hungerDecayMultiplier: 1.0,
  socialDecayMultiplier: 1.0,
  wageMultiplier: 1.0,
};
