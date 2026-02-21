import { Project, Trade, Unit, Area, Task } from '../types';
import { getTaskKey } from './logic';

/**
 * Export project to CSV format matching PDF layout
 */
export const exportProjectMatrixToCSV = (project: Project): void => {
  const dayAbbr = ['sun', 'mon', 'tues', 'wed', 'thurs', 'fri', 'sat'];
  
  // Create header section
  let csv = `${escapeCSV(project.name)}\n`;
  csv += `Address: ${escapeCSV(project.address)}\n`;
  
  if (project.projectedCompletionDate) {
    csv += `Target Completion: ${project.projectedCompletionDate}\n`;
  }
  
  // Calculate statistics
  const tasks = Object.values(project.tasks);
  const ready = tasks.filter(t => t.status === 'ready').length;
  const progress = tasks.filter(t => t.status === 'in-progress').length;
  const done = tasks.filter(t => t.status === 'complete').length;
  const total = tasks.length;
  const percent = total > 0 ? Math.round((done / total) * 100) : 0;
  
  csv += `Overall Progress: ${percent}% | Ready: ${ready} | In Progress: ${progress} | Complete: ${done}\n`;
  csv += '\n';
  
  // Interior Matrix
  csv += 'INTERIOR MATRIX\n';
  const interiorTrades = project.trades.filter(t => t.scope === 'interior');
  
  // Header row
  csv += ['Unit', ...interiorTrades.map(t => escapeCSV(t.name))].join(',') + '\n';
  
  // Data rows
  project.units.forEach(unit => {
    const row: string[] = [escapeCSV(unit.name)];
    
    interiorTrades.forEach(trade => {
      const key = getTaskKey(unit.id, trade.id);
      const task = project.tasks[key];
      
      let cellText = '';
      
      if (task) {
        // Helper to parse date string (YYYY-MM-DD) without timezone issues
        const parseDate = (dateStr: string): Date | null => {
          const parts = dateStr.split('-');
          if (parts.length === 3) {
            const y = parseInt(parts[0], 10);
            const m = parseInt(parts[1], 10);
            const d = parseInt(parts[2], 10);
            return new Date(y, m - 1, d);
          }
          return null;
        };
        
        // Format start date
        let startStr = '';
        if (task.expectedStartDate) {
          const dateObj = parseDate(task.expectedStartDate);
          if (dateObj) {
            startStr = `${dateObj.getMonth() + 1}/${dateObj.getDate()} ${dayAbbr[dateObj.getDay()]}`;
          }
        }
        
        // Format finish date
        let finishStr = '';
        if (task.expectedFinishDate) {
          const dateObj = parseDate(task.expectedFinishDate);
          if (dateObj) {
            finishStr = `${dateObj.getMonth() + 1}/${dateObj.getDate()} ${dayAbbr[dateObj.getDay()]}`;
          }
        }
        
        // Build cell content based on status
        if (task.status === 'complete') {
          if (task.completedDate) {
            const d = new Date(task.completedDate);
            cellText = `Done ${d.getMonth() + 1}/${d.getDate()}`;
          } else {
            cellText = 'DONE';
          }
        } else if (task.status === 'in-progress') {
          cellText = `Work ${task.percentComplete || 0}%`;
          if (startStr && finishStr) {
            cellText += ` | S: ${startStr} | F: ${finishStr}`;
          } else if (startStr) {
            cellText += ` | S: ${startStr}`;
          }
        } else if (task.status === 'ready') {
          cellText = 'READY';
          if (startStr && finishStr) {
            cellText += ` | S: ${startStr} | F: ${finishStr}`;
          } else if (startStr) {
            cellText += ` | S: ${startStr}`;
          }
        } else if (task.status === 'not-started') {
          if (startStr && finishStr) {
            cellText = `S: ${startStr} | F: ${finishStr}`;
          } else if (startStr) {
            cellText = `S: ${startStr}`;
          }
        }
      }
      
      row.push(escapeCSV(cellText));
    });
    
    csv += row.join(',') + '\n';
  });
  
  // Trigger download
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', `${project.name.replace(/[^a-z0-9]/gi, '_')}_matrix.csv`);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

/**
 * Export project to CSV format (Excel-compatible) - LEGACY VERSION
 */
export const exportProjectToCSV = (project: Project): void => {
  // Create metadata section
  let csv = 'SHEDULER PROJECT EXPORT\n';
  csv += `Project Name,${escapeCSV(project.name)}\n`;
  csv += `Address,${escapeCSV(project.address)}\n`;
  csv += `Projected Completion,${project.projectedCompletionDate || ''}\n`;
  csv += `Total Buildings,${project.totalBuildings}\n`;
  csv += '\n';

  // Trades section
  csv += 'TRADES\n';
  csv += 'Trade Name,Scope,Order Index,Default Duration (Days)\n';
  project.trades.forEach(trade => {
    csv += `${escapeCSV(trade.name)},${trade.scope},${trade.orderIndex},${trade.defaultDurationDays}\n`;
  });
  csv += '\n';

  // Units section
  csv += 'UNITS\n';
  csv += 'Unit Name,Building,Scope\n';
  project.units.forEach(unit => {
    csv += `${escapeCSV(unit.name)},${escapeCSV(unit.building)},${unit.scope}\n`;
  });
  csv += '\n';

  // Areas section
  csv += 'AREAS\n';
  csv += 'Area Name,Building,Scope\n';
  project.areas.forEach(area => {
    csv += `${escapeCSV(area.name)},${escapeCSV(area.building)},${area.scope}\n`;
  });
  csv += '\n';

  // Interior Matrix (Unit x Trades)
  csv += 'INTERIOR MATRIX\n';
  const interiorTrades = project.trades.filter(t => t.scope === 'interior');
  csv += ['Unit', ...interiorTrades.map(t => escapeCSV(t.name))].join(',') + '\n';
  project.units.forEach(unit => {
    const row: string[] = [escapeCSV(unit.name)];
    interiorTrades.forEach(trade => {
      const key = getTaskKey(unit.id, trade.id);
      const task = project.tasks[key];
      row.push(task?.expectedStartDate || '');
    });
    csv += row.join(',') + '\n';
  });

  // Download the file
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', `${project.name.replace(/[^a-z0-9]/gi, '_')}_export.csv`);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

/**
 * Parse CSV file and create a project
 */
export const importProjectFromCSV = async (file: File): Promise<Project> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      try {
        const text = e.target?.result as string;
        if (!text || text.trim().length === 0) {
          reject(new Error('File is empty'));
          return;
        }
        const project = parseCSVToProject(text);
        if (!project.trades.length && !project.units.length) {
          reject(new Error('No trades or units found in the file. Please check the format.'));
          return;
        }
        resolve(project);
      } catch (error) {
        reject(error);
      }
    };
    
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsText(file);
  });
};

