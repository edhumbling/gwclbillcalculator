import { NextResponse } from 'next/server';
import { stackServerApp } from '@/lib/auth';
import { pool, initDatabase } from '@/lib/db';

// Initialize database on first request
let dbInitialized = false;
async function ensureDbInitialized() {
  if (!dbInitialized) {
    await initDatabase();
    dbInitialized = true;
  }
}

// GET - Fetch user's reading history
export async function GET(request) {
  try {
    await ensureDbInitialized();
    
    const user = await stackServerApp.getUser();
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    // Get or create user in database
    let dbUser = await pool.query(
      'SELECT id FROM users WHERE stack_user_id = $1',
      [user.id]
    );

    if (dbUser.rows.length === 0) {
      const result = await pool.query(
        `INSERT INTO users (stack_user_id, email, name) 
         VALUES ($1, $2, $3) 
         RETURNING id`,
        [user.id, user.primaryEmail, user.displayName || user.primaryEmail]
      );
      dbUser = result;
    }

    const userId = dbUser.rows[0].id;

    // Fetch readings
    const result = await pool.query(
      `SELECT * FROM readings 
       WHERE user_id = $1 
       ORDER BY calculation_date DESC 
       LIMIT $2 OFFSET $3`,
      [userId, limit, offset]
    );

    // Get total count
    const countResult = await pool.query(
      'SELECT COUNT(*) FROM readings WHERE user_id = $1',
      [userId]
    );

    return NextResponse.json({
      readings: result.rows,
      total: parseInt(countResult.rows[0].count),
      limit,
      offset,
    });
  } catch (error) {
    console.error('Error fetching readings:', error);
    return NextResponse.json(
      { error: 'Failed to fetch readings', details: error.message },
      { status: 500 }
    );
  }
}

// POST - Save a new reading
export async function POST(request) {
  try {
    await ensureDbInitialized();
    
    const user = await stackServerApp.getUser();
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const body = await request.json();
    const {
      previousReading,
      currentReading,
      consumption,
      waterAmount,
      fireLevy,
      ruralLevy,
      serviceCharge,
      totalAmount,
    } = body;

    // Validate required fields
    if (
      previousReading === undefined ||
      currentReading === undefined ||
      consumption === undefined ||
      waterAmount === undefined ||
      fireLevy === undefined ||
      ruralLevy === undefined ||
      serviceCharge === undefined ||
      totalAmount === undefined
    ) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Get or create user in database
    let dbUser = await pool.query(
      'SELECT id FROM users WHERE stack_user_id = $1',
      [user.id]
    );

    if (dbUser.rows.length === 0) {
      const result = await pool.query(
        `INSERT INTO users (stack_user_id, email, name) 
         VALUES ($1, $2, $3) 
         RETURNING id`,
        [user.id, user.primaryEmail, user.displayName || user.primaryEmail]
      );
      dbUser = result;
    }

    const userId = dbUser.rows[0].id;

    // Insert reading
    const result = await pool.query(
      `INSERT INTO readings (
        user_id, previous_reading, current_reading, consumption,
        water_amount, fire_levy, rural_levy, service_charge, total_amount
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *`,
      [
        userId,
        previousReading,
        currentReading,
        consumption,
        waterAmount,
        fireLevy,
        ruralLevy,
        serviceCharge,
        totalAmount,
      ]
    );

    return NextResponse.json({
      success: true,
      reading: result.rows[0],
    });
  } catch (error) {
    console.error('Error saving reading:', error);
    return NextResponse.json(
      { error: 'Failed to save reading', details: error.message },
      { status: 500 }
    );
  }
}

