import { defineConfig } from "drizzle-kit";
import dotenv from "dotenv";

// Load environment variables from .env file
dotenv.config();

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is missing, ensure the database is provisioned");
}

export default defineConfig({
  out: "./migrations",           // The directory to output generated migrations
  schema: "./shared/schema.ts",  // Path to your schema file
  dialect: "postgresql",         // Database dialect (PostgreSQL in this case)
  dbCredentials: {
    url: process.env.DATABASE_URL,  // Using the environment variable for the database URL
    ssl: {
      rejectUnauthorized: false     // Disable SSL certificate validation
    }
  },
});
