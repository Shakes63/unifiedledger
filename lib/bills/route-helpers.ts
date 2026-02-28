import { NextResponse } from 'next/server';

export class BillsV2HttpError extends Error {
  status: number;
  code: string;
  details?: unknown;

  constructor(message: string, status = 400, code = 'BILLS_V2_BAD_REQUEST', details?: unknown) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export function toBillsV2Error(error: unknown, context: string): NextResponse {
  if (error instanceof BillsV2HttpError) {
    return NextResponse.json(
      {
        error: error.message,
        code: error.code,
        details: error.details,
      },
      { status: error.status }
    );
  }

  if (error instanceof Error && error.message === 'Unauthorized') {
    return NextResponse.json({ error: 'Unauthorized', code: 'UNAUTHORIZED' }, { status: 401 });
  }

  if (error instanceof Error && error.message.includes('Household')) {
    return NextResponse.json({ error: error.message, code: 'INVALID_HOUSEHOLD' }, { status: 400 });
  }

  if (error instanceof Error && error.message.toLowerCase().includes('not found')) {
    return NextResponse.json(
      { error: error.message, code: 'BILLS_V2_NOT_FOUND' },
      { status: 404 }
    );
  }

  if (
    error instanceof Error &&
    [
      'required',
      'invalid',
      'must',
      'cannot',
      'already',
      'failed to create',
      'allocation',
      'not enabled',
      'unauthorized',
    ].some((token) => error.message.toLowerCase().includes(token))
  ) {
    return NextResponse.json(
      { error: error.message, code: 'BILLS_V2_BAD_REQUEST' },
      { status: 400 }
    );
  }

  console.error(`[Bills V2] ${context}:`, error);
  return NextResponse.json(
    { error: 'Internal server error', code: 'BILLS_V2_INTERNAL_ERROR' },
    { status: 500 }
  );
}
