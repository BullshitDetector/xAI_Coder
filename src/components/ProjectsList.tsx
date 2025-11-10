// src/components/ProjectsList.tsx
import { useState } from 'react'
import { Plus, Folder, Edit2, Check, X, Trash2 } from 'lucide-react'

type Project = {
  id: string
  title: string
  created_at: string
  updated_at: string
}

type Props = {
  currentProjectId: string | null
  projects: Project[]
  onSelectProject: (id: string) => void
  onCreateNew: () => void
  onDeleteProject: (id: string) => void
  onUpdateTitle: (id: string, newTitle: string) => void
}

export function ProjectsList({
  currentProjectId,
  projects,
  onSelectProject,
  onCreateNew,
  onDeleteProject,
  onUpdateTitle,
}: Props) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')

  const startEdit = (project: Project) => {
    setEditingId(project.id)
    setEditValue(project.title)
  }

  const saveEdit = () => {
    if (!editingId || !editValue.trim()) return
    onUpdateTitle(editingId, editValue.trim())
    setEditingId(null)
  }

  const cancelEdit = () => {
    setEditingId(null)
    setEditValue('')
  }

  return (
    <div className="w-64 border-r border-gray-200 bg-gray-50 flex flex-col">
      {/* Header */}
      <div className="p-4 border-b border-gray-200 flex items-center justify-between">
        <h2 className="font-semibold text-gray-900">Projects</h2>
        <button
          onClick={onCreateNew}
          className="p-1.5 hover:bg-gray-200 rounded-lg transition-colors"
          aria-label="New project"
        >
          <Plus size={18} />
        </button>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto">
        {projects.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <Folder size={40} className="mx-auto mb-3 text-gray-300" />
            <p className="text-sm">No projects yet</p>
            <button
              onClick={onCreateNew}
              className="mt-3 text-blue-600 hover:text-blue-700 text-sm font-medium"
            >
              Create your first project
            </button>
          </div>
        ) : (
          <ul>
            {projects.map((project) => (
              <li key={project.id}>
                <div
                  className={`group flex items-center gap-2 px-3 py-2.5 hover:bg-gray-100 transition-colors ${
                    currentProjectId === project.id ? 'bg-blue-50' : ''
                  }`}
                >
                  {/* Folder icon */}
                  <Folder
                    size={18}
                    className={`${
                      currentProjectId === project.id
                        ? 'text-blue-600'
                        : 'text-gray-500'
                    }`}
                  />

                  {/* Editable title */}
                  {editingId === project.id ? (
                    <input
                      type="text"
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') saveEdit()
                        if (e.key === 'Escape') cancelEdit()
                      }}
                      onBlur={saveEdit}
                      autoFocus
                      className="flex-1 px-2 py-1 text-sm font-medium bg-white border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  ) : (
                    <button
                      onClick={() => onSelectProject(project.id)}
                      className="flex-1 text-left text-sm font-medium text-gray-900 truncate"
                    >
                      {project.title}
                    </button>
                  )}

                  {/* Actions (visible on hover or when active) */}
                  <div className="opacity-0 group-hover:opacity-100 flex items-center gap-1 transition-opacity">
                    {editingId === project.id ? (
                      <>
                        <button
                          onClick={saveEdit}
                          className="p-1 hover:bg-gray-200 rounded"
                          aria-label="Save"
                        >
                          <Check size={16} className="text-green-600" />
                        </button>
                        <button
                          onClick={cancelEdit}
                          className="p-1 hover:bg-gray-200 rounded"
                          aria-label="Cancel"
                        >
                          <X size={16} className="text-gray-500" />
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          onClick={() => startEdit(project)}
                          className="p-1 hover:bg-gray-200 rounded"
                          aria-label="Rename project"
                        >
                          <Edit2 size={15} />
                        </button>
                        {projects.length > 1 && (
                          <button
                            onClick={() => onDeleteProject(project.id)}
                            className="p-1 hover:bg-red-100 rounded text-red-600"
                            aria-label="Delete project"
                          >
                            <Trash2 size={15} />
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}