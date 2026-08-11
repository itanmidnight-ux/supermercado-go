process.env.JWT_SECRET = 'test-secret-with-at-least-32-characters-long';
process.env.API_KEY = 'test-api-key-with-at-least-32-characters-long';
process.env.CORS_ORIGINS = 'http://localhost:3777';

const { validateBody } = require('../src/middleware/validate');
const { sanitizeInput } = require('../src/middleware/security');

function runMiddleware(middleware, req) {
  const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };
  const next = jest.fn();
  middleware(req, res, next);
  return { res, next };
}

describe('security middleware', () => {
  test('rejects unexpected body fields', () => {
    const { res, next } = runMiddleware(validateBody({ required: ['email'] }), {
      body: { email: 'user@example.com', is_admin: true },
    });

    expect(res.status).toHaveBeenCalledWith(400);
    expect(next).not.toHaveBeenCalled();
  });

  test('rejects non-plain JSON bodies', () => {
    const body = Object.create(null);
    body.email = 'user@example.com';
    const { res, next } = runMiddleware(validateBody({ required: ['email'] }), { body });

    expect(res.status).toHaveBeenCalledWith(400);
    expect(next).not.toHaveBeenCalled();
  });

  test('removes null bytes and trims scalar input', () => {
    const req = { body: { name: '  Ana\0  ' }, query: {} };
    const { next } = runMiddleware(sanitizeInput, req);

    expect(req.body.name).toBe('Ana');
    expect(next).toHaveBeenCalled();
  });
});
