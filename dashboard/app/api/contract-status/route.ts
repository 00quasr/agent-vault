import { NextResponse } from 'next/server';
import { isContractAvailable } from '@/lib/midnight-contract';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  try {
    const available = await isContractAvailable();

    return NextResponse.json({
      contractAvailable: available,
      mode: available ? 'real' : 'simulated',
      proofServer: process.env.MIDNIGHT_PROOF_SERVER || 'not configured'
    });
  } catch (error) {
    console.error('Error checking contract status:', error);
    return NextResponse.json({
      contractAvailable: false,
      mode: 'simulated',
      error: 'Failed to check contract status'
    });
  }
}