/**
 * Parse CSV content into a Project object
 */
const parseCSVToProject = (csvText: string): Project => {
  // Handle different line endings (Windows vs Mac/Linux)
  const lines = csvText.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n').map(line => line.trim()).filter(line => line);
  
  let projectName = 'Imported Project';
  let address = '';
  let projectedDate = '';
  let totalBuildings = 1;
  const trades: Trade[] = [];
  const units: Unit[] = [];
  const areas: Area[] = [];
  const tasks: Record<string, Task> = {};

  let section = '';
  let tradeHeaders: string[] = [];
  let matrixScope: 'interior' | 'exterior' | null = null;
  const matrixTradeOrder: Record<'interior' | 'exterior', string[]> = {
    interior: [],
    exterior: []
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const cells = parseCSVLine(line);
    
    // Detect sections (case insensitive and handle variations)
    const upperLine = line.toUpperCase();
    if (upperLine.includes('SHEDULER PROJECT EXPORT') || upperLine.includes('PROJECT EXPORT')) {
      section = 'metadata';
      continue;
    }
    if (upperLine === 'TRADES' || upperLine.startsWith('TRADES,')) {
      section = 'trades';
      continue;
    }
    if (upperLine === 'UNITS' || upperLine.startsWith('UNITS,')) {
      section = 'units';
      continue;
    }
    if (upperLine === 'AREAS' || upperLine.startsWith('AREAS,')) {
      section = 'areas';
      continue;
    }
    if (upperLine.includes('INTERIOR MATRIX')) {
      section = 'matrix';
      matrixScope = 'interior';
      continue;
    }
    if (upperLine.includes('EXTERIOR MATRIX')) {
      section = 'matrix';
      matrixScope = 'exterior';
      continue;
    }
    if (upperLine === 'TASKS' || upperLine.startsWith('TASKS,')) {
      section = 'tasks';
      continue;
    }

    // Skip header rows (case insensitive)
    const firstCell = cells[0]?.toUpperCase() || '';
    if (firstCell === 'TRADE NAME' || firstCell === 'UNIT NAME' || firstCell === 'AREA NAME') {
      continue;
    }
    if (firstCell === 'UNIT/AREA' && section === 'tasks') {
      continue;
    }
    if (section === 'matrix' && (firstCell === 'UNIT' || firstCell === 'AREA')) {
      // This is the header row with trade names
      tradeHeaders = cells.slice(1).filter(Boolean);
      if (matrixScope) {
        matrixTradeOrder[matrixScope] = tradeHeaders;

        // Ensure trades exist for each header (user may edit columns)
        tradeHeaders.forEach((tradeName, index) => {
          const existing = trades.find(t => t.name === tradeName && t.scope === matrixScope);
          if (!existing) {
            trades.push({
              id: `tr_${matrixScope}_${trades.length}`,
              name: tradeName,
              scope: matrixScope,
              orderIndex: index,
              defaultDurationDays: 3
            });
          }
        });
      }
      continue;
    }

    // Parse based on section
    switch (section) {
      case 'metadata':
        const metaKey = cells[0]?.toLowerCase() || '';
        if (metaKey.includes('project name')) projectName = cells[1] || 'Imported Project';
        if (metaKey.includes('address')) address = cells[1] || '';
        if (metaKey.includes('projected') || metaKey.includes('completion')) projectedDate = cells[1] || '';
        if (metaKey.includes('building')) totalBuildings = parseInt(cells[1]) || 1;
        break;

      case 'trades':
        if (cells.length >= 1 && cells[0]) {
          const scope = (cells[1]?.toLowerCase() === 'exterior' ? 'exterior' : 'interior') as 'interior' | 'exterior';
          trades.push({
            id: `tr_${scope}_${trades.length}`,
            name: cells[0],
            scope,
            orderIndex: parseInt(cells[2]) || trades.length,
            defaultDurationDays: parseInt(cells[3]) || 3
          });
        }
        break;

      case 'units':
        if (cells.length >= 1 && cells[0]) {
          units.push({
            id: `u_${units.length}`,
            name: cells[0],
            building: cells[1] || 'Bldg 1',
            scope: (cells[2]?.toLowerCase() === 'exterior' ? 'exterior' : 'interior') as 'interior' | 'exterior'
          });
        }
        break;

      case 'areas':
        if (cells.length >= 1 && cells[0]) {
          areas.push({
            id: `area_${areas.length}`,
            name: cells[0],
            building: cells[1] || 'Bldg 1',
            scope: (cells[2]?.toLowerCase() === 'interior' ? 'interior' : 'exterior') as 'interior' | 'exterior'
          });
        }
        break;

      case 'matrix':
        // Parse matrix cells for status or date
        if (cells.length > 1 && tradeHeaders.length > 0 && matrixScope) {
          const entityName = cells[0];
          const entity = matrixScope === 'interior'
            ? units.find(u => u.name === entityName)
            : areas.find(a => a.name === entityName);

          if (entity) {
            for (let j = 1; j < cells.length && j <= tradeHeaders.length; j++) {
              const tradeName = tradeHeaders[j - 1];
              const trade = trades.find(t => t.name === tradeName && t.scope === matrixScope);
              if (!trade) continue;

              const cellValue = (cells[j] || '').trim();
              if (!cellValue) {
                continue;
              }
              const key = getTaskKey(entity.id, trade.id);
              const statusValue = cellValue.toLowerCase();
              const isStatus = ['not-started', 'ready', 'in-progress', 'complete'].includes(statusValue);
              const isIsoDate = /^\d{4}-\d{2}-\d{2}$/.test(cellValue);
              const isShortDate = /^\d{1,2}\/\d{1,2}(\/\d{2,4})?$/.test(cellValue);

              let expectedStartDate: string | undefined;
              if (isIsoDate) {
                expectedStartDate = cellValue;
              } else if (isShortDate) {
                const parts = cellValue.split('/').map(p => parseInt(p, 10));
                const year = parts.length === 3 ? parts[2] : new Date().getFullYear();
                const fullYear = year < 100 ? 2000 + year : year;
                const month = parts[0];
                const day = parts[1];
                if (month && day && fullYear) {
                  const mm = String(month).padStart(2, '0');
                  const dd = String(day).padStart(2, '0');
                  expectedStartDate = `${fullYear}-${mm}-${dd}`;
                }
              }

              const existing = tasks[key];
              tasks[key] = {
                id: key,
                unitId: entity.id,
                tradeId: trade.id,
                status: isStatus ? (statusValue as Task['status']) : (existing?.status || 'not-started'),
                expectedStartDate: expectedStartDate || existing?.expectedStartDate,
                completedDate: existing?.completedDate,
                percentComplete: existing?.percentComplete,
                lastUpdated: new Date().toISOString()
              };
            }
          }
        }
        break;

      case 'tasks':
        // Parse detailed task data: Unit/Area,Trade,Status,Expected Start Date,Completed Date,Percent Complete,Last Updated
        if (cells.length >= 2 && cells[0] && cells[1]) {
          const unitOrAreaName = cells[0];
          const tradeName = cells[1];
          const status = cells[2] as 'not-started' | 'ready' | 'in-progress' | 'complete';
          const expectedStartDate = cells[3] || '';
          const completedDate = cells[4] || '';
          const percentComplete = cells[5] ? parseInt(cells[5]) : undefined;
          const lastUpdated = cells[6] || new Date().toISOString();

          // Find unit or area
          const unit = units.find(u => u.name === unitOrAreaName);
          const area = areas.find(a => a.name === unitOrAreaName);
          const unitOrArea = unit || area;

          // Find trade
          const trade = trades.find(t => t.name === tradeName);

          if (unitOrArea && trade) {
            const key = getTaskKey(unitOrArea.id, trade.id);
            tasks[key] = {
              id: key,
              unitId: unitOrArea.id,
              tradeId: trade.id,
              status: ['not-started', 'ready', 'in-progress', 'complete'].includes(status) ? status : 'not-started',
              expectedStartDate: expectedStartDate || undefined,
              completedDate: completedDate || undefined,
              percentComplete: percentComplete,
              lastUpdated
            };
          }
        }
        break;
    }
  }

  // If no units or trades were found, create minimal defaults
  if (trades.length === 0) {
    trades.push(
      { id: 'tr_interior_0', name: 'Framing', scope: 'interior', orderIndex: 0, defaultDurationDays: 5 },
      { id: 'tr_interior_1', name: 'Electrical', scope: 'interior', orderIndex: 1, defaultDurationDays: 3 },
      { id: 'tr_interior_2', name: 'Plumbing', scope: 'interior', orderIndex: 2, defaultDurationDays: 3 },
      { id: 'tr_interior_3', name: 'Drywall', scope: 'interior', orderIndex: 3, defaultDurationDays: 5 },
      { id: 'tr_interior_4', name: 'Paint', scope: 'interior', orderIndex: 4, defaultDurationDays: 3 }
    );
  }

  if (units.length === 0) {
    for (let i = 1; i <= 5; i++) {
      units.push({
        id: `u_${i}`,
        name: `Unit ${100 + i}`,
        building: 'Bldg 1',
        scope: 'interior'
      });
    }
  }

  // Align trade order to matrix columns when provided
  (['interior', 'exterior'] as const).forEach(scope => {
    const order = matrixTradeOrder[scope];
    if (order.length > 0) {
      const scopeTrades = trades.filter(t => t.scope === scope);
      const ordered = order
        .map(name => scopeTrades.find(t => t.name === name))
        .filter(Boolean) as Trade[];
      const remaining = scopeTrades.filter(t => !order.includes(t.name));
      const merged = [...ordered, ...remaining].map((t, i) => ({ ...t, orderIndex: i }));
      // Replace trades for this scope
      const other = trades.filter(t => t.scope !== scope);
      trades.length = 0;
      trades.push(...merged, ...other);
    }
  });

  // Always generate tasks for all unit/trade combinations to ensure completeness
  // This will use matrix data if available, otherwise default to not-started
  const finalTasks: Record<string, Task> = {};
  
  units.forEach(unit => {
    trades.filter(t => t.scope === unit.scope).forEach(trade => {
      const key = getTaskKey(unit.id, trade.id);
      // Use existing task from matrix if available, otherwise create new
      finalTasks[key] = tasks[key] || {
        id: key,
        unitId: unit.id,
        tradeId: trade.id,
        status: 'not-started',
        lastUpdated: new Date().toISOString()
      };
    });
  });

  areas.forEach(area => {
    trades.filter(t => t.scope === area.scope).forEach(trade => {
      const key = getTaskKey(area.id, trade.id);
      finalTasks[key] = tasks[key] || {
        id: key,
        unitId: area.id,
        tradeId: trade.id,
        status: 'not-started',
        lastUpdated: new Date().toISOString()
      };
    });
  });

  return {
    id: `proj_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
    name: projectName,
    address,
    projectedCompletionDate: projectedDate || undefined,
    totalBuildings,
    trades,
    units,
    areas,
    tasks: finalTasks
  };
};

/**
 * Parse a single CSV line handling quoted fields
 */
const parseCSVLine = (line: string): string[] => {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim());
      current = '';
    } else {
      current += char;
    }
  }
  
  result.push(current.trim());
  return result;
};

/**
 * Escape a value for CSV (handle commas and quotes)
 */
const escapeCSV = (value: string): string => {
  if (!value) return '';
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
};

/**
 * Generate a template CSV for creating a new project
 */
export const downloadTemplateCSV = (): void => {
  const template = `SHEDULER PROJECT EXPORT
Project Name,My New Project
Address,123 Main Street
Projected Completion,2026-12-31
Total Buildings,1

TRADES
Trade Name,Scope,Order Index,Default Duration (Days)
Framing,interior,0,5
Electrical,interior,1,3
Plumbing,interior,2,3
HVAC,interior,3,3
Insulation,interior,4,2
Drywall,interior,5,5
Paint,interior,6,3
Flooring,interior,7,3
Finish,interior,8,2

UNITS
Unit Name,Building,Scope
Unit 101,Bldg 1,interior
Unit 102,Bldg 1,interior
Unit 103,Bldg 1,interior
Unit 104,Bldg 1,interior
Unit 105,Bldg 1,interior

AREAS
Area Name,Building,Scope
Bldg 1 Roof,Bldg 1,exterior
Bldg 1 North Elev,Bldg 1,exterior
`;

  const blob = new Blob([template], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', 'sheduler_project_template.csv');
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};
