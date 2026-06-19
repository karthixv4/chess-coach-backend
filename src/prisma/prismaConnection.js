const { PrismaClient } = require("@prisma/client");
const { PrismaPg } = require("@prisma/adapter-pg");
const { Pool } = require("pg");

const connectionString = process.env.DATABASE_URL;

const pool = new Pool({
  connectionString,
  max: 10, // Limit pool size
  idleTimeoutMillis: 30000,
  // Removed connectionTimeoutMillis to prevent timeouts when Neon DB wakes up from cold start
});
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({
  adapter,
  log: ['info', 'warn', 'error'], // Add logging
});

async function connectDB() {
  try {
    await prisma.$connect();
    console.log("✅ Database connected successfully");
  } catch (error) {
    console.error("❌ Database connection error:", error);
    process.exit(1);
  }
}

connectDB();

module.exports = prisma;
