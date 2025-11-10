// src/components/ProjectsList.tsx
import { Plus, Folder, Edit2, Trash2, Settings as SettingsIcon } from 'lucide-react'
import { useState } from 'react'

interface Project {
  id: string
  title: string
  created_at: string
  updated_at: string
}

interface Props {
  currentProjectId: string | null
  projects: Project[]
  onSelectProject: (id: string) => void
  onCreateNew: () => void
  onDeleteProject: (id: string) => void
  onUpdateTitle: (id: string, title: string) => void
  onOpenConfig: (project: Project) => void  // ← NEW PROP
  showNewButton?: boolean
}

export function ProjectsList({
  currentProjectId,
  projects,
  onSelectProject,
  onCreateNew,
  onDeleteProject,
  onUpdateTitle,
  onOpenConfig,
  showNewButton = true,
}: Props) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editTitle, setEditTitle] = useState('')

  const startEdit = (project: Project) => {
    setEditingId(project.id)
    setEditTitle(project.title)
  }

  const saveEdit = () => {
    if (editingId && editTitle.trim()) {
      onUpdateTitle(editingId, editTitle.trim())
    }
    setEditingId(null)
    setEditTitle('')
  }

  const cancelEdit = () => {
    setEditingId(null)
    setEditTitle('')
  }

  return (
    <div className="flex-1 flex flex-col min-h-0">
      <div className="px-4 pt-4 pb-2 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-900">Projects</h3>
          {showNewButton && (
            <button
              onClick={onCreateNew}
              className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors"
              title="New project"
            >
              <Plus size={18} className="text-gray-600" />
            </button>
          )}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {projects.length === 0 ? (
          <div className="p-8 text-center">
            <Folder className="w-12 h-12 mx-auto text-gray-300 mb-3" />
            <p className="text-sm text-gray-500">No projects yet</p>
            <button
              onClick={onCreateNew}
              className="mt-3 text-sm text-blue-600 hover:text-blue-700 font-medium"
            >
              Create your first project
            </button>
          </div>
        ) : (
          <ul className="divide-y divide-gray-100">
            {projects.map((project) => (
              <li key={project.id}>
                <div className="group relative flex items-center px-4 py-3 hover:bg-gray-50 transition-colors">
                  {editingId === project.id ? (
                    <input
                      type="text"
                      value={editTitle}
                      onChange={(e) => setEditTitle(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') saveEdit()
                        if (e.key === 'Escape') cancelEdit()
                      }}
                      onBlur={saveEdit}
                      className="flex-1 px-2 py-1 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      autoFocus
                    />
                  ) : (
                    <>
                      <button
                        onClick={() => onSelectProject(project.id)}
                        className={`flex-1 text-left text-sm truncate flex items-center gap-2 ${
                          currentProjectId === project.id
                            ? 'font-medium text-gray-900'
                            : 'text-gray-700'
                        }`}
                      >
                        <Folder size={16} className="text-gray-500 flex-shrink-0" />
                        {project.title}
                      </button>

                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        {/* CONFIG BUTTON */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            onOpenConfig(project)
                          }}
                          className="p-1.5 hover:bg-gray-200 rounded transition-colors"
                          title="Project Settings"
                        >
                          <SettingsIcon size={16} className="text-gray-600" />
                        </button>

                        {/* RENAME BUTTON */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            startEdit(project)
                          }}
                          className="p-1.5 hover:bg-gray-200 rounded transition-colors"
                          title="Rename"
                        >
                          <Edit2 size={14} className="text-gray-600" />
                        </button>

                        {/* DELETE BUTTON */}
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            onDeleteProject(project.id)
                          }}
                          className="p-1.5 hover:bg-red-100 rounded transition-colors"
                          title="Delete"
                        >
                          <Trash2 size={14} className="text-red-600" />
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}