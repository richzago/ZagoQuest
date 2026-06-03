/**
 * conditionEventData.interface.ts
 *
 * Estruturas de dados dos eventos relacionados a condições.
 *
 * @module shared/interfaces/ConditionEventData
 */

import { DamageType } from "../enums/damageType.enum";

export interface ConditionAppliedEventData {
  targetId: number;
  targetName: string;
  conditionId: string;
  conditionName: string;
  duration: number;
  sourceId?: number;
  sourceName?: string;
}

export interface ConditionRemovedEventData {
  targetId: number;
  targetName: string;
  conditionId: string;
  conditionName: string;
  sourceId?: number;
  sourceName?: string;
}

export interface ConditionTickEventData {
  targetId: number;
  targetName: string;
  conditionId: string;
  conditionName: string;
  damage?: number;
  damageType?: DamageType;
  tickNumber?: number;
}
