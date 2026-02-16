import { Project, Task, Trade } from '../types';

/**
 * Generates a unique key for the tasks map
 */
export const getTaskKey = (unitId: string, tradeId: string) => `${unitId}_${tradeId}`;

/**
 * Add business days (Monday-Friday only) to a date string
 */
const addBusinessDays = (dateStr: string, days: number): string => {
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  
  let remaining = days;
  while (remaining > 0) {
    date.setDate(date.getDate() + 1);
    const dayOfWeek = date.getDay();
    // Skip Saturday (6) and Sunday (0)
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      remaining--;
    }
  }
  
  return date.toISOString().split('T')[0];
};

/**
 * Subtract business days (Monday-Friday only) from a date string
 */
const subtractBusinessDays = (dateStr: string, days: number): string => {
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  
  let remaining = days;
  while (remaining > 0) {
    date.setDate(date.getDate() - 1);
    const dayOfWeek = date.getDay();
    // Skip Saturday (6) and Sunday (0)
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      remaining--;
    }
  }
  
  // Ensure result is a weekday
  const finalDay = date.getDay();
  if (finalDay === 0) {
    date.setDate(date.getDate() + 1); // Sunday -> Monday
  } else if (finalDay === 6) {
    date.setDate(date.getDate() + 2); // Saturday -> Monday
  }
  
  return date.toISOString().split('T')[0];
};

/**
 * Ensure a date falls on a weekday (Monday-Friday)
 * If it's a weekend, move to next Monday
 */
export const ensureWeekday = (dateStr: string): string => {
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  const dayOfWeek = date.getDay();
  
  if (dayOfWeek === 0) {
    // Sunday -> Monday
    date.setDate(date.getDate() + 1);
  } else if (dayOfWeek === 6) {
    // Saturday -> Monday
    date.setDate(date.getDate() + 2);
  }
  
  return date.toISOString().split('T')[0];
};

/**
 * Calculate the difference in business days between two date strings
 */
const businessDaysBetween = (date1: string, date2: string): number => {
  const [y1, m1, d1] = date1.split('-').map(Number);
  const [y2, m2, d2] = date2.split('-').map(Number);
  let start = new Date(y1, m1 - 1, d1);
  const end = new Date(y2, m2 - 1, d2);
  
  let count = 0;
  const direction = end >= start ? 1 : -1;
  
  while (start.toDateString() !== end.toDateString()) {
    start.setDate(start.getDate() + direction);
    const day = start.getDay();
    if (day !== 0 && day !== 6) {
      count += direction;
    }
  }
  
  return count;
};

/**
 * Push out linked tasks when a task's expected start date changes.
 * Enforces predecessor rule: each trade starts after the previous one ends.
 * Tasks with custom links follow their linked task instead.
 */
