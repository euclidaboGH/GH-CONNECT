import type { Metadata } from "next"
import { ResearchStudioClient } from "@/components/field/research-studio-client"
export const metadata: Metadata = { title: "Research Studio · GreenHaven", description: "Create, publish and manage surveys, examinations and field research." }
export default function ResearchStudioPage() { return <ResearchStudioClient /> }
