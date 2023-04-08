import * as request from 'supertest';

export function validateJwt(res: request.Response) {
    expect(res.body).toHaveProperty('token');
    expect(res.body.token).toMatch(/^[A-Za-z0-9-_=]+\.[A-Za-z0-9-_=]+\.?[A-Za-z0-9-_.+/=]*$/);
}