import { prisma } from "../../lib/prisma";
import { createProject } from "../../workflows/projects/workflow";
import { allMockProjects } from "./index";

async function main() {
  console.log("Seeding mock projects...\n");

  const results = await Promise.all(
    allMockProjects.map((mock) => createProject(mock)),
  );

  for (const project of results) {
    console.log(`✓ ${project.name}`);
    console.log(`  id:       ${project.id}`);
    console.log(`  provider: ${project.provider}`);
    console.log(`  version:  ${project.versions[0]?.name}`);
    console.log(`  graphql:  ${project.schemaOptions.graphql}`);
    console.log();
  }

  console.log(`Done — ${results.length} projects created.`);
}

main()
  .catch((err) => {
    console.error("Error:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
