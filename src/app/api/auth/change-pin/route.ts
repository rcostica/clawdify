import { NextRequest, NextResponse } from 'next/server';
import { logAudit } from '@/lib/audit';
import fs from 'fs';
import path from 'path';

export async function POST(request: NextRequest) {
  try {
    const { currentPin, newPin } = await request.json();
    const configuredPin = process.env.CLAWDIFY_PIN;

    // Verify current PIN if one is set
    if (configuredPin && currentPin !== configuredPin) {
      return NextResponse.json({ error: 'Current PIN is incorrect' }, { status: 401 });
    }

    if (!newPin || typeof newPin !== 'string' || newPin.length < 4) {
      return NextResponse.json({ error: 'New PIN must be at least 4 characters' }, { status: 400 });
    }

    // Update .env.local
    const envPath = path.join(process.cwd(), '.env.local');
    let envContent = '';
    try {
      envContent = fs.readFileSync(envPath, 'utf-8');
    } catch {}

    if (envContent.includes('CLAWDIFY_PIN=')) {
      envContent = envContent.replace(/CLAWDIFY_PIN=.*/, `CLAWDIFY_PIN=${newPin}`);
    } else {
      envContent += `\nCLAWDIFY_PIN=${newPin}`;
    }

    fs.writeFileSync(envPath, envContent, 'utf-8');

    // Update process.env for current runtime
    process.env.CLAWDIFY_PIN = newPin;

    logAudit('pin_changed');
    return NextResponse.json({ success: true, message: 'PIN updated. Restart the server for full effect.' });
  } catch (error) {
    console.error('Change PIN error:', error);
    return NextResponse.json({ error: 'Failed to change PIN' }, { status: 500 });
  }
}
