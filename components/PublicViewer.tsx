import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Project, TaskStatus, Task } from '../types';
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

  const getCellText = (task?: { status: TaskStatus; expectedStartDate?: string; completedDate?: string; percentComplete?: number }) => {
    if (!task) return '';

    // Expected Start Date formatting to M/D
    let startStr = '';
    if (task.expectedStartDate) {
      const parts = task.expectedStartDate.split('-');
      if (parts.length === 3) {
        const y = parseInt(parts[0], 10);
        const m = parseInt(parts[1], 10);
        const d = parseInt(parts[2], 10);
        const dateObj = new Date(y, m - 1, d);
        startStr = `${dateObj.getMonth() + 1}/${dateObj.getDate()}`;
      }
    }

    if (task.status === 'complete') {
      if (task.completedDate) {
        const d = new Date(task.completedDate);
        return `Done ${d.getMonth() + 1}/${d.getDate()}`;
      }
      return 'DONE';
    }

    if (task.status === 'in-progress') {
      let text = `Work ${task.percentComplete || 0}%`;
      if (startStr) text += `\nEst: ${startStr}`;
      return text;
    }

    if (task.status === 'ready') {
      let text = 'READY';
      if (startStr) text += `\nEst: ${startStr}`;
      return text;
    }

    if (task.status === 'not-started') {
      if (startStr) return `Est: ${startStr}`;
    }

    return '';
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

  return (
    <div className="min-h-screen bg-white">
      {/* Project Info */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 w-full">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">{project.name}</h1>
            <p className="text-slate-900">Address: {project.address || ''}</p>
            {project.projectedCompletionDate && (
              <p className="text-sm text-slate-900 mt-1">
                Target Completion: {new Date(project.projectedCompletionDate).toLocaleDateString()}
              </p>
            )}
          </div>
          <div className="text-sm text-slate-900">Generated: {new Date().toLocaleDateString()}</div>
        </div>
        <div className="mt-4 flex items-center gap-3">
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
              className="p-1.5 hover:bg-slate-100 text-slate-700"
              title="Zoom Out"
            >
              <ZoomOut className="w-4 h-4" />
            </button>
            <span className="text-xs text-slate-900 w-10 text-center">{zoomLevel}%</span>
            <button
              onClick={() => setZoomLevel(z => Math.min(150, z + 10))}
              className="p-1.5 hover:bg-slate-100 text-slate-700"
              title="Zoom In"
            >
              <ZoomIn className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Matrix View */}
      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-8 w-full">
        <div className="border border-slate-200 overflow-auto">
          <table className="min-w-full border-collapse text-[10px]" style={{ zoom: zoomLevel / 100 }}>
            <thead className="bg-slate-50 sticky top-0 z-40">
              <tr>
                <th className="sticky left-0 z-50 bg-slate-50 p-3 text-left font-semibold text-slate-900 border border-slate-200 w-24 min-w-[100px]">
                  Unit
                </th>
                {interiorTrades.map((trade) => (
                  <th
                    key={trade.id}
                    className="p-2 text-center font-medium text-slate-900 border border-slate-200 min-w-[90px] whitespace-nowrap bg-slate-50"
                  >
                    {trade.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {interiorUnits.map((unit) => (
                <tr key={unit.id}>
                  <td className="sticky left-0 z-20 bg-white p-3 font-medium text-slate-900 border border-slate-200">
                    {unit.name}
                  </td>
                  {interiorTrades.map((trade) => {
                    const key = getTaskKey(unit.id, trade.id);
                    const task = project.tasks[key];
                    const status = task ? task.status : 'not-started';
                    const cellText = getCellText(task || undefined);

                    return (
                      <td
                        key={trade.id}
                        className="p-2 border border-slate-200 text-center align-middle whitespace-pre-line text-[10px] leading-tight text-slate-900"
                      >
                        <div className={`w-full h-full ${STATUS_COLORS[status]} rounded-sm px-1 py-1 text-slate-900`}>
                          {cellText}
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
            <h3 className="text-lg font-semibold text-slate-900 mb-4">Attachments</h3>
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
                      <FileText className="w-12 h-12 text-slate-500 mb-2" />
                      <span className="text-xs text-slate-900 px-2 text-center truncate w-full">{attachment.name}</span>
                    </div>
                  )}
                  <div className="p-2 bg-white border-t border-slate-200">
                    <p className="text-xs text-slate-900 truncate" title={attachment.name}>{attachment.name}</p>
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
