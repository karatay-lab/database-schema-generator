import { readProjects } from "@/lib/projects-store";
import { redirect } from "next/navigation";
import CreateFirstProject from "./_components/create-first-project";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const projects = await readProjects();

  if (projects.length > 0) {
    redirect("/tables");
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-50 p-4">
      <CreateFirstProject />
    </div>
  );
}
