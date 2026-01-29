import { Trade } from './types';

export const INTERIOR_TRADES_TEMPLATE: Omit<Trade, 'id' | 'orderIndex'>[] = [
  { name: 'Framing', scope: 'interior', defaultDurationDays: 5 },
  { name: 'Plumbing', scope: 'interior', defaultDurationDays: 3 },
  { name: 'Electrical', scope: 'interior', defaultDurationDays: 3 },
  { name: 'HVAC', scope: 'interior', defaultDurationDays: 3 },
  { name: 'Fire Alarm System', scope: 'interior', defaultDurationDays: 2 },
  { name: 'Insulation', scope: 'interior', defaultDurationDays: 2 },
  { name: 'Drywall', scope: 'interior', defaultDurationDays: 5 },
  { name: 'Gypsum', scope: 'interior', defaultDurationDays: 3 },
  { name: 'Interior Trim', scope: 'interior', defaultDurationDays: 3 },
  { name: 'Paint', scope: 'interior', defaultDurationDays: 3 },
  { name: 'Cabinets', scope: 'interior', defaultDurationDays: 2 },
  { name: 'Flooring', scope: 'interior', defaultDurationDays: 3 },
  { name: 'Finish Trim', scope: 'interior', defaultDurationDays: 2 },
  { name: 'Finish Painting', scope: 'interior', defaultDurationDays: 2 },
  { name: 'Countertops', scope: 'interior', defaultDurationDays: 1 },
  { name: 'Finish Electrical', scope: 'interior', defaultDurationDays: 2 },
  { name: 'Finish Plumbing', scope: 'interior', defaultDurationDays: 2 },
  { name: 'Finish HVAC', scope: 'interior', defaultDurationDays: 2 },
  { name: 'Install Hardware', scope: 'interior', defaultDurationDays: 1 },
  { name: 'Punch List', scope: 'interior', defaultDurationDays: 3 },
  { name: 'Final Clean', scope: 'interior', defaultDurationDays: 1 },
];

export const EXTERIOR_TRADES_TEMPLATE: Omit<Trade, 'id' | 'orderIndex'>[] = [
  { name: 'Concrete', scope: 'exterior', defaultDurationDays: 10 },
  { name: 'Framing (Ext)', scope: 'exterior', defaultDurationDays: 7 },
  { name: 'Sheathing', scope: 'exterior', defaultDurationDays: 3 },
  { name: 'WRB / Air Barrier', scope: 'exterior', defaultDurationDays: 3 },
  { name: 'Windows', scope: 'exterior', defaultDurationDays: 5 },
  { name: 'Siding', scope: 'exterior', defaultDurationDays: 10 },
  { name: 'Roofing', scope: 'exterior', defaultDurationDays: 7 },
  { name: 'Ext Paint', scope: 'exterior', defaultDurationDays: 5 },
  { name: 'Gutters', scope: 'exterior', defaultDurationDays: 2 },
  { name: 'Scaffold Drop', scope: 'exterior', defaultDurationDays: 2 },
];

export const STATUS_COLORS = {
  'not-started': 'bg-slate-100 text-slate-400 border-slate-200',
  'ready': 'bg-blue-100 text-blue-700 border-blue-300 font-semibold ring-1 ring-blue-300',
  'in-progress': 'bg-amber-100 text-amber-800 border-amber-300 ring-1 ring-amber-300',
  'complete': 'bg-emerald-100 text-emerald-700 border-emerald-300',
};

export const STATUS_LABELS = {
  'not-started': 'Pending',
  'ready': 'Ready',
  'in-progress': 'Working',
  'complete': 'Done',
};