export const pushLinkedTasks = (
  project: Project,
  unitId: string,
  tradeId: string,
  newStartDate: string,
  tasks: Record<string, Task>
): Record<string, Task> => {
  // Find the unit's scope
  const unit = [...project.units, ...project.areas].find(u => u.id === unitId);
  if (!unit) return tasks;

  // Ensure the new date is a weekday
  const adjustedNewDate = ensureWeekday(newStartDate);

  // Get trades for this scope in order
  const scopedTrades = project.trades
    .filter(t => t.scope === unit.scope)
    .sort((a, b) => a.orderIndex - b.orderIndex);

  // Find the index of the changed trade
  const changedTradeIndex = scopedTrades.findIndex(t => t.id === tradeId);
  if (changedTradeIndex === -1) return tasks;

  const changedTrade = scopedTrades[changedTradeIndex];
  const changedTaskKey = getTaskKey(unitId, tradeId);
  const changedTask = tasks[changedTaskKey];
  const originalChangedTask = tasks[changedTaskKey];

  const newTasks = { ...tasks };

  // Calculate how many business days the changed task moved
  const daysMoved = originalChangedTask?.expectedStartDate 
    ? businessDaysBetween(originalChangedTask.expectedStartDate, adjustedNewDate)
    : 0;

  // Update the changed task first
  const updatedChangedTask: Task = {
    ...changedTask,
    expectedStartDate: adjustedNewDate,
    lastUpdated: new Date().toISOString()
  };
  
  // Also push the finish date by the same number of days
  if (changedTask.expectedFinishDate && daysMoved !== 0) {
    if (daysMoved > 0) {
      updatedChangedTask.expectedFinishDate = ensureWeekday(addBusinessDays(changedTask.expectedFinishDate, daysMoved));
    } else {
      updatedChangedTask.expectedFinishDate = ensureWeekday(subtractBusinessDays(changedTask.expectedFinishDate, Math.abs(daysMoved)));
    }
  }
  
  newTasks[changedTaskKey] = updatedChangedTask;

  // If no movement, nothing else to do
  if (daysMoved === 0) {
    return newTasks;
  }

  // Cascade through ALL subsequent trades - move by same amount
  // ONLY update tasks that already have dates - don't auto-fill empty tasks
  for (let i = changedTradeIndex + 1; i < scopedTrades.length; i++) {
    const currentTrade = scopedTrades[i];
    const currentTaskKey = getTaskKey(unitId, currentTrade.id);
    const currentTask = newTasks[currentTaskKey];
    const originalCurrentTask = tasks[currentTaskKey];

    if (!currentTask) continue;
    
    // Skip tasks that don't have a date - don't auto-fill
    if (!originalCurrentTask?.expectedStartDate) continue;

    // Skip tasks with custom links - they follow their linked task, not predecessor
    if (currentTask.linkedToTaskKey) continue;

    // Move this task by the same number of days as the changed task
    let newDate: string;
    if (daysMoved > 0) {
      newDate = ensureWeekday(addBusinessDays(originalCurrentTask.expectedStartDate, daysMoved));
    } else {
      newDate = ensureWeekday(subtractBusinessDays(originalCurrentTask.expectedStartDate, Math.abs(daysMoved)));
    }

    const updatedTask: Task = {
      ...currentTask,
      expectedStartDate: newDate,
      lastUpdated: new Date().toISOString()
    };
    
    // Also push the finish date if it exists
    if (originalCurrentTask.expectedFinishDate) {
      if (daysMoved > 0) {
        updatedTask.expectedFinishDate = ensureWeekday(addBusinessDays(originalCurrentTask.expectedFinishDate, daysMoved));
      } else {
        updatedTask.expectedFinishDate = ensureWeekday(subtractBusinessDays(originalCurrentTask.expectedFinishDate, Math.abs(daysMoved)));
      }
    }
    
    newTasks[currentTaskKey] = updatedTask;
  }

  // Now handle custom-linked tasks
  // Collect all task keys that were moved
  const movedTaskKeys = new Set<string>();
  Object.keys(newTasks).forEach(key => {
    if (newTasks[key]?.expectedStartDate !== tasks[key]?.expectedStartDate) {
      movedTaskKeys.add(key);
    }
  });

  // Find all tasks with custom links to any moved task and update them
  const customLinkedMovedKeys: string[] = [];
  Object.keys(newTasks).forEach(taskKey => {
    const task = newTasks[taskKey];
    if (task.linkedToTaskKey && movedTaskKeys.has(task.linkedToTaskKey)) {
      const linkedTask = newTasks[task.linkedToTaskKey];
      const originalLinkedTask = tasks[task.linkedToTaskKey];
      const linkedTrade = project.trades.find(t => task.linkedToTaskKey!.endsWith(`_${t.id}`));
      
      if (linkedTask?.expectedStartDate && originalLinkedTask?.expectedStartDate && task.expectedStartDate && linkedTrade) {
        // Calculate when the linked task ends
        const linkedTaskEndDate = addBusinessDays(linkedTask.expectedStartDate, linkedTrade.defaultDurationDays);
        
        // Calculate original gap between linked task END and this task start
        const originalLinkedEndDate = addBusinessDays(originalLinkedTask.expectedStartDate, linkedTrade.defaultDurationDays);
        const originalGap = businessDaysBetween(originalLinkedEndDate, task.expectedStartDate);
        
        // Apply same gap to new linked task end date
        let newDate: string;
        if (originalGap >= 0) {
          newDate = addBusinessDays(linkedTaskEndDate, originalGap);
        } else {
          // Task started before linked task ended - maintain same overlap
          newDate = subtractBusinessDays(linkedTaskEndDate, Math.abs(originalGap));
        }
        
        const originalTask = tasks[taskKey];
        const updatedLinkedTask: Task = {
          ...task,
          expectedStartDate: ensureWeekday(newDate),
          lastUpdated: new Date().toISOString()
        };
        
        // Also push the finish date if it exists
        if (originalTask?.expectedFinishDate && originalTask.expectedStartDate) {
          const finishDaysDiff = businessDaysBetween(originalTask.expectedStartDate, originalTask.expectedFinishDate);
          const newTaskDateMoved = businessDaysBetween(originalTask.expectedStartDate, ensureWeekday(newDate));
          if (newTaskDateMoved > 0) {
            updatedLinkedTask.expectedFinishDate = ensureWeekday(addBusinessDays(originalTask.expectedFinishDate, newTaskDateMoved));
          } else {
            updatedLinkedTask.expectedFinishDate = ensureWeekday(subtractBusinessDays(originalTask.expectedFinishDate, Math.abs(newTaskDateMoved)));
          }
        }
        
        newTasks[taskKey] = updatedLinkedTask;
        customLinkedMovedKeys.push(taskKey);
      }
    }
  });

  // If a custom-linked task moved, push out subsequent tasks in that unit by the same delta
  customLinkedMovedKeys.forEach(movedKey => {
    const movedTask = newTasks[movedKey];
    const originalMovedTask = tasks[movedKey];

    if (!movedTask?.expectedStartDate || !originalMovedTask?.expectedStartDate) return;

    const movedDays = businessDaysBetween(originalMovedTask.expectedStartDate, movedTask.expectedStartDate);
    if (movedDays === 0) return;

    const movedUnit = [...project.units, ...project.areas].find(u => u.id === movedTask.unitId);
    if (!movedUnit) return;

    const movedScopedTrades = project.trades
      .filter(t => t.scope === movedUnit.scope)
      .sort((a, b) => a.orderIndex - b.orderIndex);

    const movedIndex = movedScopedTrades.findIndex(t => t.id === movedTask.tradeId);
    if (movedIndex === -1) return;

    for (let i = movedIndex + 1; i < movedScopedTrades.length; i++) {
      const currentTrade = movedScopedTrades[i];
      const currentTaskKey = getTaskKey(movedTask.unitId, currentTrade.id);
      const currentTask = newTasks[currentTaskKey];
      const originalCurrentTask = tasks[currentTaskKey];

      if (!currentTask) continue;
      if (!originalCurrentTask?.expectedStartDate) continue;
      if (currentTask.linkedToTaskKey) continue;

      let newDate: string;
      if (movedDays > 0) {
        newDate = ensureWeekday(addBusinessDays(originalCurrentTask.expectedStartDate, movedDays));
      } else {
        newDate = ensureWeekday(subtractBusinessDays(originalCurrentTask.expectedStartDate, Math.abs(movedDays)));
      }

      const updatedCascadeTask: Task = {
        ...currentTask,
        expectedStartDate: newDate,
        lastUpdated: new Date().toISOString()
      };
      
      // Also push the finish date if it exists
      if (originalCurrentTask.expectedFinishDate) {
        if (movedDays > 0) {
          updatedCascadeTask.expectedFinishDate = ensureWeekday(addBusinessDays(originalCurrentTask.expectedFinishDate, movedDays));
        } else {
          updatedCascadeTask.expectedFinishDate = ensureWeekday(subtractBusinessDays(originalCurrentTask.expectedFinishDate, Math.abs(movedDays)));
        }
      }
      
      newTasks[currentTaskKey] = updatedCascadeTask;
    }
  });

  return newTasks;
};

