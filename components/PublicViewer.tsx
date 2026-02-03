import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Project, TaskStatus, Task } from '../types';
import { STATUS_COLORS, STATUS_LABELS } from '../constants';
import { getTaskKey } from '../services/logic';
import { fetchProjects } from '../services/supabase';
import { Check, Play, Clock, Calendar, Loader2, FileText } from 'lucide-react';

const PublicViewer: React.FC = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadProject = async () => {
      try {
        const projects = await fetchProjects();
        const found = projects.find(p => p.id === projectId);
        if (found) {
          setProject(found);
        } else {
          setError('Project not found');
        }
      } catch (e) {
        setError('Failed to load project');
      } finally {
        setLoading(false);
      }
    };
    loadProject();
  }, [projectId]);

  const renderIcon = (status: TaskStatus, className = "w-4 h-4") => {
    switch (status) {
      case 'complete': return <Check className={className} />;
      case 'ready': return <Play className={className} />;
      case 'in-progress': return <Clock className={className} />;
      default: return null;
    }
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return null;
    const [y, m, d] = dateStr.split('-').map(Number);
    const dObj = new Date(y, m - 1, d);
    return {
      weekday: dObj.toLocaleDateString('en-US', { weekday: 'long' }),
      formattedDate: dObj.toLocaleDateString('en-US', { month: 'numeric', day: 'numeric' })
    };
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="flex items-center gap-3 text-slate-600">
          <Loader2 className="w-6 h-6 animate-spin" />
          <span>Loading schedule...</span>
        </div>
      </div>
    );
  }

  if (error || !project) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-slate-800 mb-2">Schedule Not Found</h1>
          <p className="text-slate-500">{error || 'The requested schedule could not be found.'}</p>
        </div>
      </div>
    );
  }

  const interiorTrades = project.trades.filter(t => t.scope === 'interior');
  const interiorUnits = project.units;
  const tasks = Object.values(project.tasks) as Task[];
  const ready = tasks.filter(t => t.status === 'ready').length;
  const progress = tasks.filter(t => t.status === 'in-progress').length;
  const done = tasks.filter(t => t.status === 'complete').length;
  const total = tasks.length;
  const percent = total > 0 ? Math.round((done / total) * 100) : 0;

  return (
    <div className="min-h-screen bg-white">
      {/* Project Info */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 w-full">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-800">{project.name}</h1>
            <p className="text-slate-500">Address: {project.address || ''}</p>
            {project.projectedCompletionDate && (
              <p className="text-sm text-slate-500 mt-1">
                Target Completion: {new Date(project.projectedCompletionDate).toLocaleDateString()}
              </p>
            )}
          </div>
          <div className="text-sm text-slate-500">Generated: {new Date().toLocaleDateString()}</div>
        </div>
        <div className="mt-4 text-sm text-slate-700">
          Overall Progress: {percent}% &nbsp; | &nbsp; Ready: {ready} &nbsp; | &nbsp; In Progress: {progress} &nbsp; | &nbsp; Complete: {done}
        </div>
      </div>

      {/* Matrix View */}
      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-8 w-full">
        <div className="border border-slate-200 overflow-auto">
          <table className="min-w-full border-collapse text-sm">
              <thead className="bg-slate-50 sticky top-0 z-40">
                <tr>
                  <th className="sticky left-0 z-50 bg-slate-50 p-3 text-left font-semibold text-slate-600 border-b border-r border-slate-200 w-24 min-w-[100px]">
                    Unit
                  </th>
                  {interiorTrades.map((trade) => (
                    <th
                      key={trade.id}
                      className="p-2 text-center font-medium text-slate-600 border-b border-slate-200 min-w-[120px] whitespace-nowrap bg-slate-50"
                    >
                      {trade.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {interiorUnits.map((unit) => (
                  <tr key={unit.id}>
                    <td className="sticky left-0 z-20 bg-white p-3 font-medium text-slate-700 border-b border-r border-slate-200 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.08)]">
                      {unit.name}
                    </td>
                    {interiorTrades.map((trade) => {
                      const key = getTaskKey(unit.id, trade.id);
                      const task = project.tasks[key];
                      const status = task ? task.status : 'not-started';
                      const dateStr = task?.expectedStartDate || task?.completionDate;
                      const dateInfo = formatDate(dateStr);
                      const percent = task?.percentComplete || 0;

                      return (
                        <td
                          key={trade.id}
                          className="p-1 border-b border-slate-100 h-20 min-h-[80px]"
                        >
                          <div className={`w-full h-full rounded flex flex-col items-center justify-center transition-all ${STATUS_COLORS[status]} relative overflow-hidden`}>
                            {dateInfo ? (
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
                            {status === 'in-progress' && percent > 0 && (
                              <div
                                className="absolute bottom-0 left-0 h-1.5 bg-amber-500/60 transition-all"
                                style={{ width: `${percent}%` }}
                              />
                            )}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
        </div>

        {/* Attachments Section */}
        {project.attachments && project.attachments.length > 0 && (
          <div className="border border-slate-200 p-4 mt-6">
            <h3 className="text-lg font-semibold text-slate-800 mb-4">Attachments</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {project.attachments.map(attachment => (
                <div key={attachment.id} className="border border-slate-200 rounded-lg overflow-hidden">
                  {attachment.type === 'image' ? (
                    <img 
                      src={attachment.url} 
                      alt={attachment.name}
                      className="w-full h-40 object-cover"
                    />
                  ) : (
                    <div className="w-full h-40 bg-slate-100 flex flex-col items-center justify-center">
                      <FileText className="w-12 h-12 text-slate-400 mb-2" />
                      <span className="text-xs text-slate-600 px-2 text-center truncate w-full">{attachment.name}</span>
                    </div>
                  )}
                  <div className="p-2 bg-white border-t border-slate-200">
                    <p className="text-xs text-slate-600 truncate" title={attachment.name}>{attachment.name}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default PublicViewer;
