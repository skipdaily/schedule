import React, { useState, useEffect, useRef } from 'react';
import { Project, ViewMode, TaskStatus, Unit, Trade, Attachment } from './types';
import { updateReadinessState, getTaskKey, pushLinkedTasks, ensureWeekday } from './services/logic';
import { generateProjectPDF } from './services/pdf';
import { exportProjectToCSV, importProjectFromCSV, downloadTemplateCSV } from './services/csv';
import { fetchAppState, fetchProjects, saveAppState, upsertProject, deleteProject as deleteProjectRemote, uploadAttachment, deleteAttachment } from './services/supabase';
import Dashboard from './components/Dashboard';
import MatrixView from './components/MatrixView';
import ProjectSetup from './components/ProjectSetup';
import EditProjectModal from './components/EditProjectModal';
import { LayoutDashboard, Grid3X3, Plus, ArrowLeft, XCircle, Play, CheckCircle, Settings, Download, FolderOpen, Trash2, Upload, FileDown, Link2, Unlink, Share2, Image, FileText, X, ToggleLeft, ToggleRight } from 'lucide-react';

const LEGACY_STORAGE_KEY = 'sheduler_projects_v1';

const App: React.FC = () => {
  const [projects, setProjects] = useState<Project[]>([]);
  const [currentProjectId, setCurrentProjectId] = useState<string | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [view, setView] = useState<ViewMode['current']>('dashboard');
  const [showSettings, setShowSettings] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [showProjectSelector, setShowProjectSelector] = useState(false);
  
  // Modal State
  const [selectedTask, setSelectedTask] = useState<{unitId: string, tradeId: string} | null>(null);
  const [expectedDate, setExpectedDate] = useState('');
  const [percentComplete, setPercentComplete] = useState(0);
  const [completionDate, setCompletionDate] = useState('');
  const [modalPosition, setModalPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const dateInputRef = useRef<HTMLInputElement>(null);
  const completionDateRef = useRef<HTMLInputElement>(null);
  
  // Linking mode state
  const [isLinkingMode, setIsLinkingMode] = useState(false);
  const [linkingFromTask, setLinkingFromTask] = useState<{unitId: string, tradeId: string} | null>(null);
  
  // Push dates toggle (controls whether date changes cascade to linked tasks)
  const [pushDatesEnabled, setPushDatesEnabled] = useState(true);
  
  // Attachment upload ref
  const attachmentInputRef = useRef<HTMLInputElement>(null);

  // Derived current project
  const project = projects.find(p => p.id === currentProjectId) || null;

  // Load from Supabase on mount (migrate from local storage if needed)
  useEffect(() => {
    const load = async () => {
      const [remoteProjects, remoteCurrentId] = await Promise.all([
        fetchProjects(),
        fetchAppState()
      ]);

      if (remoteProjects.length > 0) {
        const updatedProjects = remoteProjects.map(p => updateReadinessState(p));
        setProjects(updatedProjects);
        setCurrentProjectId(remoteCurrentId || updatedProjects[0]?.id || null);
        setIsLoaded(true);
        return;
      }

      // Migrate from legacy localStorage if Supabase is empty
      const saved = localStorage.getItem(LEGACY_STORAGE_KEY);
      if (saved) {
        try {
          const parsed = JSON.parse(saved) as { projects: Project[], currentId: string | null };
          const updatedProjects = parsed.projects.map(p => updateReadinessState(p));
          setProjects(updatedProjects);
          setCurrentProjectId(parsed.currentId || updatedProjects[0]?.id || null);
          await Promise.all(updatedProjects.map(p => upsertProject(p)));
          await saveAppState(parsed.currentId || updatedProjects[0]?.id || null);
        } catch (e) {
          console.error('Failed to migrate local projects', e);
        }
      }

      setIsLoaded(true);
    };
    load();
  }, []);

  // Save to Supabase on change
  useEffect(() => {
    if (!isLoaded) return;
    const save = async () => {
      await Promise.all(projects.map(p => upsertProject(p)));
      await saveAppState(currentProjectId);
    };
    save();
  }, [projects, currentProjectId, isLoaded]);

  const handleCreateProject = (newProject: Project) => {
    const updated = updateReadinessState(newProject);
    setProjects(prev => [...prev, updated]);
    setCurrentProjectId(updated.id);
    setView('dashboard');
  };

  const handleSwitchProject = (projectId: string) => {
    setCurrentProjectId(projectId);
    setShowProjectSelector(false);
    setView('dashboard');
  };

  const handleDeleteProject = (projectId: string) => {
    setProjects(prev => prev.filter(p => p.id !== projectId));
    if (currentProjectId === projectId) {
      const remaining = projects.filter(p => p.id !== projectId);
      setCurrentProjectId(remaining.length > 0 ? remaining[0].id : null);
    }
    deleteProjectRemote(projectId);
  };

  const handleImportCSV = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    try {
      const importedProject = await importProjectFromCSV(file);
      const updated = updateReadinessState(importedProject);
      setProjects(prev => [...prev, updated]);
      setCurrentProjectId(updated.id);
      setShowProjectSelector(false);
      setView('dashboard');
    } catch (error: any) {
      console.error('Failed to import project:', error);
      alert(`Failed to import project: ${error.message || 'Please check the file format.'}`);
    }
    
    // Reset the input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleExportCSV = () => {
    if (project) {
      exportProjectToCSV(project);
    }
  };


  const handleSyncToSupabase = async () => {
    if (isSyncing) return;
    setIsSyncing(true);
    try {
      await Promise.all(projects.map(p => upsertProject(p)));
      await saveAppState(currentProjectId);
      alert('Synced to Supabase.');
    } catch (error) {
      console.error('Failed to sync to Supabase', error);
      alert('Sync failed. Check Supabase settings.');
    } finally {
      setIsSyncing(false);
    }
  };

  // Helper to update the current project in the projects array
  const updateCurrentProject = (updatedProject: Project) => {
    setProjects(prev => prev.map(p => p.id === updatedProject.id ? updatedProject : p));
  };
  
  const handleUpdateProject = (updatedProject: Project) => {
    const processed = updateReadinessState(updatedProject);
    updateCurrentProject(processed);
  };

  const handleReorderUnits = (newUnits: Unit[]) => {
    if (!project) return;
    updateCurrentProject({ ...project, units: newUnits });
  };

  const handleAddUnit = (unitData: { name: string; building: string }) => {
    if (!project) return;
    const newUnit: Unit = {
      id: `u_${Date.now()}`,
      name: unitData.name,
      building: unitData.building,
      scope: 'interior'
    };
    
    // Create tasks for this unit for all interior trades
    const newTasks = { ...project.tasks };
    project.trades.filter(t => t.scope === 'interior').forEach(trade => {
      const key = getTaskKey(newUnit.id, trade.id);
      newTasks[key] = {
        id: key,
        unitId: newUnit.id,
        tradeId: trade.id,
        status: 'not-started',
        lastUpdated: new Date().toISOString()
      };
    });
    
    const updatedProject = updateReadinessState({
      ...project,
      units: [...project.units, newUnit],
      tasks: newTasks
    });
    
    updateCurrentProject(updatedProject);
  };

  const handleEditUnit = (unitId: string, unitData: { name: string; building: string }) => {
    if (!project) return;
    const updatedUnits = project.units.map(u => 
      u.id === unitId ? { ...u, name: unitData.name, building: unitData.building } : u
    );
    updateCurrentProject({ ...project, units: updatedUnits });
  };

  const handleDeleteUnit = (unitId: string) => {
    if (!project) return;
    
    // Remove the unit
    const newUnits = project.units.filter(u => u.id !== unitId);
    
    // Remove all tasks associated with this unit
    const newTasks: Record<string, any> = {};
    Object.entries(project.tasks).forEach(([key, task]) => {
      if (task.unitId !== unitId) {
        newTasks[key] = task;
      }
    });
    
    const updatedProject = updateReadinessState({
      ...project,
      units: newUnits,
      tasks: newTasks
    });
    
    updateCurrentProject(updatedProject);
  };

  const handleReorderTrades = (newTrades: Trade[]) => {
    if (!project) return;
    const updatedProject = updateReadinessState({ ...project, trades: newTrades });
    updateCurrentProject(updatedProject);
  };

  const handleDeleteTrade = (tradeId: string) => {
    if (!project) return;
    
    // Remove the trade
    const newTrades = project.trades.filter(t => t.id !== tradeId);
    
    // Remove all tasks associated with this trade
    const newTasks: Record<string, any> = {};
    Object.entries(project.tasks).forEach(([key, task]) => {
      if (task.tradeId !== tradeId) {
        newTasks[key] = task;
      }
    });
    
    const updatedProject = updateReadinessState({
      ...project,
      trades: newTrades,
      tasks: newTasks
    });
    
    updateCurrentProject(updatedProject);
  };

  const handleEditTrade = (tradeId: string, newName: string) => {
    if (!project) return;
    
    const newTrades = project.trades.map(t => 
      t.id === tradeId ? { ...t, name: newName } : t
    );
    
    const updatedProject = { ...project, trades: newTrades };
    updateCurrentProject(updatedProject);
  };

  const handleAddTrade = (trade: { name: string; scope: 'interior' | 'exterior'; defaultDurationDays: number }, insertAtIndex?: number) => {
    if (!project) return;
    
    // Get trades for this scope
    const scopedTrades = project.trades.filter(t => t.scope === trade.scope);
    const otherTrades = project.trades.filter(t => t.scope !== trade.scope);
    
    const newTrade = {
      ...trade,
      id: `tr_${trade.scope}_${Date.now()}`,
      orderIndex: 0 // Will be recalculated
    };
    
    // Insert at the specified position or at the end
    let newScopedTrades: typeof scopedTrades;
    if (insertAtIndex !== undefined && insertAtIndex >= 0) {
      newScopedTrades = [
        ...scopedTrades.slice(0, insertAtIndex),
        newTrade,
        ...scopedTrades.slice(insertAtIndex)
      ];
    } else {
      newScopedTrades = [...scopedTrades, newTrade];
    }
    
    // Recalculate orderIndex for all trades in this scope
    newScopedTrades = newScopedTrades.map((t, i) => ({ ...t, orderIndex: i }));
    
    // Combine with other scope trades
    const allTrades = [...newScopedTrades, ...otherTrades];
    
    // Add tasks for this new trade for all units/areas of matching scope
    const newTasks = { ...project.tasks };
    const entities = trade.scope === 'interior' ? project.units : project.areas;
    
    entities.forEach(entity => {
      const key = getTaskKey(entity.id, newTrade.id);
      newTasks[key] = {
        id: key,
        unitId: entity.id,
        tradeId: newTrade.id,
        status: 'not-started',
        lastUpdated: new Date().toISOString()
      };
    });
    
    const updatedProject = updateReadinessState({
      ...project,
      trades: allTrades,
      tasks: newTasks
    });
    
    updateCurrentProject(updatedProject);
  };

  const handleDownloadPdf = () => {
    if (project) {
        generateProjectPDF(project);
    }
  };

  // Attachment handlers
  const handleAttachmentUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!project || !e.target.files) return;
    
    const files = Array.from(e.target.files);
    
    for (const file of files) {
      const isImage = file.type.startsWith('image/');
      const isPdf = file.type === 'application/pdf';
      
      if (!isImage && !isPdf) {
        alert('Please upload only images or PDF files');
        continue;
      }
      
      // Upload to Supabase Storage
      const result = await uploadAttachment(project.id, file);
      
      if (result) {
        const newAttachment: Attachment = {
          id: `att_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          name: file.name,
          type: isImage ? 'image' : 'pdf',
          url: result.url,
          storagePath: result.path,
          addedAt: new Date().toISOString()
        };
        
        const updatedProject = {
          ...project,
          attachments: [...(project.attachments || []), newAttachment]
        };
        
        updateCurrentProject(updatedProject);
      } else {
        alert(`Failed to upload ${file.name}`);
      }
    }
    
    // Reset input
    e.target.value = '';
  };

  const handleDeleteAttachment = async (attachmentId: string) => {
    if (!project) return;
    
    const attachment = project.attachments?.find(a => a.id === attachmentId);
    if (attachment?.storagePath) {
      await deleteAttachment(attachment.storagePath);
    }
    
    const updatedProject = {
      ...project,
      attachments: (project.attachments || []).filter(a => a.id !== attachmentId)
    };
    
    updateCurrentProject(updatedProject);
  };

  const handleTaskClick = (unitId: string, tradeId: string) => {
    // If in linking mode, create the link
    if (isLinkingMode && linkingFromTask && project) {
      const fromKey = getTaskKey(linkingFromTask.unitId, linkingFromTask.tradeId);
      const toKey = getTaskKey(unitId, tradeId);
      
      // Don't link to self
      if (fromKey !== toKey) {
        const currentTask = project.tasks[fromKey];
        const newTasks = {
          ...project.tasks,
          [fromKey]: {
            ...currentTask,
            linkedToTaskKey: toKey,
            lastUpdated: new Date().toISOString()
          }
        };
        updateCurrentProject({ ...project, tasks: newTasks });
      }
      
      // Exit linking mode
      setIsLinkingMode(false);
      setLinkingFromTask(null);
      return;
    }
    
    setSelectedTask({ unitId, tradeId });
    const key = getTaskKey(unitId, tradeId);
    const task = project?.tasks[key];
    setExpectedDate(task?.expectedStartDate || '');
    setPercentComplete(task?.percentComplete || 0);
    setCompletionDate(task?.completedDate?.split('T')[0] || '');
    setPushDatesEnabled(!task?.pushDatesDisabled); // Load saved toggle state (default ON)
  };

  const startLinkingMode = () => {
    if (!selectedTask) return;
    setLinkingFromTask(selectedTask);
    setIsLinkingMode(true);
    setSelectedTask(null); // Close modal while linking
    setModalPosition({ x: 0, y: 0 });
  };

  const removeLink = () => {
    if (!project || !selectedTask) return;
    const key = getTaskKey(selectedTask.unitId, selectedTask.tradeId);
    const currentTask = project.tasks[key];
    const newTasks = {
      ...project.tasks,
      [key]: {
        ...currentTask,
        linkedToTaskKey: undefined,
        lastUpdated: new Date().toISOString()
      }
    };
    updateCurrentProject({ ...project, tasks: newTasks });
  };

  const cancelLinkingMode = () => {
    setIsLinkingMode(false);
    setLinkingFromTask(null);
  };

  const updateTaskStatus = (status: TaskStatus) => {
    if (!project || !selectedTask) return;

    const key = getTaskKey(selectedTask.unitId, selectedTask.tradeId);
    const currentTask = project.tasks[key];
    
    // Prevent jumping sequence inappropriately, although as Super, we allow override
    const now = new Date().toISOString();
    
    // Auto-update percentage based on status change
    let newPercent = percentComplete;
    if (status === 'complete') newPercent = 100;
    if (status === 'ready' || status === 'not-started') newPercent = 0;

    // Use custom completion date if provided, otherwise use now
    const completedDateValue = status === 'complete' 
      ? (completionDate ? `${completionDate}T12:00:00.000Z` : now)
      : currentTask.completedDate;

    const newTasks = {
        ...project.tasks,
        [key]: {
            ...currentTask,
            status,
            expectedStartDate: expectedDate || undefined,
            completedDate: completedDateValue,
            percentComplete: newPercent,
            lastUpdated: now
        }
    };

    let updatedProject = { ...project, tasks: newTasks };
    
    // Recalculate readiness cascade
    updatedProject = updateReadinessState(updatedProject);

    updateCurrentProject(updatedProject);
    setSelectedTask(null);
  };

  const saveDetails = () => {
    if (!project || !selectedTask) return;
    const key = getTaskKey(selectedTask.unitId, selectedTask.tradeId);
    const currentTask = project.tasks[key];

    // Check if date changed and needs to push linked tasks
    let newTasks = { ...project.tasks };
    
    if (pushDatesEnabled && expectedDate && expectedDate !== currentTask.expectedStartDate) {
      // Push linked tasks when date changes (only if toggle is enabled)
      newTasks = pushLinkedTasks(
        project,
        selectedTask.unitId,
        selectedTask.tradeId,
        expectedDate,
        newTasks
      );
    }
    
    // Update the current task with new date and percent
    newTasks[key] = {
      ...newTasks[key],
      expectedStartDate: expectedDate || undefined,
      percentComplete: percentComplete,
      pushDatesDisabled: !pushDatesEnabled, // Save toggle state
      lastUpdated: new Date().toISOString()
    };
    
    updateCurrentProject({ ...project, tasks: newTasks });
    setSelectedTask(null);
    setModalPosition({ x: 0, y: 0 });
  };

  const clearExpectedDate = () => {
    if (!project || !selectedTask) return;
    const key = getTaskKey(selectedTask.unitId, selectedTask.tradeId);
    const newTasks = {
      ...project.tasks,
      [key]: {
        ...project.tasks[key],
        expectedStartDate: undefined,
        lastUpdated: new Date().toISOString()
      }
    };

    setExpectedDate('');
    updateCurrentProject({ ...project, tasks: newTasks });
  };

  // Render modal
  const renderModal = () => {
    if (!selectedTask || !project) return null;
    const { unitId, tradeId } = selectedTask;
    const taskKey = getTaskKey(unitId, tradeId);
    const task = project.tasks[taskKey];
    
    const unitName = [...project.units, ...project.areas].find(u => u.id === unitId)?.name;
    const tradeName = project.trades.find(t => t.id === tradeId)?.name;

    const handleMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
      if ((e.target as HTMLElement).closest('button, input')) return;
      
      // Get the actual modal element position
      const modalEl = (e.target as HTMLElement).closest('.bg-white.rounded-xl') as HTMLElement;
      if (!modalEl) return;
      
      const rect = modalEl.getBoundingClientRect();
      
      setIsDragging(true);
      setDragOffset({
        x: e.clientX - rect.left,
        y: e.clientY - rect.top
      });
      
      // Set initial position to actual position if not already dragged
      if (modalPosition.x === 0 && modalPosition.y === 0) {
        setModalPosition({
          x: rect.left,
          y: rect.top
        });
      }
    };

    const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
      if (!isDragging) return;
      setModalPosition({
        x: e.clientX - dragOffset.x,
        y: e.clientY - dragOffset.y
      });
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    return (
        <div 
          className="fixed inset-0 bg-black/30 z-50" 
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        >
            <div 
              className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-fade-in absolute max-h-[calc(100vh-100px)] flex flex-col"
              style={ 
                modalPosition.x === 0 && modalPosition.y === 0
                  ? { right: '20px', top: '80px' }
                  : { left: modalPosition.x, top: modalPosition.y }
              }
            >
                <div 
                  className="bg-slate-50 p-4 border-b border-slate-200 flex justify-between items-center cursor-move flex-shrink-0"
                  onMouseDown={handleMouseDown}
                >
                    <div>
                        <h3 className="font-bold text-slate-800">{unitName}</h3>
                        <p className="text-slate-500 text-sm">{tradeName}</p>
                    </div>
                    <button onClick={() => { setSelectedTask(null); setModalPosition({ x: 0, y: 0 }); }} className="text-slate-400 hover:text-slate-600">
                        <XCircle className="w-6 h-6" />
                    </button>
                </div>
                
                <div className="p-6 space-y-6 overflow-y-auto flex-1">
                    
                    {/* Date and Progress Input Group */}
                    <div className="space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-slate-700 mb-1">Expected Start Date</label>
                          <div className="flex items-center gap-2">
                            <input 
                              ref={dateInputRef}
                              type="date" 
                              value={expectedDate}
                              onChange={(e) => setExpectedDate(e.target.value)}
                              onClick={() => dateInputRef.current?.showPicker()}
                              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none cursor-pointer"
                            />
                            <button
                              type="button"
                              onClick={clearExpectedDate}
                              className="px-3 py-2 text-sm text-slate-600 border border-slate-300 rounded-lg hover:bg-slate-50"
                            >
                              Clear
                            </button>
                          </div>
                        </div>

                        <div>
                             <div className="flex justify-between items-center mb-1">
                                 <label className="text-sm font-medium text-slate-700">Completion Progress</label>
                                 <span className="text-sm font-bold text-indigo-600">{percentComplete}%</span>
                             </div>
                             <input 
                                type="range" 
                                min="0" 
                                max="100" 
                                step="5"
                                value={percentComplete}
                                onChange={(e) => setPercentComplete(Number(e.target.value))}
                                className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-indigo-600"
                             />
                        </div>

                        {/* Push Dates Toggle */}
                        <button
                            onClick={() => setPushDatesEnabled(!pushDatesEnabled)}
                            className={`flex items-center gap-2 w-full p-2 rounded-lg border transition-colors ${
                                pushDatesEnabled 
                                    ? 'bg-emerald-50 border-emerald-200 text-emerald-700' 
                                    : 'bg-slate-50 border-slate-200 text-slate-500'
                            }`}
                        >
                            {pushDatesEnabled ? (
                                <ToggleRight className="w-5 h-5 text-emerald-600" />
                            ) : (
                                <ToggleLeft className="w-5 h-5 text-slate-400" />
                            )}
                            <span className="text-sm font-medium">
                                Push dates to linked tasks: {pushDatesEnabled ? 'ON' : 'OFF'}
                            </span>
                        </button>

                        {(() => {
                            const hasChanges = 
                                expectedDate !== (task.expectedStartDate || '') ||
                                percentComplete !== (task.percentComplete || 0) ||
                                pushDatesEnabled !== !task.pushDatesDisabled;
                            return (
                                <button 
                                    onClick={saveDetails}
                                    className={`w-full py-2 font-medium rounded-lg border transition-all ${
                                        hasChanges 
                                            ? 'bg-indigo-600 text-white border-indigo-600 hover:bg-indigo-700 shadow-md' 
                                            : 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200'
                                    }`}
                                >
                                    {hasChanges ? '💾 Save Details' : 'Save Details'}
                                </button>
                            );
                        })()}
                    </div>

                    <div className="flex flex-col gap-3 pt-4 border-t border-slate-100">
                        <p className="text-sm font-medium text-slate-700 mb-1">Change Status:</p>
                        
                        <button 
                            onClick={() => updateTaskStatus('in-progress')}
                            className={`flex items-center gap-3 p-3 rounded-lg border-2 font-semibold transition-all ${
                                task.status === 'in-progress' 
                                ? 'border-amber-500 bg-amber-50 text-amber-700' 
                                : 'border-slate-100 hover:border-amber-200 text-slate-600'
                            }`}
                        >
                            <div className="bg-amber-100 p-2 rounded-full text-amber-600"><Play className="w-4 h-4" /></div>
                            Start Work (In Progress)
                        </button>

                        <div className={`rounded-lg border-2 transition-all ${
                                task.status === 'complete' 
                                ? 'border-emerald-500 bg-emerald-50' 
                                : 'border-slate-100 hover:border-emerald-200'
                            }`}>
                            <div className="flex items-center gap-3 p-3">
                                <div className="bg-emerald-100 p-2 rounded-full text-emerald-600"><CheckCircle className="w-4 h-4" /></div>
                                <div className="flex-1">
                                    <span className={`font-semibold ${task.status === 'complete' ? 'text-emerald-700' : 'text-slate-600'}`}>Mark Complete</span>
                                    <input 
                                        ref={completionDateRef}
                                        type="date" 
                                        value={completionDate}
                                        onChange={(e) => setCompletionDate(e.target.value)}
                                        onClick={(e) => { e.stopPropagation(); completionDateRef.current?.showPicker(); }}
                                        className="block w-full mt-1 px-2 py-1 text-sm border border-slate-200 rounded focus:ring-2 focus:ring-emerald-500 outline-none cursor-pointer"
                                    />
                                </div>
                                <button 
                                    onClick={() => updateTaskStatus('complete')}
                                    className="px-3 py-1 bg-emerald-600 text-white text-sm font-medium rounded-lg hover:bg-emerald-700"
                                >
                                    Save
                                </button>
                            </div>
                        </div>
                        
                        {task.status !== 'ready' && task.status !== 'not-started' && (
                           <button 
                                onClick={() => updateTaskStatus('ready')}
                                className="text-center text-sm text-slate-400 hover:text-slate-600 py-2"
                            >
                                Reset to Ready
                            </button>
                        )}
                    </div>
                    
                    {/* Custom Linking Section */}
                    <div className="pt-4 border-t border-slate-100">
                        <p className="text-sm font-medium text-slate-700 mb-2">Custom Link:</p>
                        {task.linkedToTaskKey ? (
                            <div className="flex items-center gap-2 p-2 bg-indigo-50 rounded-lg border border-indigo-200">
                                <Link2 className="w-4 h-4 text-indigo-600" />
                                <span className="text-sm text-indigo-700 flex-1">
                                  Linked to: {(() => {
                                    const linkedTrade = project.trades.find(t => task.linkedToTaskKey?.endsWith(`_${t.id}`));
                                    const linkedUnitId = linkedTrade
                                      ? task.linkedToTaskKey!.slice(0, -(linkedTrade.id.length + 1))
                                      : task.linkedToTaskKey!;
                                    const linkedUnit = [...project.units, ...project.areas].find(u => u.id === linkedUnitId);
                                    return `${linkedUnit?.name || 'Unknown'} - ${linkedTrade?.name || 'Unknown'}`;
                                  })()}
                                </span>
                                <button 
                                    onClick={removeLink}
                                    className="p-1 text-red-500 hover:text-red-700"
                                    title="Remove link"
                                >
                                    <Unlink className="w-4 h-4" />
                                </button>
                            </div>
                        ) : (
                            <button 
                                onClick={startLinkingMode}
                                className="w-full flex items-center justify-center gap-2 p-2 border-2 border-dashed border-slate-300 rounded-lg text-slate-600 hover:border-indigo-400 hover:text-indigo-600 transition-colors"
                            >
                                <Link2 className="w-4 h-4" />
                                Link to another task...
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
  };

  // Main Render
  return (
    <div className="min-h-screen flex flex-col bg-slate-50">
      {/* Navigation Bar */}
      <nav className="bg-slate-900 text-white shadow-lg z-30 sticky top-0">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-2">
               <div className="w-8 h-8 bg-indigo-500 rounded-lg flex items-center justify-center font-bold text-lg">F</div>
               <span className="font-bold text-xl tracking-tight hidden sm:block">Schedule</span>
            </div>
            
            {project && (
                <div className="flex items-center space-x-2 bg-slate-800 rounded-lg p-1">
                <button
                    onClick={() => setView('dashboard')}
                    className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                    view === 'dashboard' ? 'bg-slate-700 text-white shadow' : 'text-slate-300 hover:text-white'
                    }`}
                >
                    <span className="flex items-center gap-2"><LayoutDashboard className="w-4 h-4" /> <span className="hidden sm:inline">Dashboard</span></span>
                </button>
                <button
                    onClick={() => setView('matrix')}
                    className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                    view === 'matrix' ? 'bg-slate-700 text-white shadow' : 'text-slate-300 hover:text-white'
                    }`}
                >
                    <span className="flex items-center gap-2"><Grid3X3 className="w-4 h-4" /> <span className="hidden sm:inline">Matrix</span></span>
                </button>
                </div>
            )}

            <div className="flex items-center gap-2">
                 {project ? (
                     <>
                        <button 
                            onClick={() => setShowProjectSelector(true)}
                            className="text-slate-300 hover:text-white px-3 py-1.5 rounded-lg hover:bg-slate-800 transition-colors flex items-center gap-2 text-sm font-medium"
                            title="Switch Project"
                        >
                            <FolderOpen className="w-4 h-4" />
                            <span className="hidden md:inline max-w-[150px] truncate">{project.name}</span>
                        </button>
                        
                        <button 
                            onClick={handleExportCSV}
                            className="text-slate-300 hover:text-white p-2 rounded-full hover:bg-slate-800 transition-colors"
                            title="Export to CSV"
                        >
                            <FileDown className="w-5 h-5" />
                        </button>

                        <button 
                          onClick={handleSyncToSupabase}
                          className={`text-slate-300 hover:text-white p-2 rounded-full hover:bg-slate-800 transition-colors ${isSyncing ? 'opacity-50 cursor-not-allowed' : ''}`}
                          title="Sync to Supabase"
                          disabled={isSyncing}
                        >
                          <Upload className="w-5 h-5" />
                        </button>

                        <button 
                          onClick={() => {
                            const shareUrl = `${window.location.origin}/view/${project.id}`;
                            navigator.clipboard.writeText(shareUrl).then(() => {
                              alert('Share link copied to clipboard!');
                            }).catch(() => {
                              prompt('Copy this link to share:', shareUrl);
                            });
                          }}
                          className="text-slate-300 hover:text-white p-2 rounded-full hover:bg-slate-800 transition-colors"
                          title="Share Schedule"
                        >
                          <Share2 className="w-5 h-5" />
                        </button>
                        
                        <button 
                            onClick={handleDownloadPdf}
                            className="text-slate-300 hover:text-white p-2 rounded-full hover:bg-slate-800 transition-colors"
                            title="Download PDF Report"
                        >
                            <Download className="w-5 h-5" />
                        </button>

                        
                        <button 
                            onClick={() => setShowSettings(true)}
                            className="text-slate-300 hover:text-white p-2 rounded-full hover:bg-slate-800 transition-colors"
                            title="Project Settings"
                        >
                            <Settings className="w-5 h-5" />
                        </button>
                     </>
                 ) : (
                     <button 
                         onClick={() => projects.length > 0 ? setShowProjectSelector(true) : setView('setup')}
                         className="text-slate-300 hover:text-white px-3 py-1.5 rounded-lg hover:bg-slate-800 transition-colors flex items-center gap-2 text-sm font-medium"
                     >
                         <FolderOpen className="w-4 h-4" />
                         <span className="hidden sm:inline">Projects</span>
                     </button>
                 )}
            </div>
          </div>
        </div>
      </nav>

      {/* Content Area */}
      <main className="flex-1 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 w-full">
        {!project && view !== 'setup' ? (
           <div className="flex flex-col items-center justify-center h-[80vh] text-center space-y-6">
                <div className="bg-white p-10 rounded-2xl shadow-xl border border-slate-200 max-w-lg">
                    <h1 className="text-3xl font-bold text-slate-900 mb-2">Welcome to your schedule</h1>
                    <p className="text-slate-600 mb-8">
                        The unit-driven scheduling system for modern superintendents. 
                        Stop guessing dates. Start managing flow.
                    </p>
                    <button 
                        onClick={() => setView('setup')}
                        className="bg-indigo-600 hover:bg-indigo-700 text-white text-lg font-semibold px-8 py-4 rounded-xl shadow-lg hover:shadow-xl transition-all flex items-center gap-3 mx-auto"
                    >
                        <Plus className="w-6 h-6" /> Create New Project
                    </button>
                </div>
           </div>
        ) : !project && view === 'setup' ? (
          <ProjectSetup onSave={handleCreateProject} onCancel={() => setView('dashboard')} />
        ) : (
          <>
            {view === 'setup' && <ProjectSetup onSave={handleCreateProject} onCancel={() => setView('dashboard')} />}
            {view === 'dashboard' && <Dashboard project={project} onTaskClick={handleTaskClick} />}
            {view === 'matrix' && (
              <>
                <MatrixView project={project} onTaskClick={handleTaskClick} onReorderUnits={handleReorderUnits} onReorderTrades={handleReorderTrades} onDeleteTrade={handleDeleteTrade} onAddTrade={handleAddTrade} onEditTrade={handleEditTrade} onAddUnit={handleAddUnit} onEditUnit={handleEditUnit} onDeleteUnit={handleDeleteUnit} isLinkingMode={isLinkingMode} linkingFromTask={linkingFromTask} onCancelLinking={cancelLinkingMode} />
                
                {/* Attachments Section */}
                <div className="bg-white shadow-sm rounded-lg border border-slate-200 p-4 mt-4">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="text-lg font-semibold text-slate-800">Attachments</h3>
                    <div>
                      <input
                        ref={attachmentInputRef}
                        type="file"
                        accept="image/*,application/pdf"
                        multiple
                        onChange={handleAttachmentUpload}
                        className="hidden"
                      />
                      <button
                        onClick={() => attachmentInputRef.current?.click()}
                        className="flex items-center gap-2 px-3 py-1.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-sm"
                      >
                        <Upload className="w-4 h-4" />
                        Upload Photo/PDF
                      </button>
                    </div>
                  </div>
                  
                  {(!project?.attachments || project.attachments.length === 0) ? (
                    <p className="text-slate-500 text-sm">No attachments yet. Upload photos or PDFs to include them in reports.</p>
                  ) : (
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                      {project.attachments.map(attachment => (
                        <div key={attachment.id} className="relative group border border-slate-200 rounded-lg overflow-hidden">
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
                          <button
                            onClick={() => handleDeleteAttachment(attachment.id)}
                            className="absolute top-2 right-2 p-1 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600"
                            title="Delete attachment"
                          >
                            <X className="w-4 h-4" />
                          </button>
                          <div className="p-2 bg-white border-t border-slate-200">
                            <p className="text-xs text-slate-600 truncate" title={attachment.name}>{attachment.name}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}
          </>
        )}
      </main>
      
      {/* Modal */}
      {renderModal()}
      
      {/* Settings Modal */}
      {showSettings && project && (
          <EditProjectModal 
            project={project} 
            onSave={handleUpdateProject} 
            onClose={() => setShowSettings(false)} 
          />
      )}

      {/* Project Selector Modal */}
      {showProjectSelector && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden">
            <div className="bg-slate-50 p-4 border-b border-slate-200 flex justify-between items-center">
              <h3 className="font-bold text-slate-800">Your Projects</h3>
              <button onClick={() => setShowProjectSelector(false)} className="text-slate-400 hover:text-slate-600">
                <XCircle className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 max-h-[60vh] overflow-y-auto">
              {projects.length === 0 ? (
                <p className="text-slate-500 text-center py-8">No projects yet. Create your first one!</p>
              ) : (
                <div className="space-y-2">
                  {projects.map(p => (
                    <div 
                      key={p.id} 
                      className={`p-3 rounded-lg border flex items-center justify-between group cursor-pointer transition-colors ${
                        p.id === currentProjectId 
                          ? 'bg-indigo-50 border-indigo-300' 
                          : 'bg-white border-slate-200 hover:bg-slate-50'
                      }`}
                      onClick={() => handleSwitchProject(p.id)}
                    >
                      <div>
                        <p className="font-medium text-slate-800">{p.name}</p>
                        <p className="text-xs text-slate-500">{p.units.length} units • {p.trades.filter(t => t.scope === 'interior').length} trades</p>
                      </div>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          if (confirm(`Delete "${p.name}"? This cannot be undone.`)) {
                            handleDeleteProject(p.id);
                          }
                        }}
                        className="text-slate-400 hover:text-red-500 p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                        title="Delete project"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
            <div className="p-4 border-t border-slate-200 space-y-3">
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    setShowProjectSelector(false);
                    setView('setup');
                  }}
                  className="flex-1 py-2 px-4 bg-indigo-600 text-white font-medium rounded-lg hover:bg-indigo-700 flex items-center justify-center gap-2"
                >
                  <Plus className="w-4 h-4" />
                  Create New
                </button>
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="flex-1 py-2 px-4 bg-slate-100 text-slate-700 font-medium rounded-lg hover:bg-slate-200 flex items-center justify-center gap-2 border border-slate-200"
                >
                  <Upload className="w-4 h-4" />
                  Import CSV
                </button>
              </div>
              <button
                onClick={() => downloadTemplateCSV()}
                className="w-full py-2 px-4 text-slate-500 text-sm hover:text-slate-700 flex items-center justify-center gap-2"
              >
                <FileDown className="w-4 h-4" />
                Download Template CSV
              </button>
            </div>
          </div>
        </div>
      )}
      
      {/* Hidden file input for CSV import */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".csv"
        onChange={handleImportCSV}
        style={{ display: 'none' }}
      />
    </div>
  );
};

export default App;