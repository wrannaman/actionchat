import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

/**
 * GET /api/mock/openapi.json - OpenAPI spec for the mock API
 */
export async function GET(request) {
  const host = request.headers.get('host') || 'localhost:3000';
  const protocol = host.includes('localhost') ? 'http' : 'https';
  const baseUrl = `${protocol}://${host}/api/mock`;

  const spec = {
    openapi: '3.0.3',
    info: {
      title: 'ActionChat Mock API',
      description: 'A mock API for testing ActionChat tool execution. Includes various endpoints to test different HTTP methods, auth types, and response patterns.',
      version: '1.0.0',
    },
    servers: [{ url: baseUrl }],
    paths: {
      '/users': {
        get: {
          operationId: 'listUsers',
          summary: 'List all users',
          description: 'Returns a list of mock users',
          responses: {
            '200': {
              description: 'List of users',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      users: {
                        type: 'array',
                        items: { $ref: '#/components/schemas/User' },
                      },
                    },
                  },
                },
              },
            },
          },
        },
        post: {
          operationId: 'createUser',
          summary: 'Create a new user',
          description: 'Creates a user and returns it with a generated ID',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    name: { type: 'string', description: 'User name' },
                    email: { type: 'string', description: 'User email' },
                  },
                  required: ['name', 'email'],
                },
              },
            },
          },
          responses: {
            '201': {
              description: 'Created user',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/User' },
                },
              },
            },
          },
        },
      },
      '/users/{id}': {
        get: {
          operationId: 'getUser',
          summary: 'Get a user by ID',
          parameters: [
            {
              name: 'id',
              in: 'path',
              required: true,
              schema: { type: 'string' },
              description: 'User ID',
            },
          ],
          responses: {
            '200': {
              description: 'User details',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/User' },
                },
              },
            },
            '404': { description: 'User not found' },
          },
        },
        put: {
          operationId: 'updateUser',
          summary: 'Update a user',
          description: 'Update user details (full replacement)',
          parameters: [
            {
              name: 'id',
              in: 'path',
              required: true,
              schema: { type: 'string' },
              description: 'User ID',
            },
          ],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    name: { type: 'string', description: 'User name' },
                    email: { type: 'string', description: 'User email' },
                  },
                },
              },
            },
          },
          responses: {
            '200': {
              description: 'Updated user',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/User' },
                },
              },
            },
            '404': { description: 'User not found' },
          },
        },
        patch: {
          operationId: 'patchUser',
          summary: 'Partially update a user',
          description: 'Update specific user fields',
          parameters: [
            {
              name: 'id',
              in: 'path',
              required: true,
              schema: { type: 'string' },
              description: 'User ID',
            },
          ],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    name: { type: 'string', description: 'User name' },
                    email: { type: 'string', description: 'User email' },
                  },
                },
              },
            },
          },
          responses: {
            '200': {
              description: 'Updated user',
              content: {
                'application/json': {
                  schema: { $ref: '#/components/schemas/User' },
                },
              },
            },
            '404': { description: 'User not found' },
          },
        },
        delete: {
          operationId: 'deleteUser',
          summary: 'Delete a user',
          description: 'Deletes a user by ID',
          parameters: [
            {
              name: 'id',
              in: 'path',
              required: true,
              schema: { type: 'string' },
              description: 'User ID',
            },
          ],
          responses: {
            '200': {
              description: 'Deletion confirmed',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      deleted: { type: 'boolean' },
                      id: { type: 'string' },
                    },
                  },
                },
              },
            },
          },
        },
      },
      '/reset': {
        post: {
          operationId: 'resetMockData',
          summary: 'Reset mock data',
          description: 'Resets all mock data to initial state',
          responses: {
            '200': {
              description: 'Reset confirmed',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      reset: { type: 'boolean' },
                      users: { type: 'integer' },
                      orders: { type: 'integer' },
                    },
                  },
                },
              },
            },
          },
        },
      },
      '/echo': {
        post: {
          operationId: 'echo',
          summary: 'Echo request body',
          description: 'Returns the request body back to you',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  additionalProperties: true,
                },
              },
            },
          },
          responses: {
            '200': {
              description: 'Echoed request',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      echo: { type: 'object' },
                      timestamp: { type: 'string' },
                    },
                  },
                },
              },
            },
          },
        },
      },
      '/protected': {
        get: {
          operationId: 'getProtected',
          summary: 'Protected endpoint',
          description: 'Requires a Bearer token. Returns token info if valid.',
          security: [{ bearerAuth: [] }],
          responses: {
            '200': {
              description: 'Auth successful',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      authenticated: { type: 'boolean' },
                      token_preview: { type: 'string' },
                    },
                  },
                },
              },
            },
            '401': { description: 'Unauthorized' },
          },
        },
      },
      '/orders': {
        get: {
          operationId: 'listOrders',
          summary: 'List orders',
          description: 'Returns a list of mock orders. Supports filtering.',
          parameters: [
            {
              name: 'status',
              in: 'query',
              schema: { type: 'string', enum: ['pending', 'completed', 'cancelled'] },
              description: 'Filter by status',
            },
            {
              name: 'limit',
              in: 'query',
              schema: { type: 'integer', default: 10 },
              description: 'Max results',
            },
          ],
          responses: {
            '200': {
              description: 'List of orders',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      orders: {
                        type: 'array',
                        items: { $ref: '#/components/schemas/Order' },
                      },
                    },
                  },
                },
              },
            },
          },
        },
      },
      '/orders/{id}/refund': {
        post: {
          operationId: 'refundOrder',
          summary: 'Refund an order',
          description: 'Process a refund for an order',
          parameters: [
            {
              name: 'id',
              in: 'path',
              required: true,
              schema: { type: 'string' },
              description: 'Order ID',
            },
          ],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    amount: { type: 'number', description: 'Refund amount' },
                    reason: { type: 'string', description: 'Reason for refund' },
                  },
                  required: ['amount'],
                },
              },
            },
          },
          responses: {
            '200': {
              description: 'Refund processed',
              content: {
                'application/json': {
                  schema: {
                    type: 'object',
                    properties: {
                      refund_id: { type: 'string' },
                      order_id: { type: 'string' },
                      amount: { type: 'number' },
                      status: { type: 'string' },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
    components: {
      schemas: {
        User: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            name: { type: 'string' },
            email: { type: 'string' },
            created_at: { type: 'string', format: 'date-time' },
          },
        },
        Order: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            customer_email: { type: 'string' },
            amount: { type: 'number' },
            status: { type: 'string', enum: ['pending', 'completed', 'cancelled'] },
            created_at: { type: 'string', format: 'date-time' },
          },
        },
      },
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
        },
      },
    },
  };

  return NextResponse.json(spec);
}
