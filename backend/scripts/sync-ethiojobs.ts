import { prisma } from '../src/lib/prisma';
import { sourcesService } from '../src/modules/sources/sources.service';
import { classificationService } from '../src/modules/classification/classification.service';

async function main() {
  const source = await prisma.jobSource.findUnique({ where: { slug: 'ethiojobs' } });
  if (!source) {
    console.error('Ethiojobs source record not found in database. Run `npm run seed` first.');
    process.exit(1);
  }

  console.log(`Triggering Ethiojobs collection run for '${source.name}'...`);
  console.log(`Endpoint: ${source.endpointUrl}`);

  const run = await sourcesService.runCollection(source.id);
  console.log(`\nCollection run ${run.id} finished: ${run.status}`);
  console.log(`- Records Fetched: ${run.recordsFetched}`);
  console.log(`- Jobs Created:    ${run.jobsCreated}`);
  console.log(`- Jobs Updated:    ${run.jobsUpdated}`);
  console.log(`- Jobs Skipped:    ${run.jobsSkipped}`);

  if (run.errorSummary) {
    console.log(`- Error Summary:   ${run.errorSummary}`);
  }

  if (run.status === 'SUCCESS' && run.jobsCreated > 0) {
    console.log(`\nProcessing pending AI classifications...`);
    const classified = await classificationService.processPendingJobs(run.jobsCreated);
    console.log(`- Classified: ${classified.succeeded} succeeded, ${classified.failed} failed.`);
  }

  await prisma.$disconnect();
}

main().catch((err) => {
  console.error('Ethiojobs sync failed:', err);
  process.exit(1);
});

