interface HandleRouteErrorOptions {
  defaultError: string;
  logLabel: string;
  householdIdRequiredMessage?: string;
  includeErrorDetails?: boolean;
}

export function apiOk<T>(data: T, status = 200): Response {
  return Response.json(data, { status });
}

export function apiError(error: string, status = 500, details?: string): Response {
  return Response.json(
    details ? { error, details } : { error },
    { status }
  );
}

function mapAuthAndHouseholdError(
  error: unknown,
  householdIdRequiredMessage: string
): Response | null {
  if (!(error instanceof Error)) {
    return null;
  }

  if (error.message === 'Unauthorized') {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (error.message.includes('Household ID is required')) {
    return Response.json(
      { error: householdIdRequiredMessage },
      { status: 400 }
    );
  }

  if (
    error.message.includes('Not a member') ||
    error.message.includes('Unauthorized: Not a member')
  ) {
    return Response.json(
      { error: 'You are not a member of this household.' },
      { status: 403 }
    );
  }

  if (error.message.includes('Household') || error.message.includes('member')) {
    return Response.json({ error: error.message }, { status: 403 });
  }

  return null;
}

export function handleRouteError(
  error: unknown,
  {
    defaultError,
    logLabel,
    householdIdRequiredMessage = 'Household ID is required',
    includeErrorDetails = false,
  }: HandleRouteErrorOptions
): Response {
  const mapped = mapAuthAndHouseholdError(error, householdIdRequiredMessage);
  if (mapped) {
    return mapped;
  }

  console.error(logLabel, error);
  return Response.json(
    includeErrorDetails
      ? { error: defaultError, details: error instanceof Error ? error.message : 'Unknown error' }
      : { error: defaultError },
    { status: 500 }
  );
}

const apiDebugLoggingEnabled =
  process.env.UNIFIEDLEDGER_API_DEBUG === 'true' ||
  process.env.NODE_ENV !== 'production';

export function apiDebugLog(scope: string, message: string, metadata?: unknown) {
  if (!apiDebugLoggingEnabled) {
    return;
  }

  if (metadata === undefined) {
    console.info(`[${scope}] ${message}`);
    return;
  }

  console.info(`[${scope}] ${message}`, metadata);
}
