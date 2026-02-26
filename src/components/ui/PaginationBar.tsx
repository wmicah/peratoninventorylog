"use client"

import { ChevronLeft, ChevronRight } from "lucide-react"

export const BADGE_LIST_PAGE_SIZE = 50

interface PaginationBarProps {
	total: number
	pageSize: number
	currentPage: number
	onPageChange: (page: number) => void
	/** Optional label, e.g. "badges" */
	itemLabel?: string
}

export function PaginationBar({
	total,
	pageSize,
	currentPage,
	onPageChange,
	itemLabel = "items",
}: PaginationBarProps) {
	if (total <= pageSize) return null

	const totalPages = Math.ceil(total / pageSize)
	const start = (currentPage - 1) * pageSize + 1
	const end = Math.min(currentPage * pageSize, total)

	return (
		<div className="flex items-center justify-between gap-4 px-4 py-3 border-t border-slate-100 bg-slate-50/50 text-sm">
			<span className="text-slate-500 font-medium">
				Showing {start}–{end} of {total} {itemLabel}
			</span>
			<div className="flex items-center gap-1">
				<button
					type="button"
					onClick={() => onPageChange(currentPage - 1)}
					disabled={currentPage <= 1}
					className="p-2 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-50 disabled:pointer-events-none transition-colors"
					aria-label="Previous page"
				>
					<ChevronLeft className="w-4 h-4" />
				</button>
				<span className="px-3 py-1.5 font-medium text-slate-700 min-w-[6rem] text-center">
					Page {currentPage} of {totalPages}
				</span>
				<button
					type="button"
					onClick={() => onPageChange(currentPage + 1)}
					disabled={currentPage >= totalPages}
					className="p-2 rounded-lg border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:opacity-50 disabled:pointer-events-none transition-colors"
					aria-label="Next page"
				>
					<ChevronRight className="w-4 h-4" />
				</button>
			</div>
		</div>
	)
}
