import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

// Mock data - per-user isolation via X-Mock-User header or fallback to 'default'
// Each user gets their own sandbox of mock data

const INITIAL_USERS = [
  { id: 'usr_1', name: 'Alice Johnson', email: 'alice@example.com', created_at: '2024-01-15T10:00:00Z' },
  { id: 'usr_2', name: 'Bob Smith', email: 'bob@example.com', created_at: '2024-01-16T11:30:00Z' },
  { id: 'usr_3', name: 'Carol Williams', email: 'carol@example.com', created_at: '2024-01-17T09:15:00Z' },
];

const INITIAL_ORDERS = [
  { id: 'ord_1', customer_email: 'alice@example.com', amount: 99.99, status: 'completed', created_at: '2024-01-20T14:00:00Z' },
  { id: 'ord_2', customer_email: 'bob@example.com', amount: 149.50, status: 'pending', created_at: '2024-01-21T16:30:00Z' },
  { id: 'ord_3', customer_email: 'alice@example.com', amount: 29.99, status: 'cancelled', created_at: '2024-01-22T08:45:00Z' },
  { id: 'ord_4', customer_email: 'carol@example.com', amount: 199.00, status: 'completed', created_at: '2024-01-23T12:00:00Z' },
  { id: 'ord_5', customer_email: 'bob@example.com', amount: 75.00, status: 'pending', created_at: '2024-01-24T10:20:00Z' },
];

// Per-user state stores: Map<userId, { users: Map, orders: Map }>
const userStores = new Map();

function getStoreForUser(userId) {
  if (!userStores.has(userId)) {
    // Initialize fresh store for this user
    userStores.set(userId, {
      users: new Map(INITIAL_USERS.map(u => [u.id, { ...u }])),
      orders: new Map(INITIAL_ORDERS.map(o => [o.id, { ...o }])),
    });
  }
  return userStores.get(userId);
}

function getUserId(request) {
  // Check X-Mock-User header first (for testing/explicit isolation)
  const mockUser = request.headers.get('x-mock-user');
  if (mockUser) return mockUser;

  // Could also parse auth token here if needed
  // For now, fallback to 'default' for shared access
  return 'default';
}

function generateId(prefix) {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

function parsePath(params) {
  const pathArray = params?.path || [];
  return '/' + pathArray.join('/');
}

// Reset endpoint - resets the current user's store
function handleReset(request) {
  const userId = getUserId(request);
  // Delete the user's store so it gets re-initialized fresh
  userStores.delete(userId);
  const store = getStoreForUser(userId);
  return NextResponse.json({
    reset: true,
    userId,
    users: store.users.size,
    orders: store.orders.size
  });
}

// Route handlers
async function handleUsers(request, pathParts) {
  const method = request.method;
  const targetUserId = pathParts[1];
  const store = getStoreForUser(getUserId(request));
  const { users } = store;

  // GET /users
  if (method === 'GET' && !targetUserId) {
    return NextResponse.json({ users: Array.from(users.values()) });
  }

  // GET /users/:id
  if (method === 'GET' && targetUserId) {
    const user = users.get(targetUserId);
    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }
    return NextResponse.json(user);
  }

  // POST /users
  if (method === 'POST' && !targetUserId) {
    const body = await request.json();
    const newUser = {
      id: generateId('usr'),
      name: body.name || 'Unknown',
      email: body.email || 'unknown@example.com',
      created_at: new Date().toISOString(),
    };
    users.set(newUser.id, newUser);
    return NextResponse.json(newUser, { status: 201 });
  }

  // PUT /users/:id - full update
  if (method === 'PUT' && targetUserId) {
    const existing = users.get(targetUserId);
    if (!existing) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }
    const body = await request.json();
    const updated = {
      id: targetUserId,
      name: body.name ?? existing.name,
      email: body.email ?? existing.email,
      created_at: existing.created_at,
      updated_at: new Date().toISOString(),
    };
    users.set(targetUserId, updated);
    return NextResponse.json(updated);
  }

  // PATCH /users/:id - partial update
  if (method === 'PATCH' && targetUserId) {
    const existing = users.get(targetUserId);
    if (!existing) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }
    const body = await request.json();
    const updated = {
      ...existing,
      ...body,
      id: targetUserId, // prevent id override
      updated_at: new Date().toISOString(),
    };
    users.set(targetUserId, updated);
    return NextResponse.json(updated);
  }

  // DELETE /users/:id
  if (method === 'DELETE' && targetUserId) {
    const existed = users.has(targetUserId);
    users.delete(targetUserId);
    return NextResponse.json({ deleted: existed, id: targetUserId });
  }

  return NextResponse.json({ error: 'Method not allowed' }, { status: 405 });
}

