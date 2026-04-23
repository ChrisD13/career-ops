import { Table, FileText, Inbox, Zap, User, ChevronLeft, ChevronRight } from 'lucide-react'
import { NavItem } from './NavItem'
import { GearIcon } from './GearIcon'

export type PanelId = 'tracker' | 'pipeline' | 'reports' | 'evaluate' | 'cv'

interface Props {
  activePanel: PanelId
  onSelect: (panel: PanelId) => void
  collapsed: boolean
  onToggleCollapse: () => void
  onOpenSettings: () => void
}

const ITEMS: Array<{ id: PanelId; label: string; icon: typeof Table }> = [
  { id: 'tracker', label: 'Tracker', icon: Table },
  { id: 'pipeline', label: 'Pipeline', icon: Inbox },
  { id: 'reports', label: 'Reports', icon: FileText },
  { id: 'evaluate', label: 'Evaluate', icon: Zap },
  { id: 'cv', label: 'CV', icon: User },
]

export function Sidebar({ activePanel, onSelect, collapsed, onToggleCollapse, onOpenSettings }: Props) {
  const width = collapsed ? 48 : 200
  return (
    <aside
      style={{ width }}
      className="flex flex-col bg-ctp-surface border-r border-ctp-overlay shrink-0 transition-[width] duration-150"
    >
      <div className="flex items-center h-12 px-3 border-b border-ctp-overlay">
        {!collapsed && <span className="text-heading text-ctp-text">JobEngine</span>}
      </div>
      <nav className="flex flex-col py-2 flex-1">
        {ITEMS.map((item) => (
          <NavItem
            key={item.id}
            icon={item.icon}
            label={item.label}
            active={activePanel === item.id}
            collapsed={collapsed}
            onClick={() => onSelect(item.id)}
          />
        ))}
      </nav>
      <div className="border-t border-ctp-overlay">
        <div className="flex items-center justify-between p-2">
          <button
            type="button"
            onClick={onOpenSettings}
            aria-label="Open settings"
            title="Settings"
            data-testid="sidebar-gear"
            className="flex items-center justify-center h-8 w-8 rounded text-ctp-subtext hover:text-ctp-text hover:bg-ctp-overlay focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ctp-blue"
          >
            <GearIcon size={18} />
          </button>
          {!collapsed && (
            <button
              type="button"
              onClick={onToggleCollapse}
              aria-label="Collapse sidebar"
              className="flex items-center justify-center h-8 w-8 rounded text-ctp-subtext hover:text-ctp-text hover:bg-ctp-overlay focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ctp-blue"
            >
              <ChevronLeft size={14} aria-hidden="true" />
            </button>
          )}
          {collapsed && (
            <button
              type="button"
              onClick={onToggleCollapse}
              aria-label="Expand sidebar"
              className="flex items-center justify-center h-8 w-8 rounded text-ctp-subtext hover:text-ctp-text hover:bg-ctp-overlay focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ctp-blue"
            >
              <ChevronRight size={14} aria-hidden="true" />
            </button>
          )}
        </div>
      </div>
    </aside>
  )
}
