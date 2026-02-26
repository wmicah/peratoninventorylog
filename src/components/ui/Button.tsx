"use client"

import { forwardRef, type ButtonHTMLAttributes } from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "@/lib/utils"

const buttonVariants = cva(
	"inline-flex items-center justify-center gap-2 rounded-lg font-bold text-sm uppercase tracking-widest transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 active:scale-[0.98] min-h-[44px] min-w-[44px] px-5 py-3 touch-manipulation",
	{
		variants: {
			variant: {
				primary:
					"bg-[var(--color-primary-900)] text-white shadow-sm hover:bg-[var(--color-primary-950)] focus:ring-[var(--color-primary-900)]",
				secondary:
					"bg-white text-slate-700 border-2 border-slate-200 shadow-sm hover:bg-slate-50 hover:border-slate-300 focus:ring-slate-300",
				ghost:
					"bg-transparent text-slate-600 hover:bg-slate-100 hover:text-slate-900 focus:ring-slate-200",
				danger:
					"bg-red-600 text-white shadow-sm hover:bg-red-700 focus:ring-red-500",
				success:
					"bg-teal-600 text-white shadow-sm hover:bg-teal-700 focus:ring-teal-500",
				muted:
					"bg-slate-200 text-slate-600 hover:bg-slate-300 focus:ring-slate-300 cursor-not-allowed",
			},
			size: {
				sm: "min-h-[36px] px-3 py-2 text-xs",
				md: "min-h-[44px] px-5 py-3 text-sm",
				lg: "min-h-[48px] px-6 py-3.5 text-base",
				icon: "min-h-[44px] min-w-[44px] p-2.5",
			},
		},
		defaultVariants: {
			variant: "primary",
			size: "md",
		},
	},
)

export interface ButtonProps
	extends
		ButtonHTMLAttributes<HTMLButtonElement>,
		VariantProps<typeof buttonVariants> {}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(
	({ className, variant, size, ...props }, ref) => (
		<button
			ref={ref}
			className={cn(buttonVariants({ variant, size, className }))}
			{...props}
		/>
	),
)
Button.displayName = "Button"

export { Button, buttonVariants }
