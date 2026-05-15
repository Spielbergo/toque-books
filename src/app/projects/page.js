'use client';

import { useState, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { useApp } from '@/contexts/AppContext';
import { useToast } from '@/contexts/ToastContext';
import { formatDate, today } from '@/lib/formatters';
import Button from '@/components/ui/Button';
import Modal from '@/components/ui/Modal';
import EmptyState from '@/components/ui/EmptyState';
import Badge from '@/components/ui/Badge';
import { FormField, Input, Select, Textarea } from '@/components/ui/FormField';
import styles from './page.module.css';

const STATUS_OPTIONS = [
  { value: 'active',    label: 'Active' },
  { value: 'completed', label: 'Completed' },
  { value: 'archived',  label: 'Archived' },
];

const STATUS_BADGE = {
  active:    'info',
  completed: 'success',
  archived:  'muted',
};

function makeBlankProject() {
  return { name: '', clientId: '', status: 'active', description: '', dueDate: '' };
}

function makeBlankTask() {
  return { id: uuidv4(), title: '', done: false, dueDate: '', notes: '' };
}

// ─── Main Page ───────────────────────────────────────────────────────────────

export default function ProjectsPage() {
  const { state, dispatch } = useApp();
  const { toast } = useToast();

  const clients  = state.clients  || [];
  const projects = state.projects || [];

  const [statusFilter, setStatusFilter] = useState('active');
  const [search,       setSearch]       = useState('');

  // ── Project modal ─────────────────────────────────────────────────────────
  const [showProjectModal, setShowProjectModal] = useState(false);
  const [editProject,      setEditProject]      = useState(null);
  const [form,             setForm]             = useState(makeBlankProject());
  const [confirmDel,       setConfirmDel]       = useState(null);

  const set = useCallback(k => v => setForm(f => ({ ...f, [k]: v })), []);

  const openCreate = () => { setEditProject(null); setForm(makeBlankProject()); setShowProjectModal(true); };
  const openEdit   = p  => { setEditProject(p);    setForm({ ...p });            setShowProjectModal(true); };

  const handleSave = e => {
    e.preventDefault();
    if (editProject) {
      dispatch({ type: 'UPDATE_PROJECT', payload: { ...editProject, ...form } });
      toast({ message: `"${form.name}" updated` });
    } else {
      dispatch({ type: 'ADD_PROJECT', payload: form });
      toast({ message: `"${form.name}" created` });
    }
    setShowProjectModal(false);
  };

  const handleDelete = id => {
    const p = projects.find(x => x.id === id);
    dispatch({ type: 'DELETE_PROJECT', payload: id });
    setConfirmDel(null);
    toast({ message: `"${p?.name}" deleted`, type: 'info' });
  };

  // ── Task panel ────────────────────────────────────────────────────────────
  const [activeProject, setActiveProject] = useState(null);
  const [taskForm,      setTaskForm]      = useState({ title: '', dueDate: '', notes: '' });

  const openTasks = p => { setActiveProject(p); setTaskForm({ title: '', dueDate: '', notes: '' }); };

  const addTask = e => {
    e.preventDefault();
    if (!taskForm.title.trim()) return;
    const task = { id: uuidv4(), title: taskForm.title, done: false, dueDate: taskForm.dueDate, notes: taskForm.notes };
    const updated = { ...activeProject, tasks: [...(activeProject.tasks || []), task] };
    dispatch({ type: 'UPDATE_PROJECT', payload: updated });
    setActiveProject(updated);
    setTaskForm({ title: '', dueDate: '', notes: '' });
  };

  const toggleTask = (project, taskId) => {
    const tasks   = (project.tasks || []).map(t => t.id === taskId ? { ...t, done: !t.done } : t);
    const updated = { ...project, tasks };
    dispatch({ type: 'UPDATE_PROJECT', payload: updated });
    if (activeProject?.id === project.id) setActiveProject(updated);
  };

  const deleteTask = (project, taskId) => {
    const tasks   = (project.tasks || []).filter(t => t.id !== taskId);
    const updated = { ...project, tasks };
    dispatch({ type: 'UPDATE_PROJECT', payload: updated });
    if (activeProject?.id === project.id) setActiveProject(updated);
  };

  // ── Filtered list ─────────────────────────────────────────────────────────
  const filtered = projects
    .filter(p => statusFilter === 'all' || p.status === statusFilter)
    .filter(p => !search || p.name.toLowerCase().includes(search.toLowerCase()));

  const clientOptions = [{ value: '', label: 'No client' }, ...clients.map(c => ({ value: c.id, label: c.name }))];

  return (
    <div className={styles.page}>
      <div className={styles.header}>
        <div>
          <h1 className={styles.title}>Projects</h1>
          <p className={styles.sub}>Organize work into projects with tasks and deadlines.</p>
        </div>
        <Button onClick={openCreate}>+ New Project</Button>
      </div>

      {/* ── Filters ── */}
      <div className={styles.toolbar}>
        <input
          className={styles.search}
          placeholder="Search projects…"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <div className={styles.filterTabs}>
          {['active', 'completed', 'archived', 'all'].map(s => (
            <button
              key={s}
              className={`${styles.filterTab} ${statusFilter === s ? styles.filterTabActive : ''}`}
              onClick={() => setStatusFilter(s)}
            >
              {s.charAt(0).toUpperCase() + s.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* ── Project Grid ── */}
      {filtered.length === 0 ? (
        <EmptyState
          title={search ? 'No projects found' : 'No projects yet'}
          description={search ? 'Try adjusting your search.' : 'Create your first project to start organizing work.'}
          action={!search ? { label: '+ New Project', onClick: openCreate } : undefined}
        />
      ) : (
        <div className={styles.grid}>
          {filtered.map(project => {
            const client     = clients.find(c => c.id === project.clientId);
            const tasks      = project.tasks || [];
            const doneTasks  = tasks.filter(t => t.done).length;
            const pct        = tasks.length > 0 ? Math.round((doneTasks / tasks.length) * 100) : 0;
            const timeSpent  = (state.timeEntries || []).filter(e => e.projectId === project.id).reduce((s, e) => s + (e.durationMinutes || 0), 0);
            const h = Math.floor(timeSpent / 60), m = timeSpent % 60;

            return (
              <div key={project.id} className={styles.card}>
                <div className={styles.cardTop}>
                  <div className={styles.cardTitleRow}>
                    <h3 className={styles.cardTitle}>{project.name}</h3>
                    <Badge variant={STATUS_BADGE[project.status] || 'muted'}>{project.status}</Badge>
                  </div>
                  {client && <p className={styles.cardClient}>{client.name}</p>}
                  {project.description && <p className={styles.cardDesc}>{project.description}</p>}
                </div>

                {tasks.length > 0 && (
                  <div className={styles.progress}>
                    <div className={styles.progressBar} style={{ '--pct': `${pct}%` }} />
                    <span className={styles.progressLabel}>{doneTasks}/{tasks.length} tasks · {pct}%</span>
                  </div>
                )}

                <div className={styles.cardMeta}>
                  {project.dueDate && <span>📅 Due {formatDate(project.dueDate)}</span>}
                  {timeSpent > 0 && <span>⏱ {h > 0 ? `${h}h ` : ''}{m > 0 ? `${m}m` : ''}</span>}
                </div>

                <div className={styles.cardActions}>
                  <Button variant="ghost" size="sm" onClick={() => openTasks(project)}>Tasks ({tasks.length})</Button>
                  <Button variant="ghost" size="sm" onClick={() => openEdit(project)}>Edit</Button>
                  <Button variant="ghost" size="sm" onClick={() => setConfirmDel(project.id)}>Delete</Button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ── Project Modal ── */}
      <Modal isOpen={showProjectModal} onClose={() => setShowProjectModal(false)} title={editProject ? 'Edit Project' : 'New Project'} size="md">
        <form onSubmit={handleSave}>
          <FormField label="Project Name" required>
            <Input value={form.name} onChange={set('name')} placeholder="e.g. Website Redesign" required />
          </FormField>
          <div className={styles.modalGrid2}>
            <FormField label="Client">
              <Select value={form.clientId} onChange={set('clientId')} options={clientOptions} />
            </FormField>
            <FormField label="Status">
              <Select value={form.status} onChange={set('status')} options={STATUS_OPTIONS} />
            </FormField>
          </div>
          <FormField label="Due Date">
            <Input type="date" value={form.dueDate} onChange={set('dueDate')} />
          </FormField>
          <FormField label="Description">
            <Textarea value={form.description} onChange={set('description')} placeholder="Brief description of the project…" rows={3} />
          </FormField>
          <div className={styles.modalActionsTop}>
            <Button type="button" variant="ghost" onClick={() => setShowProjectModal(false)}>Cancel</Button>
            <Button type="submit">{editProject ? 'Save Changes' : 'Create Project'}</Button>
          </div>
        </form>
      </Modal>

      {/* ── Tasks Sidebar Modal ── */}
      <Modal isOpen={!!activeProject} onClose={() => setActiveProject(null)} title={activeProject?.name || ''} size="lg">
        {activeProject && (
          <div>
            {/* Add task form */}
            <form onSubmit={addTask} className={styles.addTaskForm}>
              <input
                className={styles.taskInput}
                placeholder="Add a task…"
                value={taskForm.title}
                onChange={e => setTaskForm(f => ({ ...f, title: e.target.value }))}
              />
              <input
                className={styles.taskDate}
                type="date"
                value={taskForm.dueDate}
                onChange={e => setTaskForm(f => ({ ...f, dueDate: e.target.value }))}
                title="Due date"
              />
              <Button type="submit" size="sm">Add</Button>
            </form>

            {/* Task list */}
            {(activeProject.tasks || []).length === 0 ? (
              <p className={styles.noTasks}>No tasks yet. Add one above.</p>
            ) : (
              <ul className={styles.taskList}>
                {(activeProject.tasks || []).map(task => (
                  <li key={task.id} className={`${styles.taskItem} ${task.done ? styles.taskDone : ''}`}>
                    <button
                      type="button"
                      className={styles.taskCheck}
                      onClick={() => toggleTask(activeProject, task.id)}
                      aria-label={task.done ? 'Mark incomplete' : 'Mark complete'}
                    >
                      {task.done ? (
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="7.5" stroke="var(--success)"/><path d="M5 8l2 2 4-4" stroke="var(--success)" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/></svg>
                      ) : (
                        <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><circle cx="8" cy="8" r="7.5" stroke="var(--border-strong)"/></svg>
                      )}
                    </button>
                    <span className={styles.taskTitle}>{task.title}</span>
                    {task.dueDate && <span className={styles.taskDue}>Due {formatDate(task.dueDate)}</span>}
                    <button type="button" className={styles.taskDelete} onClick={() => deleteTask(activeProject, task.id)} aria-label="Delete task">✕</button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </Modal>

      {/* ── Confirm Delete ── */}
      <Modal isOpen={!!confirmDel} onClose={() => setConfirmDel(null)} title="Delete Project?" size="sm">
        <p className={styles.confirmText}>This project and all its tasks will be permanently deleted.</p>
        <div className={styles.modalActions}>
          <Button variant="ghost" onClick={() => setConfirmDel(null)}>Cancel</Button>
          <Button variant="danger" onClick={() => handleDelete(confirmDel)}>Delete</Button>
        </div>
      </Modal>
    </div>
  );
}
