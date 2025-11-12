import { NextResponse } from 'next/server';
import { stackServerApp } from '@/lib/auth';
import { pool } from '@/lib/db';

// Helper to get user from Stack Auth
async function getUser() {
  if (!stackServerApp) {
    return null;
  }
  try {
    return await stackServerApp.getUser();
  } catch (error) {
    console.error('Error getting user:', error);
    return null;
  }
}

// DELETE - Delete a reading
export async function DELETE(request, { params }) {
  try {
    const user = await getUser();
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const { id } = params;

    // Get user's database ID
    const dbUser = await pool.query(
      'SELECT id FROM users WHERE stack_user_id = $1',
      [user.id]
    );

    if (dbUser.rows.length === 0) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    const userId = dbUser.rows[0].id;

    // Verify the reading belongs to the user and delete it
    const result = await pool.query(
      'DELETE FROM readings WHERE id = $1 AND user_id = $2 RETURNING *',
      [id, userId]
    );

    if (result.rows.length === 0) {
      return NextResponse.json(
        { error: 'Reading not found or unauthorized' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Reading deleted successfully',
    });
  } catch (error) {
    console.error('Error deleting reading:', error);
    return NextResponse.json(
      { error: 'Failed to delete reading', details: error.message },
      { status: 500 }
    );
  }
}

