import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Project, TaskStatus } from '../types';
import { STATUS_COLORS, STATUS_LABELS } from '../constants';
import { getTaskKey } from '../services/logic';
import { fetchProjects } from '../services/supabase';
import { generateProjectPDF } from '../services/pdf';
import { Check, Play, Clock, Calendar, Loader2, FileDown, ZoomIn, ZoomOut, FileText } from 'lucide-react';

const PublicViewer: React.FC = () => {
  const { projectId } = useParams<{ projectId: string }>();
  const [project, setProject] = useState<Project | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [zoomLevel, setZoomLevel] = useState(100);

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

  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      {/* Header */}
      <nav className="bg-slate-900 text-white shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-indigo-500 rounded-lg flex items-center justify-center font-bold text-lg">F</div>
              <span className="font-bold text-xl tracking-tight">FlowState</span>
            </div>
            <div className="text-slate-300 text-sm">
              View Only
            </div>
          </div>
        </div>
      </nav>

      {/* Project Info */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 w-full">
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-4 mb-4">
          <h1 className="text-2xl font-bold text-slate-800">{project.name}</h1>
          {project.address && <p className="text-slate-500">{project.address}</p>}
          {project.projectedCompletionDate && (
            <p className="text-sm text-slate-500 mt-1">
              Target Completion: {new Date(project.projectedCompletionDate).toLocaleDateString()}
            </p>
          )}
        </div>
      </div>

      {/* Matrix View */}
      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-6 w-full">
        <div className="bg-white shadow-sm rounded-lg border border-slate-200 overflow-hidden flex flex-col h-full">
          <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-slate-50">
            <h2 className="text-lg font-semibold text-slate-800">Interior Unit Matrix</h2>
            <div className="flex items-center gap-4">
              <button
                onClick={() => generateProjectPDF(project)}
                className="flex items-center gap-2 px-3 py-1.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-sm"
              >
                <FileDown className="w-4 h-4" />
                Download PDF
              </button>
              <div className="flex items-center gap-1 border border-slate-300 rounded-lg overflow-hidden">
                <button
                  onClick={() => setZoomLevel(z => Math.max(10, z - 10))}
                  className="p-1.5 hover:bg-slate-100 text-slate-600"
                  title="Zoom Out"
                >
                  <ZoomOut className="w-4 h-4" />
                </button>
                <span className="text-xs text-slate-600 w-10 text-center">{zoomLevel}%</span>
                <button
                  onClick={() => setZoomLevel(z => Math.min(150, z + 10))}
                  className="p-1.5 hover:bg-slate-100 text-slate-600"
                  title="Zoom In"
                >
                  <ZoomIn className="w-4 h-4" />
                </button>
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
          </div>

          <div className="overflow-auto flex-1">
            <table className="min-w-full border-collapse text-sm" style={{ zoom: zoomLevel / 100 }}>
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
                  <tr key={unit.id} className="hover:bg-slate-50">
                    <td className="sticky left-0 z-20 bg-white p-3 font-medium text-slate-700 border-b border-r border-slate-200 shadow-[2px_0_5px_-2px_rgba(0,0,0,0.1)]">
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
        </div>

        {/* Attachments Section */}
        {project.attachments && project.attachments.length > 0 && (
          <div className="bg-white shadow-sm rounded-lg border border-slate-200 p-4 mt-4">
            <h3 className="text-lg font-semibold text-slate-800 mb-4">Attachments</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {project.attachments.map(attachment => (
                <div key={attachment.id} className="border border-slate-200 rounded-lg overflow-hidden">
                  {attachment.type === 'image' ? (
                    <img 
                      src={attachment.dataUrl} 
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
