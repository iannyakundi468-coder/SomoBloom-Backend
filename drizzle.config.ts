import { defineConfig } from 'drizzle-kit';

export default defineConfig({
  schema: './src/db/schema.ts',
  out: './drizzle',
  dialect: 'sqlite',
  driver: 'd1-http' // Only needed for remote connection via config, not local D1 dev usually, but needed for drizzle-kit
});
