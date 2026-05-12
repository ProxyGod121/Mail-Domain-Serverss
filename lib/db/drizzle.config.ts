import { defineConfig } from "drizzle-kit";
import path from "path";

const rawUrl = process.env.POSTGRES_URL || process.env.DATABASE_URL;

if (!rawUrl) {
  throw new Error("POSTGRES_URL or DATABASE_URL must be set");
}

const connectionString = rawUrl.includes("sslmode=") ? rawUrl : `${rawUrl}?sslmode=require`;

export default defineConfig({
  schema: path.join(__dirname, "./src/schema/index.ts"),
  dialect: "postgresql",
  dbCredentials: {
    url: connectionString,
  },
});
