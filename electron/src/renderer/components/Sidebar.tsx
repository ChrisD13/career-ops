import { Table, FileText, Inbox, ChevronLeft, ChevronRight } from 'lucide-react'
import { NavItem } from './NavItem'

export type PanelId = 'tracker' | 'reports' | 'pipeline'

interface Props {
  activePanel: PanelId
  onSelect: (panel: PanelId) => void
  collapsed: boolean
  onToggleCollapse: () => void
}

export function Sidebar({ activePanel, onSelect, collapsed, onToggleCollapse }: Props) {
  const width = collapsed ? 48 : 200
  return (
    <aside
      style={{ width }}
      className="flex flex-col bg-ctp-surface border-r border-ctp-overlay shrink-0 transition-[width] duration-150"
    >
      <div className="flex items-center h-12 px-3 border-b border-ctp-overlay">
        {!collapsed && <span className="text-heading text-ctp-text">JobEngine</span>}
      </div>
      <nav className="flex flex-col py-2">
        <NavItem
          icon={Table}
          label="Tracker"
          active={activePanel === 'tracker'}
          collapsed={collapsed}
          onClick={() => onSelect('tracker')}
        />
        <NavItem
          icon={FileText}
          label="Reports"
          active={activePanel === 'reports'}
          collapsed={collapsed}
          onClick={() => onSelect('reports')}
        />
        <NavItem
          icon={Inbox}
          label="Pipeline"
          active={activePanel === 'pipeline'}
          collapsed={collapsed}
          onClick={() => onSelect('pipeline')}
        />
      </nav>
      <div className="mt-auto p-2">
        <button
          type="button"
          onClick={onToggleCollapse}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          className="flex items-center justify-center h-8 w-full rounded text-ctp-subtext hover:text-ctp-text hover:bg-ctp-overlay focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ctp-blue"
        >
          {collapsed ? <ChevronRight size={14} aria-hidden="true" /> : <ChevronLeft size={14} aria-hidden="true" />}
        </button>
      </div>
    </aside>
  )
}
