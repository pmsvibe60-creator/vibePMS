import { z } from 'zod';

const blank = (v: unknown) => (typeof v === 'string' && v.trim() === '' ? undefined : v);
const opt = () => z.preprocess(blank, z.string().optional());

const schema = z.object({
  PORT: z.coerce.number().default(4000),
  PUBLIC_URL: z.string().url().default('http://localhost:4000'),
  DATABASE_URL: z.string().default('postgres://postgres:postgres@localhost:5432/pms'),
  FILES_DIR: z.string().default('./.data/files'),
  ADMIN_TOKEN: opt(),
  TZ: z.string().default('Europe/Tallinn'),

  TWENTY_URL: z.string().default('http://localhost:3020'),
  TWENTY_PUBLIC_URL: z.preprocess(blank, z.string().optional()),
  SERVER_URL: opt(),
  TWENTY_API_KEY: opt(),
  TWENTY_WEBHOOK_SECRET: opt(),
  AUTO_SETUP: z.enum(['true', 'false']).default('false').transform(v => v === 'true'),

  CASAPAY_API_BASE_URL: z.string().default('https://manage.test.casapay.com/api/v1/gateway'),
  CASAPAY_API_KEY: opt(),
  CASAPAY_WEBHOOK_SECRET: opt(),
  CASAPAY_AGREEMENT_TYPE: z.enum(['payment_link', 'ontime', 'cover']).default('ontime'),
  CASAPAY_DEPOSIT_MODE: z.enum(['deposit_upfront', 'deposit_guaranteed', 'choice']).default('choice'),

  OWNER_NAME: z.preprocess(blank, z.string().default('My Company OÜ')),
  OWNER_REG_CODE: z.preprocess(blank, z.string().default('')),
  OWNER_VAT_NO: z.preprocess(blank, z.string().default('')),
  OWNER_ADDRESS: z.preprocess(blank, z.string().default('')),
  OWNER_EMAIL: z.preprocess(blank, z.string().default('')),
  OWNER_PHONE: z.preprocess(blank, z.string().default('')),
  OWNER_REPRESENTATIVE: z.preprocess(blank, z.string().default('')),
  INVOICE_PREFIX: z.preprocess(blank, z.string().default('RENT')),
  RENT_DUE_DAY_DEFAULT: z.coerce.number().int().min(1).max(28).default(5),
  RENT_INVOICE_DAY: z.coerce.number().int().min(1).max(28).default(1),

  SMTP_HOST: opt(),
  SMTP_PORT: z.coerce.number().default(465),
  SMTP_USER: opt(),
  SMTP_PASSWORD: opt(),
  SMTP_FROM_ADDRESS: opt(),
  SMTP_FROM_NAME: opt(),
});

export const config = schema.parse(process.env);
export type Config = typeof config;

/** Public URL of the Twenty UI, used for deep links in emails. */
export const twentyPublicUrl = config.TWENTY_PUBLIC_URL ?? config.SERVER_URL ?? config.TWENTY_URL;

export function requireSetting<K extends keyof Config>(key: K): NonNullable<Config[K]> {
  const value = config[key];
  if (value === undefined || value === null || value === '') {
    throw new Error(`Missing required setting ${String(key)} — set it in .env`);
  }
  return value as NonNullable<Config[K]>;
}
