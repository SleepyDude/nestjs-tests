import { Test, TestingModule } from '@nestjs/testing';
import { HttpServer, INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { ProfilesModule } from '../../src/profiles/profiles.module'
import { SequelizeModule } from '@nestjs/sequelize';
import { InitModule } from '../../src/init/init.module'
import { validateJwt } from '../validators/jwt-token.validator';

describe('e2e', () => {
    let app: INestApplication;
    let johnSmithToken: { 'token': string; }; // USER ROLE
    let janeDoeToken: { 'token': string; }; // USER, ADMIN ROLE
    let ownerToken: { 'token': string; }; // OWNER ROLE

    beforeAll(async () => {
        const moduleFixture: TestingModule = await Test.createTestingModule({
            imports: [
                SequelizeModule.forRoot({
                    dialect: 'sqlite',
                    storage: ':memory:',
                    autoLoadModels: true,
                    logging: false,
                }),
                ProfilesModule,
                InitModule
            ],
        }).compile();

        app = moduleFixture.createNestApplication();
        await app.init();
    });

    it('Инициализация ролей, регистрация админа (владельца)', () => {
        return request(app.getHttpServer())
            .post('/init')
            .send({email: 'admin@mail.ru', password: 'Adm1nPa$$word'});
    });

    it('Сохранение токена владельца', () => {
        return request(app.getHttpServer())
            .post('/auth/login')
            .send({email: 'admin@mail.ru', password: 'Adm1nPa$$word'})
            .expect( (res) => {
                ownerToken = JSON.parse(res.text);
            });
    });

    it('Регистрируем новый профиль John Smith', () => {
        return request(app.getHttpServer())
            .post('/profiles/registration')
            .send({email: 'johnsmith@mail.ru', password: '123321', username: 'JohnSmith', social: 'https://johnsmith.com' })
            .expect(201)
            .expect(validateJwt)
            .expect( (res) => {
                johnSmithToken = JSON.parse(res.text);
                // console.log(`got ${JSON.stringify(user1token, undefined, 2)}`)
            });
    });

    it('Получаем информацию о профиле по email -> неудача, нет заголовка авторизации', () => {
        return request(app.getHttpServer())
            .get('/profiles/johnsmith@mail.ru')
            .expect(401)
            .expect({"message":"Нет заголовка авторизации"});
    });

    it('Получаем информацию о своем профиле по email -> успех', () => {
        return request(app.getHttpServer())
            .get('/profiles/johnsmith@mail.ru')
            .auth(johnSmithToken.token, { type: "bearer" })
            .expect(200)
            .expect( (res) => {
                const profile = JSON.parse(res.text); 
                expect(profile.username).toBe('JohnSmith');
                expect(profile.social).toBe('https://johnsmith.com');
                expect(profile.user.email).toBe('johnsmith@mail.ru');
            });
    });

    it('Регистрируем новый профиль Jane Doe', () => {
        return request(app.getHttpServer())
            .post('/profiles/registration')
            .send({email: 'janedoe@mail.ru', password: '123321', username: 'JaneDoe', social: 'https://janedoe.com' })
            .expect(201)
            .expect(validateJwt)
            .expect( (res) => {
                janeDoeToken = JSON.parse(res.text);
            });
    });

    it('Пытаемся получить профиль John Smith по email от Jane Doe -> неудача', () => {
        return request(app.getHttpServer())
            .get('/profiles/johnsmith@mail.ru')
            .auth(janeDoeToken.token, { type: "bearer" })
            .expect(403)
            .expect({statusCode: 403, message: 'Недостаточно прав'});
    });

    it('Пытаемся получить профиль John Smith по email от admin (OWNER) -> успех', () => {
        return request(app.getHttpServer())
            .get('/profiles/johnsmith@mail.ru')
            .auth(ownerToken.token, { type: "bearer" })
            .expect(200)
            .expect( (res) => {
                const profile = JSON.parse(res.text); 
                expect(profile.username).toBe('JohnSmith');
                expect(profile.social).toBe('https://johnsmith.com');
                expect(profile.user.email).toBe('johnsmith@mail.ru');
            });
    });

    it('Пытаемся получить все профили от admin (OWNER) -> успех', () => {
        return request(app.getHttpServer())
            .get('/profiles')
            .auth(ownerToken.token, { type: "bearer" })
            .expect(200)
            .expect( (res) => {
                const profiles = JSON.parse(res.text) as Array<any>;
                expect(profiles).toBeInstanceOf(Array);
                expect(profiles.length).toBe(3);
                // console.log(`${JSON.stringify(profiles, undefined, 2)}`);
            });
    });

    it('Пытаемся получить все профили от JaneDoe (USER) -> неудача, нет прав', () => {
        return request(app.getHttpServer())
            .get('/profiles')
            .auth(janeDoeToken.token, { type: "bearer" })
            .expect(403);
    });

    it('Выдаем JaneDoe новую роль ADMIN', () => {
        return request(app.getHttpServer())
            .post('/users/role')
            .auth(ownerToken.token, { type: "bearer" })
            .send({userId: 3, roleName: 'ADMIN'})
            .expect(201);
    });

    it('Обновляем токен для JaneDoe', () => {
        return request(app.getHttpServer())
            .post('/auth/login')
            .send({email: 'janedoe@mail.ru', password: '123321'})
            .expect( (res) => {
                janeDoeToken = JSON.parse(res.text);
            });
    });

    it('Пытаемся получить все профили от JaneDoe (USER, ADMIN) -> успех', () => {
        return request(app.getHttpServer())
            .get('/profiles')
            .auth(janeDoeToken.token, { type: "bearer" })
            .expect(200)
            .expect( (res) => {
                const profiles = JSON.parse(res.text) as Array<any>;
                expect(profiles).toBeInstanceOf(Array);
                expect(profiles.length).toBe(3);
            });
    });

    it('JohnSmith (USER) обновляет свой профиль -> успех', () => {
        return request(app.getHttpServer())
            .put('/profiles/johnsmith@mail.ru')
            .auth(johnSmithToken.token, { type: "bearer" })
            .send({
                username: 'Johny Smittie',
                social: 'http://johnysmittie.com'
            })
            .expect(200)
            .expect( (res) => {
                const profile = JSON.parse(res.text);
                expect(profile).toHaveProperty('social', 'http://johnysmittie.com');
                expect(profile).toHaveProperty('username', 'Johny Smittie');
                // console.log(JSON.stringify(JSON.parse(res.text), undefined, 2));
            });
    }); 

    it('JohnSmith (USER) обновляет профиль JaneDoe (USER, ADMIN) -> неудача', () => {
        return request(app.getHttpServer())
            .put('/profiles/janedoe@mail.ru')
            .auth(johnSmithToken.token, { type: "bearer" })
            .send({
                username: 'Johny Smittie',
                social: 'http://johnysmittie.com'
            })
            .expect(403);
    });

    it('JaneDoe (USER, ADMIN) обновляет профиль JohnSmith (USER) -> успех', () => {
        return request(app.getHttpServer())
            .put('/profiles/johnsmith@mail.ru')
            .auth(janeDoeToken.token, { type: "bearer" })
            .send({
                username: 'Jon S.',
            })
            .expect(200)
            .expect( (res) => {
                const profile = JSON.parse(res.text);
                expect(profile).toHaveProperty('username', 'Jon S.');
            });
    }); 

    it('JohnSmith (USER) удаляет профиль JaneDoe (USER, ADMIN) -> неудача', () => {
        return request(app.getHttpServer())
            .delete('/profiles/janedoe@mail.ru')
            .auth(johnSmithToken.token, { type: "bearer" })
            .expect(403);
    }); 

    it('JaneDoe (USER, ADMIN) удаляет профиль JohnSmith (USER) -> успех', () => {
        return request(app.getHttpServer())
            .delete('/profiles/johnsmith@mail.ru')
            .auth(janeDoeToken.token, { type: "bearer" })
            .expect(204);
    }); 

    it('JaneDoe (USER, ADMIN) удаляет свой профиль -> успех', () => {
        return request(app.getHttpServer())
            .delete('/profiles/janedoe@mail.ru')
            .auth(janeDoeToken.token, { type: "bearer" })
            .expect(204);
    });

    it('Получаем все профили от admin, убеждаемся, что их 1 шт.', () => {
        return request(app.getHttpServer())
            .get('/profiles')
            .auth(ownerToken.token, { type: "bearer" })
            .expect(200)
            .expect( (res) => {
                const profiles = JSON.parse(res.text) as Array<any>;
                expect(profiles).toBeInstanceOf(Array);
                expect(profiles.length).toBe(1);
                // console.log(`${JSON.stringify(profiles, undefined, 2)}`);
            });
    });

    afterAll(async () => {
        await app.close();
    });
});