async function handleOrders(request, pathParts) {
  const method = request.method;
  const orderId = pathParts[1];
  const action = pathParts[2];
  const store = getStoreForUser(getUserId(request));
  const { orders } = store;

  // POST /orders/:id/refund
  if (method === 'POST' && orderId && action === 'refund') {
    const order = orders.get(orderId);
    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }
    const body = await request.json();
    // Update order status to refunded
    order.status = 'refunded';
    order.refunded_at = new Date().toISOString();
    orders.set(orderId, order);

    return NextResponse.json({
      refund_id: generateId('ref'),
      order_id: orderId,
      amount: body.amount || order.amount,
      reason: body.reason || 'No reason provided',
      status: 'processed',
      processed_at: new Date().toISOString(),
    });
  }

  // GET /orders
  if (method === 'GET' && !orderId) {
    const url = new URL(request.url);
    const status = url.searchParams.get('status');
    const limit = parseInt(url.searchParams.get('limit') || '10', 10);

    let results = Array.from(orders.values());
    if (status) {
      results = results.filter(o => o.status === status);
    }
    results = results.slice(0, limit);

    return NextResponse.json({ orders: results });
  }

  // GET /orders/:id
  if (method === 'GET' && orderId && !action) {
    const order = orders.get(orderId);
    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }
    return NextResponse.json(order);
  }

  // PATCH /orders/:id - update order status
  if (method === 'PATCH' && orderId && !action) {
    const order = orders.get(orderId);
    if (!order) {
      return NextResponse.json({ error: 'Order not found' }, { status: 404 });
    }
    const body = await request.json();
    const updated = {
      ...order,
      ...body,
      id: orderId,
      updated_at: new Date().toISOString(),
    };
    orders.set(orderId, updated);
    return NextResponse.json(updated);
  }

  return NextResponse.json({ error: 'Method not allowed' }, { status: 405 });
}

async function handleEcho(request) {
  if (request.method !== 'POST') {
    return NextResponse.json({ error: 'Method not allowed' }, { status: 405 });
  }

  let body = {};
  try {
    body = await request.json();
  } catch {
    // Empty body is fine for echo
  }

  return NextResponse.json({
    echo: body,
    timestamp: new Date().toISOString(),
    method: request.method,
  });
}

async function handleProtected(request) {
  if (request.method !== 'GET') {
    return NextResponse.json({ error: 'Method not allowed' }, { status: 405 });
  }

  const authHeader = request.headers.get('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return NextResponse.json(
      { error: 'Unauthorized', message: 'Bearer token required' },
      { status: 401 }
    );
  }

  const token = authHeader.slice(7);
  return NextResponse.json({
    authenticated: true,
    token_preview: token.slice(0, 8) + '...',
    message: 'You have access!',
  });
}

// Main handler
async function handler(request, { params }) {
  const resolvedParams = await params;
  const path = parsePath(resolvedParams);
  const pathParts = path.split('/').filter(Boolean);
  const resource = pathParts[0];

  // Skip the openapi.json route - handled by its own file
  if (path === '/openapi.json') {
    return NextResponse.json({ error: 'Use /api/mock/openapi.json' }, { status: 404 });
  }

  // Root
  if (!resource) {
    return NextResponse.json({
      name: 'ActionChat Mock API',
      version: '1.0.0',
      endpoints: ['/users', '/orders', '/echo', '/protected', '/reset'],
      spec: '/api/mock/openapi.json',
    });
  }

  // Route to handlers
  switch (resource) {
    case 'users':
      return handleUsers(request, pathParts);
    case 'orders':
      return handleOrders(request, pathParts);
    case 'echo':
      return handleEcho(request);
    case 'protected':
      return handleProtected(request);
    case 'reset':
      return handleReset(request);
    default:
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
}

export const GET = handler;
export const POST = handler;
export const PUT = handler;
export const PATCH = handler;
export const DELETE = handler;
