import { defineConfig } from 'prisma/config'
import * as dotenv from 'dotenv'

dotenv.config()

export default defineConfig({
  datasource: {
    url: process.env.DATABASE_URL,
    directUrl: process.env.DB_DIRECT_URL ?? process.env.DIRECT_URL,
  },
})
