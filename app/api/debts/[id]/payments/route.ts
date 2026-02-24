import {
  GET as getUnifiedDebtPayments,
  POST as postUnifiedDebtPayments,
} from '@/app/api/debts/payments/route';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const sourceUrl = new URL(request.url);
  sourceUrl.pathname = '/api/debts/payments';
  sourceUrl.search = `source=debt&id=${encodeURIComponent(id)}`;
  const proxyRequest = new Request(sourceUrl.toString(), {
    method: 'GET',
    headers: request.headers,
  });
  return getUnifiedDebtPayments(proxyRequest);
}

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await request.json();
  const proxyBody = { ...body, source: 'debt', id };
  const headers = new Headers(request.headers);
  headers.set('content-type', 'application/json');
  const sourceUrl = new URL(request.url);
  sourceUrl.pathname = '/api/debts/payments';
  sourceUrl.search = '';
  const proxyRequest = new Request(sourceUrl.toString(), {
    method: 'POST',
    headers,
    body: JSON.stringify(proxyBody),
  });
  return postUnifiedDebtPayments(proxyRequest);
}
