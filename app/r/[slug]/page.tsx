import type { Metadata } from "next"
import { PublicResearchForm } from "@/components/field/public-research-form"
export const dynamic = "force-dynamic"
export const metadata: Metadata = { title: "Public Research Form · GreenHaven", robots: { index: false, follow: false } }
export default async function PublicResearchPage({ params }: { params: Promise<{ slug: string }> }) { const { slug } = await params; return <PublicResearchForm slug={slug} /> }