/**
 * Checks if a specific trade for a unit should be marked as "Ready".
 * Logic:
 * A task is Ready ONLY if the immediate predecessor (within the same scope) is Complete.
 * The first trade is NOT automatically ready - it needs to be started manually.
 */
export const calculateReadiness = (
  project: Project,
  unitId: string,
  trade: Trade
): boolean => {
  const taskKey = getTaskKey(unitId, trade.id);
  const task = project.tasks[taskKey];

  // If already in-progress or done, it's not "waiting to be ready"
  if (task && (task.status === 'in-progress' || task.status === 'complete')) {
    return false;
  }

  // Filter trades to only those matching this trade's scope
  const scopedTrades = project.trades.filter(t => t.scope === trade.scope);
  
  // Find index of this trade within its scope
  const tradeIndex = scopedTrades.findIndex((t) => t.id === trade.id);
  if (tradeIndex === -1) return false;

  // First trade in scope is NOT automatically ready - user must start it manually
  if (tradeIndex === 0) {
    return false; 
  }

  // Predecessor logic - get the previous trade within the same scope
  const prevTrade = scopedTrades[tradeIndex - 1];

  const prevTaskKey = getTaskKey(unitId, prevTrade.id);
  const prevTask = project.tasks[prevTaskKey];

  return prevTask?.status === 'complete';
};

/**
 * updates the project state to reflect newly "Ready" tasks based on completions.
 * Also resets tasks that are "ready" but shouldn't be anymore.
 */
export const updateReadinessState = (project: Project): Project => {
  const newTasks = { ...project.tasks };
  let hasChanges = false;

  const allUnits = [...project.units, ...project.areas];

  allUnits.forEach(unit => {
    project.trades
      .filter(t => t.scope === unit.scope)
      .forEach(trade => {
        const isReady = calculateReadiness(project, unit.id, trade);
        const key = getTaskKey(unit.id, trade.id);
        const currentTask = newTasks[key];

        if (isReady && currentTask.status === 'not-started') {
           newTasks[key] = {
             ...currentTask,
             status: 'ready',
             lastUpdated: new Date().toISOString()
           };
           hasChanges = true;
        }
        
        // Reset ready status if task no longer qualifies
        if (!isReady && currentTask.status === 'ready') {
           newTasks[key] = {
             ...currentTask,
             status: 'not-started',
             lastUpdated: new Date().toISOString()
           };
           hasChanges = true;
        }
    });
  });

  if (!hasChanges) return project;

  return {
    ...project,
    tasks: newTasks
  };
};