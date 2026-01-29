import React, { useState } from 'react';
import { Project, Unit, Task, Trade, ScopeType } from '../types';
import { getTaskKey } from '../services/logic';
import { X, Plus, Trash2, Save, Building, MapPin, Calendar } from 'lucide-react';

interface EditProjectModalProps {
  project: Project;
  onSave: (project: Project) => void;
  onClose: () => void;
}

const EditProjectModal: React.FC<EditProjectModalProps> = ({ project, onSave, onClose }) => {
  const [name, setName] = useState(project.name);
  const [address, setAddress] = useState(project.address);
  const [projectedDate, setProjectedDate] = useState(project.projectedCompletionDate || '');
  
  // Unit Management State
  const [units, setUnits] = useState<Unit[]>(project.units);
  const [unitsToDelete, setUnitsToDelete] = useState<string[]>([]);
  const [addedUnits, setAddedUnits] = useState<Unit[]>([]);

    // Trade Management State
    const [trades, setTrades] = useState<Trade[]>(project.trades);
    const [tradesToDelete, setTradesToDelete] = useState<string[]>([]);
    const [addedTrades, setAddedTrades] = useState<Trade[]>([]);
  
  // Add Unit Form
  const [isAddingUnit, setIsAddingUnit] = useState(false);
  const [newUnitName, setNewUnitName] = useState('');
  const [newUnitBuilding, setNewUnitBuilding] = useState('Bldg 1');

    // Add Trade Form
    const [isAddingTrade, setIsAddingTrade] = useState(false);
    const [newTradeName, setNewTradeName] = useState('');
    const [newTradeScope, setNewTradeScope] = useState<ScopeType>('interior');
    const [newTradeDuration, setNewTradeDuration] = useState(3);

  const handleAddNewUnit = () => {
      if(!newUnitName) return;
       const newUnitId = `u_${Date.now()}`;
        const newUnit: Unit = {
            id: newUnitId,
            name: newUnitName,
            building: newUnitBuilding,
            scope: 'interior'
        };
        setAddedUnits([...addedUnits, newUnit]);
        setUnits([...units, newUnit]);
        setNewUnitName('');
        setIsAddingUnit(false);
  };

  const handleDeleteUnit = (id: string) => {
      setUnits(units.filter(u => u.id !== id));
      // If it was just added, remove from added list. If it was existing, mark for ID deletion logic if needed, 
      // but simpler is just to rely on the final units list and clean up orphan tasks? 
      // Actually, cleaning up orphan tasks is cleaner.
      
      // If it was an existing unit, track it to clean up tasks
      const isNew = addedUnits.some(u => u.id === id);
      if (!isNew) {
          setUnitsToDelete([...unitsToDelete, id]);
      } else {
          setAddedUnits(addedUnits.filter(u => u.id !== id));
      }
  };

  const handleAddNewTrade = () => {
      if (!newTradeName) return;

      const scopeTrades = trades.filter(t => t.scope === newTradeScope);
      const newTrade: Trade = {
          id: `tr_${newTradeScope}_${Date.now()}`,
          name: newTradeName,
          scope: newTradeScope,
          defaultDurationDays: newTradeDuration || 3,
          orderIndex: scopeTrades.length
      };

      setAddedTrades([...addedTrades, newTrade]);
      setTrades([...trades, newTrade]);
      setNewTradeName('');
      setNewTradeDuration(3);
      setIsAddingTrade(false);
  };

  const handleDeleteTrade = (id: string) => {
      setTrades(trades.filter(t => t.id !== id));
      const isNew = addedTrades.some(t => t.id === id);
      if (!isNew) {
          setTradesToDelete([...tradesToDelete, id]);
      } else {
          setAddedTrades(addedTrades.filter(t => t.id !== id));
      }
  };

  const handleFinalSave = () => {
      const nextTasks = { ...project.tasks };
      
      // 1. Cleanup deleted unit tasks
      unitsToDelete.forEach(uid => {
          Object.keys(nextTasks).forEach(key => {
              if (key.startsWith(`${uid}_`)) {
                  delete nextTasks[key];
              }
          });
      });

      // 1b. Cleanup deleted trade tasks
      tradesToDelete.forEach(tid => {
          Object.keys(nextTasks).forEach(key => {
              if (nextTasks[key]?.tradeId === tid) {
                  delete nextTasks[key];
              }
          });
      });

      // 2. Initialize tasks for new units
      addedUnits.forEach(u => {
           project.trades.filter(t => t.scope === 'interior').forEach(trade => {
                const key = getTaskKey(u.id, trade.id);
                nextTasks[key] = {
                    id: key,
                    unitId: u.id,
                    tradeId: trade.id,
                    status: 'not-started',
                    lastUpdated: new Date().toISOString()
                };
            });
      });

      // 2b. Initialize tasks for new trades
      addedTrades.forEach(t => {
          const entities = t.scope === 'interior' ? project.units : project.areas;
          entities.forEach(entity => {
              const key = getTaskKey(entity.id, t.id);
              nextTasks[key] = {
                  id: key,
                  unitId: entity.id,
                  tradeId: t.id,
                  status: 'not-started',
                  lastUpdated: new Date().toISOString()
              };
          });
      });

      // Recalculate orderIndex for trades by scope
      const interiorTrades = trades.filter(t => t.scope === 'interior').map((t, i) => ({ ...t, orderIndex: i }));
      const exteriorTrades = trades.filter(t => t.scope === 'exterior').map((t, i) => ({ ...t, orderIndex: i }));
      const updatedTrades = [...interiorTrades, ...exteriorTrades];

      const updatedProject = {
          ...project,
          name,
          address,
          projectedCompletionDate: projectedDate || undefined,
          units: units,
          trades: updatedTrades,
          tasks: nextTasks
      };

      onSave(updatedProject);
      onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden animate-fade-in flex flex-col max-h-[90vh]">
        
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 flex justify-between items-center bg-slate-50">
          <h3 className="text-lg font-bold text-slate-800">Edit Project Settings</h3>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Scrollable Content */}
        <div className="p-6 overflow-y-auto">
            <div className="space-y-6">
                {/* Project Details */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1 flex items-center gap-1">
                            <Building className="w-4 h-4" /> Project Name
                        </label>
                        <input 
                            type="text" 
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1 flex items-center gap-1">
                            <MapPin className="w-4 h-4" /> Address
                        </label>
                        <input 
                            type="text" 
                            value={address}
                            onChange={(e) => setAddress(e.target.value)}
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-slate-700 mb-1 flex items-center gap-1">
                            <Calendar className="w-4 h-4" /> Target Completion
                        </label>
                        <input 
                            type="date" 
                            value={projectedDate}
                            onChange={(e) => setProjectedDate(e.target.value)}
                            className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                        />
                    </div>
                </div>

                <div className="border-t border-slate-100 pt-4">
                    <div className="flex justify-between items-center mb-4">
                        <h4 className="font-semibold text-slate-800">Manage Units ({units.length})</h4>
                        <button 
                            onClick={() => setIsAddingUnit(true)}
                            className="text-sm bg-indigo-50 text-indigo-700 px-3 py-1.5 rounded-lg font-medium hover:bg-indigo-100 flex items-center gap-1"
                        >
                            <Plus className="w-4 h-4" /> Add Unit
                        </button>
                    </div>

                    {isAddingUnit && (
                        <div className="bg-slate-50 p-4 rounded-lg mb-4 border border-slate-200 animate-fade-in">
                            <div className="flex gap-2 items-end">
                                <div className="flex-1">
                                    <label className="text-xs font-medium text-slate-500 mb-1 block">Building</label>
                                    <input 
                                        type="text" 
                                        value={newUnitBuilding}
                                        onChange={(e) => setNewUnitBuilding(e.target.value)}
                                        className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm"
                                        placeholder="e.g. Bldg 1"
                                    />
                                </div>
                                <div className="flex-[2]">
                                    <label className="text-xs font-medium text-slate-500 mb-1 block">Unit Name</label>
                                    <input 
                                        type="text" 
                                        value={newUnitName}
                                        onChange={(e) => setNewUnitName(e.target.value)}
                                        className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm"
                                        placeholder="e.g. Unit 105"
                                        autoFocus
                                    />
                                </div>
                                <button 
                                    onClick={handleAddNewUnit}
                                    className="px-3 py-1.5 bg-indigo-600 text-white rounded text-sm font-medium hover:bg-indigo-700"
                                >
                                    Add
                                </button>
                                <button 
                                    onClick={() => setIsAddingUnit(false)}
                                    className="px-3 py-1.5 text-slate-500 hover:text-slate-700"
                                >
                                    Cancel
                                </button>
                            </div>
                        </div>
                    )}

                    <div className="max-h-60 overflow-y-auto border border-slate-200 rounded-lg">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-slate-50 text-slate-500 font-medium sticky top-0">
                                <tr>
                                    <th className="px-4 py-2">Unit Name</th>
                                    <th className="px-4 py-2">Building</th>
                                    <th className="px-4 py-2 w-16">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {units.map(unit => (
                                    <tr key={unit.id} className="hover:bg-slate-50">
                                        <td className="px-4 py-2 font-medium text-slate-700">{unit.name}</td>
                                        <td className="px-4 py-2 text-slate-500">{unit.building}</td>
                                        <td className="px-4 py-2">
                                            <button 
                                                onClick={() => handleDeleteUnit(unit.id)}
                                                className="text-slate-400 hover:text-red-500 transition-colors"
                                                title="Delete Unit"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                <div className="border-t border-slate-100 pt-4">
                    <div className="flex justify-between items-center mb-4">
                        <h4 className="font-semibold text-slate-800">Manage Trades ({trades.length})</h4>
                        <button 
                            onClick={() => setIsAddingTrade(true)}
                            className="text-sm bg-indigo-50 text-indigo-700 px-3 py-1.5 rounded-lg font-medium hover:bg-indigo-100 flex items-center gap-1"
                        >
                            <Plus className="w-4 h-4" /> Add Trade
                        </button>
                    </div>

                    {isAddingTrade && (
                        <div className="bg-slate-50 p-4 rounded-lg mb-4 border border-slate-200 animate-fade-in">
                            <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 items-end">
                                <div className="sm:col-span-2">
                                    <label className="text-xs font-medium text-slate-500 mb-1 block">Trade Name</label>
                                    <input 
                                        type="text" 
                                        value={newTradeName}
                                        onChange={(e) => setNewTradeName(e.target.value)}
                                        className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm"
                                        placeholder="e.g. Stucco"
                                        autoFocus
                                    />
                                </div>
                                <div>
                                    <label className="text-xs font-medium text-slate-500 mb-1 block">Scope</label>
                                    <select
                                        value={newTradeScope}
                                        onChange={(e) => setNewTradeScope(e.target.value as ScopeType)}
                                        className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm"
                                    >
                                        <option value="interior">Interior</option>
                                        <option value="exterior">Exterior</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="text-xs font-medium text-slate-500 mb-1 block">Duration (Days)</label>
                                    <input 
                                        type="number" 
                                        min="1"
                                        value={newTradeDuration}
                                        onChange={(e) => setNewTradeDuration(Number(e.target.value))}
                                        className="w-full px-2 py-1.5 border border-slate-300 rounded text-sm"
                                    />
                                </div>
                                <div className="sm:col-span-4 flex gap-2 justify-end">
                                    <button 
                                        onClick={() => setIsAddingTrade(false)}
                                        className="px-3 py-1.5 text-slate-500 hover:text-slate-700"
                                    >
                                        Cancel
                                    </button>
                                    <button 
                                        onClick={handleAddNewTrade}
                                        className="px-3 py-1.5 bg-indigo-600 text-white rounded text-sm font-medium hover:bg-indigo-700"
                                    >
                                        Add
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    <div className="max-h-60 overflow-y-auto border border-slate-200 rounded-lg">
                        <table className="w-full text-sm text-left">
                            <thead className="bg-slate-50 text-slate-500 font-medium sticky top-0">
                                <tr>
                                    <th className="px-4 py-2">Trade Name</th>
                                    <th className="px-4 py-2">Scope</th>
                                    <th className="px-4 py-2">Duration</th>
                                    <th className="px-4 py-2 w-16">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                                {trades.map(trade => (
                                    <tr key={trade.id} className="hover:bg-slate-50">
                                        <td className="px-4 py-2 font-medium text-slate-700">{trade.name}</td>
                                        <td className="px-4 py-2 text-slate-500 capitalize">{trade.scope}</td>
                                        <td className="px-4 py-2 text-slate-500">{trade.defaultDurationDays}d</td>
                                        <td className="px-4 py-2">
                                            <button 
                                                onClick={() => handleDeleteTrade(trade.id)}
                                                className="text-slate-400 hover:text-red-500 transition-colors"
                                                title="Delete Trade"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex justify-end gap-3">
             <button 
                onClick={onClose}
                className="px-4 py-2 border border-slate-300 rounded-lg text-slate-700 font-medium hover:bg-white"
            >
                Cancel
            </button>
            <button 
                onClick={handleFinalSave}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700 flex items-center gap-2"
            >
                <Save className="w-4 h-4" /> Save Changes
            </button>
        </div>
      </div>
    </div>
  );
};

export default EditProjectModal;