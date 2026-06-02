"use client";

import { useParams } from "next/navigation";
import Studio from "@/components/Studio";

export default function StudioPage() {
  const params = useParams<{ projectId: string }>();
  const id = typeof params.projectId === "string" ? params.projectId : "";
  return <Studio projectId={id} />;
}
