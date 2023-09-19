import type {PrismaClient} from '@prisma/client';

export const seedUsers = async (prisma: PrismaClient): Promise<void> => {
  await prisma.user.createMany({
    data: [{email: 'test1@test.com'}, {email: 'test2@test.com'}],
  });
};
