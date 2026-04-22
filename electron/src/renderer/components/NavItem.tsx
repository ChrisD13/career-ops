import type { LucideIcon } from 'lucide-react'

interface Props {
  icon: LucideIcon
  label: string
  active: boolean
  collapsed: boolean
  onClick: () => void
}

export function NavItem({ icon: Icon, label, active, collapsed, onClick }: Props) {
  const activeClasses = active
    ? 'border-l-[3px] border-ctp-blue text-ctp-blue font-semibold'
    : 'border-l-[3px] border-transparent text-ctp-subtext hover:text-ctp-text'
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      aria-current={active ? 'page' : undefined}
      title={collapsed ? label : undefined}
      className={`flex items-center gap-3 h-10 w-full px-3 text-left text-body ${activeClasses} focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ctp-blue focus-visible:ring-inset`}
    >
      <Icon size={18} aria-hidden="true" className="shrink-0" />
      {!collapsed && <span>{label}</span>}
    </button>
  )
}
