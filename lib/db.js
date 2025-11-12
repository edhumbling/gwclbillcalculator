import pg from 'pg';
const { Pool } = pg;

// Create a connection pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('sslmode=require') ? { rejectUnauthorized: false } : false,
});

// Initialize database tables
export async function initDatabase() {
  try {
    // Create users table (if not exists)
    await pool.query(`
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        stack_user_id TEXT UNIQUE NOT NULL,
        email TEXT,
        name TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create readings table
    await pool.query(`
      CREATE TABLE IF NOT EXISTS readings (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        previous_reading DECIMAL(10, 3) NOT NULL,
        current_reading DECIMAL(10, 3) NOT NULL,
        consumption DECIMAL(10, 3) NOT NULL,
        water_amount DECIMAL(10, 2) NOT NULL,
        fire_levy DECIMAL(10, 2) NOT NULL,
        rural_levy DECIMAL(10, 2) NOT NULL,
        service_charge DECIMAL(10, 2) NOT NULL,
        total_amount DECIMAL(10, 2) NOT NULL,
        calculation_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Create indexes for better query performance
    await pool.query(`
      CREATE INDEX IF NOT EXISTS idx_readings_user_id ON readings(user_id);
      CREATE INDEX IF NOT EXISTS idx_readings_calculation_date ON readings(calculation_date DESC);
    `);

    console.log('Database initialized successfully');
  } catch (error) {
    console.error('Error initializing database:', error);
    throw error;
  }
}

export { pool };

