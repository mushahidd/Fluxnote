// Jest global setup — mocks external dependencies that require env/network
// This runs BEFORE any test file, so jest.mock() in individual files still works.

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret-key-for-jest';
process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://test:test@localhost:5432/test_db';
process.env.GROQ_API_KEY = process.env.GROQ_API_KEY || 'test-groq-key';

// Mock groq-sdk so tests don't need a real API key
jest.mock('groq-sdk', () => {
  return jest.fn().mockImplementation(() => ({
    chat: {
      completions: {
        create: jest.fn().mockResolvedValue({
          choices: [{ message: { content: '{"intent":"reference","confidence":0.9}' } }],
        }),
      },
    },
  }));
});

// Mock @prisma/client so tests don't need a real database
jest.mock('@prisma/client', () => {
  const mockPrisma = {
    user: {
      findUnique: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue({ id: 'test-user-id' }),
    },
    room: {
      findUnique: jest.fn().mockResolvedValue({ id: 'test-room-id', name: 'Test Room' }),
      create: jest.fn().mockResolvedValue({ id: 'test-room-id' }),
    },
    event: {
      create: jest.fn().mockResolvedValue({ id: 1 }),
      findMany: jest.fn().mockResolvedValue([]),
      findFirst: jest.fn().mockResolvedValue(null),
    },
    nodeAcl: {
      findUnique: jest.fn().mockResolvedValue(null),
      upsert: jest.fn().mockResolvedValue({ nodeId: 'test-node', allowedRoles: ['Lead', 'Contributor'] }),
    },
    task: {
      findMany: jest.fn().mockResolvedValue([]),
      findFirst: jest.fn().mockResolvedValue(null),
      create: jest.fn().mockResolvedValue({ id: 'test-task-id' }),
      update: jest.fn().mockResolvedValue({ id: 'test-task-id', status: 'done' }),
    },
    $disconnect: jest.fn().mockResolvedValue(undefined),
  };

  return { PrismaClient: jest.fn(() => mockPrisma) };
});
