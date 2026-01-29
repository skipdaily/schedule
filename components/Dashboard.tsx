import React, { useState } from 'react';
import { Project, Task, Trade, Unit, Area } from '../types';
import { STATUS_COLORS } from '../constants';
import { getTaskKey } from '../services/logic';
import { Play, Hammer, CheckCircle2, ChevronDown, ChevronRight, Zap, Calendar, Flag } from 'lucide-react';
import { generateDailyBriefing } from '../services/gemini';

interface DashboardProps {
  project: Project;
  onTaskClick: (unitId: string, tradeId: string) => void;
}

const Dashboard: React.FC<DashboardProps> = ({ project, onTaskClick }) => {
  const [loadingAi, setLoadingAi] = useState(false);
  const [briefing, setBriefing] = useState<string | null>(null);

  const getTaskDetails = (t: Task) => {
    const unit = [...project.units, ...project.areas].find(u => u.id === t.unitId);
    const trade = project.trades.find(tr => tr.id === t.tradeId);
    return { unit, trade };
  };

  const tasks = Object.values(project.tasks) as Task[];
  
  // Grouping
  const readyTasks = tasks.filter(t => t.status === 'ready');
  const inProgressTasks = tasks.filter(t => t.status === 'in-progress');

  // Group ready tasks by Trade for clearer list
  const readyByTrade: Record<string, Task[]> = {};
  readyTasks.forEach(t => {
      if (!readyByTrade[t.tradeId]) readyByTrade[t.tradeId] = [];
      readyByTrade[t.tradeId].push(t);
  });

  const handleAiBriefing = async () => {
    setLoadingAi(true);
    const result = await generateDailyBriefing(project);
    setBriefing(result);
    setLoadingAi(false);
  };

  return (
    <div className="max-w-5xl mx-auto space-y-8 pb-20">
      {/* Header Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
            <p className="text-slate-500 text-sm font-medium">Ready to Start</p>
            <p className="text-3xl font-bold text-blue-600 mt-1">{readyTasks.length}</p>
        </div>
        <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
            <p className="text-slate-500 text-sm font-medium">In Progress</p>
            <p className="text-3xl font-bold text-amber-600 mt-1">{inProgressTasks.length}</p>
        </div>
        <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200">
            <p className="text-slate-500 text-sm font-medium flex items-center gap-1">
                Target Completion
            </p>
            <p className="text-xl font-bold text-slate-800 mt-2 truncate">
                {project.projectedCompletionDate 
                    ? new Date(project.projectedCompletionDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) 
                    : <span className="text-slate-400 text-sm font-normal">Not Set</span>}
            </p>
        </div>
        <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 flex flex-col justify-center items-start">
            <button 
                onClick={handleAiBriefing}
                disabled={loadingAi}
                className="w-full h-full flex items-center justify-center gap-2 bg-gradient-to-r from-violet-600 to-indigo-600 text-white py-2 px-4 rounded-lg font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
            >
                <Zap className="w-4 h-4" />
                {loadingAi ? 'Thinking...' : 'AI Briefing'}
            </button>
        </div>
      </div>

      {briefing && (
          <div className="bg-violet-50 border border-violet-200 rounded-xl p-6 shadow-sm animate-fade-in">
              <h3 className="text-violet-900 font-semibold mb-2 flex items-center gap-2">
                  <Zap className="w-5 h-5" /> Superintendent Briefing
              </h3>
              <div className="prose prose-sm text-violet-800 whitespace-pre-line">
                  {briefing}
              </div>
          </div>
      )}

      {/* Ready to Work Section */}
      <section>
        <h3 className="text-lg font-bold text-slate-800 mb-3 flex items-center gap-2">
            <Play className="text-blue-500" />
            Ready to Work
        </h3>
        {readyTasks.length === 0 ? (
            <div className="p-8 text-center text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-300">
                No trades are currently ready to start. Check "In Progress" or complete prerequisites.
            </div>
        ) : (
            <div className="space-y-4">
                {Object.keys(readyByTrade).map(tradeId => {
                    const tradeName = project.trades.find(t => t.id === tradeId)?.name;
                    const tasks = readyByTrade[tradeId];
                    return (
                        <div key={tradeId} className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                            <div className="bg-blue-50 px-4 py-3 border-b border-blue-100 flex justify-between items-center">
                                <h4 className="font-bold text-blue-900">{tradeName}</h4>
                                <span className="bg-blue-200 text-blue-800 text-xs px-2 py-1 rounded-full font-bold">{tasks.length} Locations</span>
                            </div>
                            <div className="p-2 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
                                {tasks.map(task => {
                                    const { unit } = getTaskDetails(task);
                                    return (
                                        <button 
                                            key={task.id}
                                            onClick={() => onTaskClick(task.unitId, task.tradeId)}
                                            className="px-3 py-2 bg-white border border-slate-200 rounded hover:border-blue-400 hover:text-blue-600 hover:shadow-sm transition-all text-sm font-medium text-slate-600 flex flex-col items-center justify-center min-h-[70px]"
                                        >
                                            <span className="mb-1">{unit?.name}</span>
                                            {task.expectedStartDate && (
                                                <span className="text-xs font-bold text-blue-700 bg-blue-100 px-2 py-0.5 rounded mt-1 flex items-center gap-1 shadow-sm">
                                                    <Calendar className="w-3 h-3" /> {new Date(task.expectedStartDate).toLocaleDateString(undefined, {month:'numeric', day:'numeric'})}
                                                </span>
                                            )}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    );
                })}
            </div>
        )}
      </section>

      {/* In Progress Section */}
      <section>
          <h3 className="text-lg font-bold text-slate-800 mb-3 flex items-center gap-2">
            <Hammer className="text-amber-500" />
            In Progress
        </h3>
        <div className="bg-white border border-slate-200 rounded-xl shadow-sm divide-y divide-slate-100">
            {inProgressTasks.length === 0 ? (
                 <div className="p-8 text-center text-slate-400">
                    No active work. Start a task from the "Ready" list.
                </div>
            ) : (
                inProgressTasks.map(task => {
                    const { unit, trade } = getTaskDetails(task);
                    const percent = task.percentComplete || 0;
                    return (
                        <div key={task.id} 
                             onClick={() => onTaskClick(task.unitId, task.tradeId)}
                             className="p-4 hover:bg-slate-50 cursor-pointer flex items-center justify-between group">
                            <div className="flex items-center gap-4">
                                <div className="h-10 w-10 rounded-full bg-amber-100 flex items-center justify-center text-amber-600 relative overflow-hidden">
                                    <Hammer className="w-5 h-5 relative z-10" />
                                    {/* Mini circular progress or overlay could go here, but background is simple */}
                                </div>
                                <div>
                                    <div className="font-bold text-slate-800">{unit?.name}</div>
                                    <div className="text-sm text-slate-500 flex items-center gap-2">
                                        {trade?.name}
                                        {percent > 0 && <span className="bg-amber-100 text-amber-800 text-[10px] px-1.5 rounded font-bold">{percent}%</span>}
                                    </div>
                                    {task.expectedStartDate && (
                                        <div className="text-xs font-bold text-slate-600 mt-1 flex items-center gap-1 bg-slate-100 px-2 py-0.5 rounded w-fit">
                                            <Calendar className="w-3 h-3" /> Start: {task.expectedStartDate}
                                        </div>
                                    )}
                                </div>
                            </div>
                            <ChevronRight className="text-slate-300 group-hover:text-slate-500" />
                        </div>
                    );
                })
            )}
        </div>
      </section>
    </div>
  );
};

export default Dashboard;