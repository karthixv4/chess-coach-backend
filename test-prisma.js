const { PrismaClient } = require('@prisma/client');
try {
  const prisma = new PrismaClient();
  console.log("Prisma instantiated perfectly");
} catch (e) {
  console.error("Error instantiating Prisma:");
  console.error(e);
}
