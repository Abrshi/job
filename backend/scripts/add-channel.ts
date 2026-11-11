import { prisma } from '../src/lib/prisma';

async function main() {
  const targetChannels = [
    { username: 'ethiojobsofficial', title: 'Ethiojobs Official' },
    { username: 'geezjobs_ethiopia', title: 'GeezJobs Ethiopia' },
    { username: 'hahujobs', title: 'HaHuJobs' },
    { username: 'afriwork', title: 'Afriwork (Freelance & Jobs)' },
    { username: 'tikvahethiopiajobs', title: 'Tikvah Jobs Ethiopia' },
    { username: 'shegajobs', title: 'Shega Jobs' },
    { username: 'addisjobs', title: 'Addis Jobs Vacancy' },
  ];

  for (const target of targetChannels) {
    const { username, title } = target;
    const telegramChannelId = `user_${username}`;

    const existing = await prisma.telegramChannel.findFirst({
      where: {
        OR: [
          { username },
          { telegramChannelId },
        ],
      },
    });

    if (existing) {
      console.log(`Channel already exists in database: ${existing.title} (@${existing.username}, ID: ${existing.id})`);
      continue;
    }

    const created = await prisma.telegramChannel.create({
      data: {
        telegramChannelId,
        username,
        title,
        isActive: true,
        isAuthorized: true,
        authorizationRecord: 'Added by admin request',
      },
    });

    console.log(`Successfully added channel to database: ${created.title} (@${created.username}, ID: ${created.id})`);
  }
}

main()
  .catch((err) => {
    console.error('Error adding channel:', err.message);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
