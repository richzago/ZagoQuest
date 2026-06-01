import { SkillType } from "../../shared/enums/skillType.enum";
import { SkillConfig } from "../../shared/interfaces/skill.interface";

// Configuração padrão embutida (não depende de JSON)
const defaultSkillsConfig: Record<string, SkillConfig> = {
  sword: {
    name: "Sword Fighting",
    baseLevel: 1,
    baseProgress: 0,
    gainPerUse: 0.5,
    damageBonusPerLevel: 0.02,
  },
  axe: {
    name: "Axe Fighting",
    baseLevel: 1,
    baseProgress: 0,
    gainPerUse: 0.5,
    damageBonusPerLevel: 0.02,
  },
  club: {
    name: "Club Fighting",
    baseLevel: 1,
    baseProgress: 0,
    gainPerUse: 0.5,
    damageBonusPerLevel: 0.02,
  },
  distance: {
    name: "Distance Fighting",
    baseLevel: 1,
    baseProgress: 0,
    gainPerUse: 0.5,
    damageBonusPerLevel: 0.02,
    hitChanceBonusPerLevel: 0.01,
  },
  shielding: {
    name: "Shielding",
    baseLevel: 1,
    baseProgress: 0,
    gainPerUse: 0.3,
    defenseBonusPerLevel: 0.02,
  },
  magicLevel: {
    name: "Magic Level",
    baseLevel: 0,
    baseProgress: 0,
    gainPerUse: 0.2,
    spellDamageBonusPerLevel: 0.03,
  },
  fishing: {
    name: "Fishing",
    baseLevel: 1,
    baseProgress: 0,
    gainPerUse: 0.5,
  },
};

export const SkillConfigs: Record<SkillType, SkillConfig> = {
  [SkillType.SWORD]: defaultSkillsConfig.sword,
  [SkillType.AXE]: defaultSkillsConfig.axe,
  [SkillType.CLUB]: defaultSkillsConfig.club,
  [SkillType.DISTANCE]: defaultSkillsConfig.distance,
  [SkillType.SHIELDING]: defaultSkillsConfig.shielding,
  [SkillType.MAGIC_LEVEL]: defaultSkillsConfig.magicLevel,
  [SkillType.FISHING]: defaultSkillsConfig.fishing,
};
