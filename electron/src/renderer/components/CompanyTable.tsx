import { useLayoutEffect, useRef, useState, useMemo } from 'react'
import { FixedSizeList } from 'react-window'
import type { VcCompany } from '../../preload/types'
import { CompanyRow, CompanyRowItemData } from './CompanyRow'

const ROW_HEIGHT = 36
const HEADER_HEIGHT = 36

interface Props {
  rows: VcCompany[]
  promotingKeys: Set<string>
  onPromote: (row: VcCompany) => void
}

export function CompanyTable({ rows, promotingKeys, onPromote }: Props) {
  const [listHeight, setListHeight] = useState(400)
  const listContainerRef = useRef<HTMLDivElement | null>(null)

  useLayoutEffect(() => {
    const el = listContainerRef.current
    if (!el) return
    const update = () => setListHeight(Math.max(0, el.clientHeight))
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const itemData = useMemo<CompanyRowItemData>(() => ({
    rows, promotingKeys, onPromote,
  }), [rows, promotingKeys, onPromote])

  return (
    <div className="flex flex-col h-full" role="grid" aria-rowcount={rows.length}>
      <div
        role="row"
        style={{ height: HEADER_HEIGHT }}
        className="flex items-center gap-2 px-3 bg-ctp-surface border-b border-ctp-overlay text-label text-ctp-subtext uppercase tracking-wider shrink-0"
      >
        <div role="columnheader" className="w-[280px]">Company</div>
        <div role="columnheader" className="w-[140px]">Firm</div>
        <div role="columnheader" className="w-[160px]">Funding Signal</div>
        <div role="columnheader" className="w-[140px]">Role Match</div>
        <div role="columnheader" className="flex-1 text-right">Actions</div>
      </div>
      <div ref={listContainerRef} className="flex-1 min-h-0">
        <FixedSizeList
          height={listHeight}
          width="100%"
          itemCount={rows.length}
          itemSize={ROW_HEIGHT}
          itemData={itemData}
          overscanCount={5}
        >
          {CompanyRow}
        </FixedSizeList>
      </div>
    </div>
  )
}
