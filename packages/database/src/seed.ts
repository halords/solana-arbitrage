import { PrismaClient } from '@prisma/client';

const INITIAL_DEXES = [
  {
    name: 'Raydium',
    adapterName: 'raydium',
    enabled: true,
  },
  {
    name: 'Orca',
    adapterName: 'orca',
    enabled: true,
  },
];

const INITIAL_TOKENS = [
  {
    mintAddress: 'So11111111111111111111111111111111111111112',
    symbol: 'SOL',
    name: 'Wrapped SOL',
    decimals: 9,
    enabled: true,
    whitelisted: true,
  },
  {
    mintAddress: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
    symbol: 'USDC',
    name: 'USD Coin',
    decimals: 6,
    enabled: true,
    whitelisted: true,
  },
  {
    mintAddress: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB',
    symbol: 'USDT',
    name: 'Tether USD',
    decimals: 6,
    enabled: true,
    whitelisted: true,
  },
];

export async function seedDatabase(prisma: PrismaClient): Promise<void> {
  // eslint-disable-next-line no-console
  console.log('🌱 Seeding initial DEXs...');
  for (const dex of INITIAL_DEXES) {
    const existing = await prisma.dex.findFirst({
      where: { adapterName: dex.adapterName },
    });
    if (!existing) {
      await prisma.dex.create({
        data: dex,
      });
    } else {
      await prisma.dex.update({
        where: { id: existing.id },
        data: { enabled: true },
      });
    }
  }

  // eslint-disable-next-line no-console
  console.log('🌱 Seeding whitelisted tokens...');
  for (const token of INITIAL_TOKENS) {
    await prisma.token.upsert({
      where: { mintAddress: token.mintAddress },
      update: {
        symbol: token.symbol,
        name: token.name,
        decimals: token.decimals,
        whitelisted: token.whitelisted,
        enabled: token.enabled,
      },
      create: token,
    });
  }

  // eslint-disable-next-line no-console
  console.log('✅ Database seeding completed successfully.');
}

const prisma = new PrismaClient();
if (process.env.NODE_ENV !== 'test' && !process.env.VITEST) {
  seedDatabase(prisma)
    .catch((e: unknown) => {
      console.error('❌ Error during database seeding:', e);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });
}
