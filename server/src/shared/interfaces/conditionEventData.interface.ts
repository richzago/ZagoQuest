/**
 * conditionEventData.interface.ts
 *
 * Estruturas de dados dos eventos relacionados a condições.
 *
 * @module shared/interfaces/ConditionEventData
 */

import { DamageType } from "../enums/damageType.enum";

export interface ConditionAppliedEventData {
  targetId: string;
  targetName: string;
  conditionId: string;
  conditionName: string;
  duration: number;
  sourceId?: string;
  sourceName?: string;
}

export interface ConditionRemovedEventData {
  targetId: string;
  targetName: string;
  conditionId: string;
  conditionName: string;
  sourceId?: string;
  sourceName?: string;
}

export interface ConditionTickEventData {
  targetId: string;
  targetName: string;
  conditionId: string;
  conditionName: string;
  damage?: number;
  damageType?: DamageType;
  tickNumber?: number;
}
