import type { Metadata } from "next"
import { Geist, Geist_Mono } from "next/font/google"
import { AuthHydrate } from "@/components/AuthHydrate"
import { DbHydrate } from "@/components/DbHydrate"
import "./globals.css"

const geistSans = Geist({
	variable: "--font-geist-sans",
	subsets: ["latin"],
})

const geistMono = Geist_Mono({
	variable: "--font-geist-mono",
	subsets: ["latin"],
})

export const metadata: Metadata = {
	title: "Peraton Inventory",
	description: "Badge and inventory reconciliation for facilities",
}

export default function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode
}>) {
	return (
		<html lang="en">
			<body
				className={`${geistSans.variable} ${geistMono.variable} antialiased font-sans bg-slate-50 min-h-screen text-slate-900`}
			>
				<DbHydrate />
				<AuthHydrate />
				{children}
			</body>
		</html>
	)
}
