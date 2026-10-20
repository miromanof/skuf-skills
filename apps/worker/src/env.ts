export type WorkerBindings = {
  DB: D1Database;
  ADMIN_LOGIN_EMAIL: string;
  ADMIN_PASSWORD: string;
  ADMIN_LOGIN?: string;
  ADMIN_PASSWORD_SALT: string;
  ADMIN_PASSWORD_DERIVED_KEY: string;
  CURSOR_SECRET: string;
  ALLOWED_ORIGINS: string;
};

