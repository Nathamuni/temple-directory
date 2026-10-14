import pg from 'pg';

// Single shared pool. DATABASE_URL works with any Postgres (Render, Neon, Supabase, Docker, a VPS).
export const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL || 'postgres://postgres:temple@localhost:5440/temple_directory',
  max: Number(process.env.PG_POOL_MAX || 10),
  ssl: process.env.PGSSL === '1' ? { rejectUnauthorized: false } : undefined,
});
export const q = (text, params) => pool.query(text, params);
