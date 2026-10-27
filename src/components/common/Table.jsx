import { cn } from '../../utils/cn.js'
import EmptyState from './EmptyState.jsx'

function Table({ headers = [], rows = [], className = '', minWidthClass = 'min-w-[520px]', emptyTitle = 'No records to display.' }) {
  return (
    <div className={cn('max-w-full min-w-0 overflow-x-auto rounded-xl border border-line bg-surface', className)}>
      <table className={cn('po-table po-table-text w-full border-collapse text-left', minWidthClass)}>
        <thead className="bg-page">
          <tr>
            {headers.map((header) => (
              <th
                key={header}
                className="border-b border-line px-4 py-3 text-xs font-semibold tracking-wide text-muted uppercase"
              >
                {header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.length === 0 ? (
            <tr>
              <td className="px-2" colSpan={headers.length}>
                <EmptyState title={emptyTitle} />
              </td>
            </tr>
          ) : (
            rows.map((row, rowIndex) => (
              <tr key={rowIndex} className="border-b border-line last:border-b-0">
                {row.map((cell, cellIndex) => (
                  <td key={cellIndex} className="px-4 py-3 align-middle">
                    {cell}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  )
}

export default Table
