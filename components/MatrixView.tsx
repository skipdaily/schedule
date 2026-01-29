import React, { useState, useRef, useEffect } from 'react';
import { Project, TaskStatus, Trade, Unit } from '../types';
import { STATUS_COLORS, STATUS_LABELS } from '../constants';
import { getTaskKey } from '../services/logic';
import { Check, Play, Clock, Calendar, GripVertical, ArrowUpDown, CheckSquare, Plus, Trash2, X, Pencil } from 'lucide-react';

interface MatrixViewProps {
  project: Project;
  onTaskClick: (unitId: string, tradeId: string) => void;
  onReorderUnits?: (units: Unit[]) => void;
  onReorderTrades?: (trades: Trade[]) => void;
  onDeleteTrade?: (tradeId: string) => void;
  onAddTrade?: (trade: Omit<Trade, 'id' | 'orderIndex'>, insertAtIndex?: number) => void;
  onEditTrade?: (tradeId: string, newName: string) => void;
  isLinkingMode?: boolean;
  linkingFromTask?: { unitId: string; tradeId: string } | null;
  onCancelLinking?: () => void;
}

const MatrixView: React.FC<MatrixViewProps> = ({ project, onTaskClick, onReorderUnits, onReorderTrades, onDeleteTrade, onAddTrade, onEditTrade, isLinkingMode, linkingFromTask, onCancelLinking }) => {
  const interiorTrades = project.trades.filter(t => t.scope === 'interior');
  const interiorUnits = project.units;

  // Reordering State
  const [isReordering, setIsReordering] = useState(false);
  const dragItem = useRef<number | null>(null);
  const dragOverItem = useRef<number | null>(null);
  
  // Trade drag state
  const dragTradeItem = useRef<number | null>(null);
  const dragTradeOverItem = useRef<number | null>(null);

  // Trade modal state
  const [selectedTrade, setSelectedTrade] = useState<Trade | null>(null);
  const [showAddTrade, setShowAddTrade] = useState(false);
  const [insertAfterIndex, setInsertAfterIndex] = useState<number | null>(null);
  const [newTradeName, setNewTradeName] = useState('');
  const [hoveredGap, setHoveredGap] = useState<number | null>(null);
  const [editingTradeName, setEditingTradeName] = useState('');

  // Reset editing name when selected trade changes
  useEffect(() => {
    if (selectedTrade) {
      setEditingTradeName(selectedTrade.name);
    }
  }, [selectedTrade]);

  const handleAddTradeAt = (index: number) => {
    setInsertAfterIndex(index);
    setShowAddTrade(true);
  };

  const handleDragStart = (e: React.DragEvent<HTMLTableRowElement>, position: number) => {
    dragItem.current = position;
    // Highlight the row being dragged
    e.currentTarget.classList.add('bg-blue-50');
  };

  const handleDragEnter = (e: React.DragEvent<HTMLTableRowElement>, position: number) => {
    dragOverItem.current = position;
  };

  const handleDragEnd = (e: React.DragEvent<HTMLTableRowElement>) => {
    e.currentTarget.classList.remove('bg-blue-50');
    
    if (dragItem.current !== null && dragOverItem.current !== null && onReorderUnits) {
        const _units = [...interiorUnits];
        const draggedUnitContent = _units[dragItem.current];
        _units.splice(dragItem.current, 1);
        _units.splice(dragOverItem.current, 0, draggedUnitContent);
        
        onReorderUnits(_units);
    }
    
    dragItem.current = null;
    dragOverItem.current = null;
  };

  // Trade drag handlers
  const handleTradeDragStart = (e: React.DragEvent<HTMLTableCellElement>, position: number) => {
    dragTradeItem.current = position;
    e.currentTarget.classList.add('bg-indigo-100');
  };

  const handleTradeDragEnter = (e: React.DragEvent<HTMLTableCellElement>, position: number) => {
    dragTradeOverItem.current = position;
  };

  const handleTradeDragEnd = (e: React.DragEvent<HTMLTableCellElement>) => {
    e.currentTarget.classList.remove('bg-indigo-100');
    
    if (dragTradeItem.current !== null && dragTradeOverItem.current !== null && onReorderTrades) {
        const _trades = [...interiorTrades];
        const draggedTradeContent = _trades[dragTradeItem.current];
        _trades.splice(dragTradeItem.current, 1);
        _trades.splice(dragTradeOverItem.current, 0, draggedTradeContent);
        
        // Update orderIndex for all trades and combine with exterior trades
        const reorderedTrades = _trades.map((t, i) => ({ ...t, orderIndex: i }));
        const exteriorTrades = project.trades.filter(t => t.scope === 'exterior');
        onReorderTrades([...reorderedTrades, ...exteriorTrades]);
    }
    
    dragTradeItem.current = null;
    dragTradeOverItem.current = null;
  };

  const renderIcon = (status: TaskStatus, className = "w-4 h-4") => {
    switch (status) {
      case 'complete': return <Check className={className} />;
      case 'ready': return <Play className={className} />;
      case 'in-progress': return <Clock className={className} />;
      default: return null;
    }
  };

  const getDateInfo = (dateStr: string) => {
    if (!dateStr) return null;
    let dObj: Date;
    
    // Handle ISO strings (contains T) vs Simple Date (YYYY-MM-DD)
    if (dateStr.includes('T')) {
         dObj = new Date(dateStr);
    } else {
         const [y, m, d] = dateStr.split('-').map(Number);
         dObj = new Date(y, m - 1, d);
    }

    if (isNaN(dObj.getTime())) return null;

    return {
        weekday: dObj.toLocaleDateString('en-US', { weekday: 'long' }),
        formattedDate: dObj.toLocaleDateString('en-US', { month: 'numeric', day: 'numeric' })
    };
  };

  return (
    <div className="flex flex-col h-full bg-white shadow-sm rounded-lg border border-slate-200 overflow-hidden">
      {/* Linking Mode Banner */}
      {isLinkingMode && linkingFromTask && (
        <div className="bg-indigo-600 text-white px-4 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="font-medium">🔗 Linking Mode:</span>
            <span>Click on a task to link it to {(() => {
              const unit = project.units.find(u => u.id === linkingFromTask.unitId);
              const trade = project.trades.find(t => t.id === linkingFromTask.tradeId);
              return `${unit?.name || 'Unknown'} - ${trade?.name || 'Unknown'}`;
            })()}</span>
          </div>
          <button 
            onClick={onCancelLinking}
            className="px-3 py-1 bg-white/20 hover:bg-white/30 rounded-lg text-sm font-medium"
          >
            Cancel
          </button>
        </div>
      )}
      
      <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-slate-50 flex-shrink-0">
        <div className="flex items-center gap-3">
            <h2 className="text-lg font-semibold text-slate-800">Interior Unit Matrix</h2>
            {onReorderUnits && (
                <button 
                    onClick={() => setIsReordering(!isReordering)}
                    className={`text-xs px-2 py-1 rounded border flex items-center gap-1 transition-colors ${isReordering ? 'bg-indigo-100 border-indigo-300 text-indigo-700' : 'bg-white border-slate-300 text-slate-600 hover:bg-slate-50'}`}
                >
                    {isReordering ? <CheckSquare className="w-3 h-3" /> : <ArrowUpDown className="w-3 h-3" />}
                    {isReordering ? 'Done Reordering' : 'Reorder'}
                </button>
            )}
        </div>
        
        <div className="flex gap-2 text-xs">
            {Object.entries(STATUS_LABELS).map(([key, label]) => (
                <div key={key} className="flex items-center gap-1">
                    <div className={`w-3 h-3 rounded-full ${STATUS_COLORS[key as TaskStatus].split(' ')[0]}`}></div>
                    <span className="text-slate-600 hidden sm:inline">{label}</span>
                </div>
            ))}
        </div>
      </div>
      
      <div className="overflow-auto matrix-scroll flex-1 min-h-0">
        <table className="min-w-full border-collapse text-sm">
          <thead className="bg-slate-50 sticky top-0 z-40">
            <tr>
              <th className="sticky left-0 z-50 bg-slate-50 p-3 text-left font-semibold text-slate-600 border-b border-r border-slate-200 w-24 min-w-[100px] flex items-center gap-2">
                 Unit
              </th>
              {interiorTrades.map((trade, index) => (
                <React.Fragment key={trade.id}>
                  {/* Add button before first trade */}
                  {index === 0 && onAddTrade && !isReordering && (
                    <th 
                      className="p-0 border-b border-slate-200 w-1 min-w-[8px] relative group bg-slate-50"
                      onMouseEnter={() => setHoveredGap(-1)}
                      onMouseLeave={() => setHoveredGap(null)}
                    >
                      <div 
                        className={`absolute inset-y-0 left-1/2 -translate-x-1/2 w-6 flex items-center justify-center cursor-pointer transition-opacity ${hoveredGap === -1 ? 'opacity-100' : 'opacity-0'}`}
                        onClick={() => handleAddTradeAt(0)}
                      >
                        <div className="bg-indigo-500 hover:bg-indigo-600 text-white rounded-full p-0.5">
                          <Plus className="w-3 h-3" />
                        </div>
                      </div>
                    </th>
                  )}
                  <th 
                    onClick={() => !isReordering && (onDeleteTrade || onEditTrade) && setSelectedTrade(trade)}
                    draggable={isReordering && !!onReorderTrades}
                    onDragStart={(e) => isReordering && handleTradeDragStart(e, index)}
                    onDragEnter={(e) => isReordering && handleTradeDragEnter(e, index)}
                    onDragEnd={(e) => isReordering && handleTradeDragEnd(e)}
                    onDragOver={(e) => e.preventDefault()}
                    className={`p-2 text-center font-medium text-slate-600 border-b border-slate-200 min-w-[120px] whitespace-nowrap bg-slate-50 ${isReordering ? 'cursor-move hover:bg-indigo-50' : (onDeleteTrade || onEditTrade) ? 'cursor-pointer hover:bg-slate-100' : ''}`}
                  >
                    <div className="flex items-center justify-center gap-1">
                      {isReordering && <GripVertical className="w-3 h-3 text-slate-400" />}
                      {trade.name}
                    </div>
                  </th>
                  {/* Add button after each trade */}
                  {onAddTrade && !isReordering && (
                    <th 
                      className="p-0 border-b border-slate-200 w-1 min-w-[8px] relative group bg-slate-50"
                      onMouseEnter={() => setHoveredGap(index)}
                      onMouseLeave={() => setHoveredGap(null)}
                    >
                      <div 
                        className={`absolute inset-y-0 left-1/2 -translate-x-1/2 w-6 flex items-center justify-center cursor-pointer transition-opacity ${hoveredGap === index ? 'opacity-100' : 'opacity-0'}`}
                        onClick={() => handleAddTradeAt(index + 1)}
                      >
                        <div className="bg-indigo-500 hover:bg-indigo-600 text-white rounded-full p-0.5">
                          <Plus className="w-3 h-3" />
                        </div>
                      </div>
                    </th>
                  )}
                </React.Fragment>
              ))}
            </tr>
          </thead>
          <tbody>
            {interiorUnits.map((unit, index) => (
              <tr 
                key={unit.id} 
                className={`group ${isReordering ? 'cursor-move hover:bg-slate-50' : 'hover:bg-slate-50'}`}
                draggable={isReordering}
                onDragStart={(e) => isReordering && handleDragStart(e, index)}
                onDragEnter={(e) => isReordering && handleDragEnter(e, index)}
                onDragEnd={(e) => isReordering && handleDragEnd(e)}
                onDragOver={(e) => e.preventDefault()}
              >
                <td className={`sticky left-0 z-20 bg-white p-3 font-medium text-slate-700 border-b border-r border-slate-200 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]`}>
                  <div className="flex items-center gap-2">
                      {isReordering && <GripVertical className="w-4 h-4 text-slate-400 cursor-grab active:cursor-grabbing" />}
                      {unit.name}
                  </div>
                </td>
                {interiorTrades.map((trade, tradeIndex) => {
                  const key = getTaskKey(unit.id, trade.id);
                  const task = project.tasks[key];
                  const status = task ? task.status : 'not-started';
                  
                  // Determine which date to show
                  let displayDate = null;
                  if (status === 'complete' && task?.completedDate) {
                      displayDate = task.completedDate;
                  } else if (task?.expectedStartDate) {
                      displayDate = task.expectedStartDate;
                  }

                  const dateInfo = displayDate ? getDateInfo(displayDate) : null;
                  const percent = task?.percentComplete || 0;
                  
                  // Check if this is the task being linked from
                  const isLinkingSource = isLinkingMode && linkingFromTask && 
                    linkingFromTask.unitId === unit.id && linkingFromTask.tradeId === trade.id;

                  return (
                    <React.Fragment key={key}>
                      {/* Empty cell for gap before first trade */}
                      {tradeIndex === 0 && onAddTrade && !isReordering && (
                        <td className="p-0 border-b border-slate-100 w-1 min-w-[8px]"></td>
                      )}
                      <td 
                        onClick={() => !isReordering && onTaskClick(unit.id, trade.id)}
                        className={`p-1 border-b border-slate-100 transition-colors duration-150 h-16 ${!isReordering && 'cursor-pointer'} ${isLinkingMode && !isLinkingSource ? 'ring-2 ring-indigo-400 ring-inset' : ''} ${isLinkingSource ? 'ring-2 ring-amber-500 ring-inset' : ''}`}
                      >
                        <div className={`w-full h-full rounded flex flex-col items-center justify-center transition-all ${STATUS_COLORS[status]} ${!isReordering && 'hover:opacity-90'} relative overflow-hidden ${isLinkingMode && !isLinkingSource ? 'hover:ring-2 hover:ring-indigo-600' : ''}`}>
                          {dateInfo ? (
                              // Date View (Takes up entire cell)
                              <div className="flex flex-col items-center justify-center w-full h-full p-1 relative z-10">
                                  <span className="text-[10px] uppercase font-bold tracking-wider opacity-80 mb-0.5">
                                      {dateInfo.weekday}
                                  </span>
                                  <span className="text-lg font-extrabold leading-none">
                                      {dateInfo.formattedDate}
                                  </span>
                                  
                                  {status === 'in-progress' && percent > 0 && (
                                       <div className="absolute top-1 left-1 text-[10px] font-bold opacity-75">
                                          {percent}%
                                       </div>
                                  )}

                                  <div className="absolute bottom-1 right-1 opacity-50 scale-75">
                                       {renderIcon(status, "w-4 h-4")}
                                  </div>
                              </div>
                          ) : (
                              // Standard View (No Date)
                              <div className="flex flex-col items-center justify-center relative z-10">
                                  <div className="flex items-center gap-1.5">
                                      {renderIcon(status)}
                                      <span className="text-xs font-medium hidden md:inline">
                                          {status === 'not-started' ? '' : STATUS_LABELS[status]}
                                      </span>
                                  </div>
                                  {status === 'in-progress' && percent > 0 && (
                                      <span className="text-[10px] font-bold opacity-80 mt-0.5">
                                          {percent}%
                                      </span>
                                  )}
                              </div>
                          )}
                          
                          {/* Progress Bar Background for In-Progress items */}
                          {status === 'in-progress' && percent > 0 && (
                              <div 
                                  className="absolute bottom-0 left-0 h-1.5 bg-amber-500/60 transition-all" 
                                  style={{ width: `${percent}%` }}
                              />
                          )}
                        </div>
                      </td>
                      {/* Empty cell for gap after each trade */}
                      {onAddTrade && !isReordering && (
                        <td className="p-0 border-b border-slate-100 w-1 min-w-[8px]"></td>
                      )}
                    </React.Fragment>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Trade Edit/Delete Modal */}
      {selectedTrade && (onDeleteTrade || onEditTrade) && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm overflow-hidden">
            <div className="bg-slate-50 p-4 border-b border-slate-200 flex justify-between items-center">
              <h3 className="font-bold text-slate-800">Edit Trade</h3>
              <button onClick={() => setSelectedTrade(null)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              {onEditTrade && (
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Trade Name</label>
                  <input
                    type="text"
                    value={editingTradeName}
                    onChange={(e) => setEditingTradeName(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                </div>
              )}
              <div className="flex gap-3">
                {onEditTrade && editingTradeName.trim() && editingTradeName !== selectedTrade.name && (
                  <button
                    onClick={() => {
                      onEditTrade(selectedTrade.id, editingTradeName.trim());
                      setSelectedTrade(null);
                    }}
                    className="flex-1 py-2 px-4 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 flex items-center justify-center gap-2"
                  >
                    <Pencil className="w-4 h-4" />
                    Save
                  </button>
                )}
                <button
                  onClick={() => setSelectedTrade(null)}
                  className="flex-1 py-2 px-4 border border-slate-300 text-slate-700 font-medium rounded-lg hover:bg-slate-50"
                >
                  Cancel
                </button>
              </div>
              {onDeleteTrade && (
                <div className="pt-4 border-t border-slate-200">
                  <button
                    onClick={() => {
                      onDeleteTrade(selectedTrade.id);
                      setSelectedTrade(null);
                    }}
                    className="w-full py-2 px-4 bg-red-600 text-white font-medium rounded-lg hover:bg-red-700 flex items-center justify-center gap-2"
                  >
                    <Trash2 className="w-4 h-4" />
                    Delete Trade
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Add Trade Modal */}
      {showAddTrade && onAddTrade && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm overflow-hidden">
            <div className="bg-slate-50 p-4 border-b border-slate-200 flex justify-between items-center">
              <h3 className="font-bold text-slate-800">Add New Trade</h3>
              <button onClick={() => { setShowAddTrade(false); setInsertAfterIndex(null); }} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Trade Name</label>
                <input
                  type="text"
                  value={newTradeName}
                  onChange={(e) => setNewTradeName(e.target.value)}
                  placeholder="e.g., Electrical"
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none"
                />
              </div>
              <div className="flex gap-3">
                <button
                  onClick={() => { setShowAddTrade(false); setInsertAfterIndex(null); }}
                  className="flex-1 py-2 px-4 border border-slate-300 text-slate-700 font-medium rounded-lg hover:bg-slate-50"
                >
                  Cancel
                </button>
                <button
                  onClick={() => {
                    if (newTradeName.trim()) {
                      onAddTrade({
                        name: newTradeName.trim(),
                        scope: 'interior',
                        defaultDurationDays: 3
                      }, insertAfterIndex ?? undefined);
                      setNewTradeName('');
                      setInsertAfterIndex(null);
                      setShowAddTrade(false);
                    }
                  }}
                  className="flex-1 py-2 px-4 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 flex items-center justify-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  Add Trade
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default MatrixView;