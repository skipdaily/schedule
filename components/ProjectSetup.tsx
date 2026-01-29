import React, { useState } from 'react';
import { Project, Trade, Unit, Area, Task, ScopeType } from '../types';
import { INTERIOR_TRADES_TEMPLATE, EXTERIOR_TRADES_TEMPLATE } from '../constants';
import { getTaskKey } from '../services/logic';
import { Building2, Save, Calendar } from 'lucide-react';

interface ProjectSetupProps {
  onSave: (project: Project) => void;
  onCancel: () => void;
}

const ProjectSetup: React.FC<ProjectSetupProps> = ({ onSave, onCancel }) => {
  const [name, setName] = useState('New Project');
  const [address, setAddress] = useState('');
  const [projectedDate, setProjectedDate] = useState('');
  const [numBuildings, setNumBuildings] = useState(1);
  const [unitsPerBuilding, setUnitsPerBuilding] = useState(10);
  const [startUnitNumber, setStartUnitNumber] = useState(101);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    console.log('Form submitted');

    const trades: Trade[] = [
      ...INTERIOR_TRADES_TEMPLATE.map((t, i) => ({ ...t, id: `tr_int_${i}`, orderIndex: i })),
      ...EXTERIOR_TRADES_TEMPLATE.map((t, i) => ({ ...t, id: `tr_ext_${i}`, orderIndex: i }))
    ];

    const units: Unit[] = [];
    const areas: Area[] = [];

    // Generate Units
    for (let b = 1; b <= numBuildings; b++) {
      const buildingName = `Bldg ${b}`;
      
      // Areas for this building
      areas.push({ id: `area_${b}_roof`, name: `${buildingName} Roof`, building: buildingName, scope: 'exterior' });
      areas.push({ id: `area_${b}_elev_n`, name: `${buildingName} North Elev`, building: buildingName, scope: 'exterior' });
      areas.push({ id: `area_${b}_elev_s`, name: `${buildingName} South Elev`, building: buildingName, scope: 'exterior' });

      // Units
      for (let u = 0; u < unitsPerBuilding; u++) {
        const uNum = startUnitNumber + u + ((b - 1) * 1000); // Simple logic to offset building numbers if needed, mostly just linear here
        units.push({
          id: `u_${b}_${uNum}`,
          name: `${buildingName} Unit ${uNum}`,
          building: buildingName,
          scope: 'interior'
        });
      }
    }

    // Initialize Tasks
    const tasks: Record<string, Task> = {};
    const allEntities = [...units, ...areas];

    allEntities.forEach(entity => {
      trades.filter(t => t.scope === entity.scope).forEach((trade) => {
         const key = getTaskKey(entity.id, trade.id);
         tasks[key] = {
           id: key,
           unitId: entity.id,
           tradeId: trade.id,
           status: 'not-started', // Will be calculated by logic service immediately after
           lastUpdated: new Date().toISOString()
         };
      });
    });

    const newProject: Project = {
      id: `proj_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      name,
      address,
      projectedCompletionDate: projectedDate || undefined,
      totalBuildings: numBuildings,
      trades,
      units,
      areas,
      tasks
    };

    onSave(newProject);
  };

  return (
    <div className="max-w-xl mx-auto bg-white p-8 rounded-xl shadow border border-slate-200 mt-10">
      <div className="flex items-center gap-3 mb-6 border-b border-slate-100 pb-4">
        <div className="bg-indigo-100 p-2 rounded-lg text-indigo-600">
            <Building2 className="w-6 h-6" />
        </div>
        <div>
            <h2 className="text-xl font-bold text-slate-800">Project Setup</h2>
            <p className="text-sm text-slate-500">Initialize units and trade sequences.</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Project Name</label>
          <input 
            type="text" 
            required
            value={name} 
            onChange={e => setName(e.target.value)}
            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Address</label>
          <input 
            type="text" 
            value={address} 
            onChange={e => setAddress(e.target.value)}
            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
          />
        </div>

        <div>
            <label className="block text-sm font-medium text-slate-700 mb-1 flex items-center gap-1">
                 <Calendar className="w-4 h-4" /> Projected Completion Date
            </label>
            <input 
                type="date" 
                value={projectedDate}
                onChange={(e) => setProjectedDate(e.target.value)}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
            />
        </div>

        <div className="grid grid-cols-2 gap-4">
            <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Number of Buildings</label>
            <input 
                type="number" 
                min="1"
                value={numBuildings} 
                onChange={e => setNumBuildings(Number(e.target.value))}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
            />
            </div>
            <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Units per Building</label>
            <input 
                type="number" 
                min="1"
                value={unitsPerBuilding} 
                onChange={e => setUnitsPerBuilding(Number(e.target.value))}
                className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
            />
            </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Starting Unit Number (e.g., 101)</label>
          <input 
            type="number" 
            value={startUnitNumber} 
            onChange={e => setStartUnitNumber(Number(e.target.value))}
            className="w-full px-4 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none"
          />
        </div>

        <div className="pt-4 flex gap-3">
            <button 
                type="button" 
                onClick={onCancel}
                className="flex-1 py-2 px-4 border border-slate-300 text-slate-700 font-medium rounded-lg hover:bg-slate-50"
            >
                Cancel
            </button>
            <button 
                type="submit" 
                onClick={(e) => { console.log('Create button clicked'); }}
                className="flex-1 py-2 px-4 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 flex items-center justify-center gap-2"
            >
                <Save className="w-4 h-4" />
                Create Project
            </button>
        </div>
      </form>
    </div>
  );
};

export default ProjectSetup;