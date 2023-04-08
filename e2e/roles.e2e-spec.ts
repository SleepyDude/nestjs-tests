import { Test, TestingModule } from '@nestjs/testing';
import { HttpServer, INestApplication } from '@nestjs/common';
import * as request from 'supertest';
// import { AppModule } from './../src/app.module';
import { ProfilesModule } from '../../src/profiles/profiles.module';
import { SequelizeModule } from '@nestjs/sequelize';
import { InitModule } from '../../src/init/init.module';
import * as fs from 'fs';
import { Role } from 'src/roles/roles.model';

const testDbName = 'testdb.sqlite';


describe('e2e', () => {
    let app: INestApplication;
    let ownerToken: { token: string; };
    
    let janeDoeToken: { token: string; };
    let johnSmithToken: { token: string; };
    let bobToken: { token: string; };

    beforeAll(async () => {
        const moduleFixture: TestingModule = await Test.createTestingModule({
            imports: [
                SequelizeModule.forRoot({
                    dialect: 'sqlite',
                    storage: ':memory:',
                    autoLoadModels: true,
                    logging: false,
                }),
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

    it('Получение всех ролей после инициализации сервера (3 роли)', () => {
        return request(app.getHttpServer())
            .get('/roles')
            .expect(200)
            .expect( (res) => {
                const roles = JSON.parse(res.text) as Array<Role>;
                expect(roles).toBeInstanceOf(Array);
                expect(roles).toHaveLength(3);
                const roleNames = roles.map( role => role.name );
                expect(roleNames).toEqual(expect.arrayContaining(['USER', 'ADMIN', 'OWNER']));
            });
    });

    it('Получение роли OWNER[999] по имени', () => {
        return request(app.getHttpServer())
            .get('/roles/OWNER')
            .expect(200)
            .expect( (res) => {
                const role = JSON.parse(res.text) as Role;
                expect(role).toHaveProperty('name', 'OWNER');
                expect(role).toHaveProperty('value', 999);
                expect(role).toHaveProperty('description', 'Владелец ресурса');
            });
    });

    it('Регистрируем новый профиль Jane Doe', () => {
        return request(app.getHttpServer())
            .post('/profiles/registration')
            .send({email: 'janedoe@mail.ru', password: '123321', username: 'JaneDoe', social: 'https://janedoe.com' })
            .expect(201)
            .expect( (res) => {
                janeDoeToken = JSON.parse(res.text);
            });
    });

    it('Регистрируем новый профиль Bob', () => {
        return request(app.getHttpServer())
            .post('/profiles/registration')
            .send({email: 'bob@mail.ru', password: '123321', username: 'Bob' })
            .expect(201)
            .expect( (res) => {
                bobToken = JSON.parse(res.text);
            });
    });

    it('Регистрируем новый профиль John Smith', () => {
        return request(app.getHttpServer())
            .post('/profiles/registration')
            .send({email: 'johnsmith@mail.ru', password: '123321', username: 'JohnSmith', social: 'https://johnsmith.com' })
            .expect(201)
            .expect( (res) => {
                johnSmithToken = JSON.parse(res.text);
            });
    });

    it('Создаем новую роль от имени John Smith (USER[1]) -> неудача, минимальная роль - ADMIN[10]', () => {
        return request(app.getHttpServer())
            .post('/roles')
            .auth(johnSmithToken.token, { type: "bearer" })
            .send({
                name: 'SMALLADMIN',
                description: 'маленький админ',
                value: 7,
            })
            .expect(403);
    });

    it('Создаем новую роль SMALL[7] от имени admin (OWNER[999]) -> успех', () => {
        return request(app.getHttpServer())
            .post('/roles')
            .auth(ownerToken.token, { type: "bearer" })
            .send({
                name: 'SMALL',
                description: 'маленький админ',
                value: 7,
            })
            .expect(201);
    });

    it('Создаем новую роль BIG[15] от имени admin (OWNER[999]) -> успех', () => {
        return request(app.getHttpServer())
            .post('/roles')
            .auth(ownerToken.token, { type: "bearer" })
            .send({
                name: 'BIG',
                description: 'большой админ',
                value: 15,
            })
            .expect(201);
    });

    it('Проверяем, что теперь есть (5 ролей)', () => {
        return request(app.getHttpServer())
            .get('/roles')
            .expect(200)
            .expect( (res) => {
                const roles = JSON.parse(res.text) as Array<Role>;
                expect(roles).toBeInstanceOf(Array);
                expect(roles).toHaveLength(5);
                const roleNames = roles.map( role => role.name );
                expect(roleNames).toEqual(expect.arrayContaining(['USER', 'ADMIN', 'OWNER', 'SMALL', 'BIG']));
            });
    });
    
    it('От лица OWNER[999] выдаем JaneDoe роль SMALL[7]', () => {
        return request(app.getHttpServer())
            .post('/users/role')
            .auth(ownerToken.token, { type: "bearer" })
            .send({userId: 2, roleName: 'SMALL'})
            .expect(201);
    });

    it('От лица OWNER[999] выдаем Bob роль ADMIN[10]', () => {
        return request(app.getHttpServer())
            .post('/users/role')
            .auth(ownerToken.token, { type: "bearer" })
            .send({userId: 3, roleName: 'ADMIN'})
            .expect(201);
    });

    it('От лица OWNER[999] выдаем JohnSmith роль BIG[15]', () => {
        return request(app.getHttpServer())
            .post('/users/role')
            .auth(ownerToken.token, { type: "bearer" })
            .send({userId: 4, roleName: 'BIG'})
            .expect(201);
    });

    it('Обновляем токен авторизации для JaneDoe', () => {
        return request(app.getHttpServer())
            .post('/auth/login')
            .send({email: 'janedoe@mail.ru', password: '123321'})
            .expect( (res) => {
                janeDoeToken = JSON.parse(res.text);
            });
    });

    it('Обновляем токен авторизации для Bob', () => {
        return request(app.getHttpServer())
            .post('/auth/login')
            .send({email: 'bob@mail.ru', password: '123321'})
            .expect( (res) => {
                bobToken = JSON.parse(res.text);
            });
    });

    it('Обновляем токен авторизации для JohnSmith', () => {
        return request(app.getHttpServer())
            .post('/auth/login')
            .send({email: 'johnsmith@mail.ru', password: '123321'})
            .expect( (res) => {
                johnSmithToken = JSON.parse(res.text);
            });
    });

    it('Создаем новую роль SMALLER[3] от имени JaneDoe (SMALL[7]) -> неудача, минимум ADMIN[10]', () => {
        return request(app.getHttpServer())
            .post('/roles')
            .auth(janeDoeToken.token, { type: "bearer" })
            .send({
                name: 'SMALLER',
                description: 'очень маленький админ',
                value: 3,
            })
            .expect(403);
    });

    it('Создаем новую роль SMALLER[3] от имени Bob (ADMIN[10]) -> успех', () => {
        return request(app.getHttpServer())
            .post('/roles')
            .auth(bobToken.token, { type: "bearer" })
            .send({
                name: 'SMALLER',
                description: 'очень маленький админ',
                value: 3,
            })
            .expect(201);
    });

    it('Создаем новую роль MIDDLE[13] от имени Bob (ADMIN[10]) -> неудача, 13 > 10', () => {
        return request(app.getHttpServer())
            .post('/roles')
            .auth(bobToken.token, { type: "bearer" })
            .send({
                name: 'MIDDLE',
                description: 'что-то среднее',
                value: 13,
            })
            .expect(403);
    });

    it('Создаем новую роль MIDDLE[13] от имени JohnSmith (BIG[15]) -> успех, 13 < 15', () => {
        return request(app.getHttpServer())
            .post('/roles')
            .auth(johnSmithToken.token, { type: "bearer" })
            .send({
                name: 'MIDDLE',
                description: 'что-то среднее',
                value: 13,
            })
            .expect(201);
    });

    it('Проверка роли MIDDLE[13]', () => {
        return request(app.getHttpServer())
            .get('/roles/MIDDLE')
            .expect(200)
            .expect( (res) => {
                const role = JSON.parse(res.text) as Role;
                expect(role).toHaveProperty('name', 'MIDDLE');
                expect(role).toHaveProperty('value', 13);
                expect(role).toHaveProperty('description', 'что-то среднее');
            });
    });

    it('Изменение роли SMALLER[3] от имени JaneDoe[7] -> Неудача, 7 < ADMIN[10]', () => {
        return request(app.getHttpServer())
            .put('/roles/SMALLER')
            .auth(janeDoeToken.token, { type: "bearer" })
            .send({
                value: 5
            })
            .expect(403);
    });

    it('Изменение роли (SMALLER[3] to SMALLER[5]) от имени Bob ADMIN[10] -> Успех', () => {
        return request(app.getHttpServer())
            .put('/roles/SMALLER')
            .auth(bobToken.token, { type: "bearer" })
            .send({
                value: 5
            })
            .expect(200)
            .expect( (res) => {
                const role = JSON.parse(res.text) as Role;
                expect(role).toHaveProperty('value', 5);
            });
    });

    it('Проверка роли SMALLER[5] по имени', () => {
        return request(app.getHttpServer())
            .get('/roles/SMALLER')
            .expect(200)
            .expect( (res) => {
                const role = JSON.parse(res.text) as Role;
                expect(role).toHaveProperty('name', 'SMALLER');
                expect(role).toHaveProperty('value', 5);
                expect(role).toHaveProperty('description', 'очень маленький админ');
            });
    });

    it('Изменение роли (SMALLER[5] to SMALLER[12]) от имени Bob ADMIN[10] -> Неудача, попытка сделать роль с большим value', () => {
        return request(app.getHttpServer())
            .put('/roles/SMALLER')
            .auth(bobToken.token, { type: "bearer" })
            .send({
                value: 12
            })
            .expect(403);
    });

    it('Изменение роли (SMALLER[5] to SMALLER[12]) от имени John Smith BIG[15] -> Успех', () => {
        return request(app.getHttpServer())
            .put('/roles/SMALLER')
            .auth(johnSmithToken.token, { type: "bearer" })
            .send({
                value: 12
            })
            .expect(200)
            .expect( (res) => {
                // console.log(JSON.stringify(JSON.parse(res.text), undefined, 2));
            });
    });

    it('Изменение роли (SMALLER[12] -> SMOLLER[12]) от имени Bob ADMIN[10] -> Неудача, попытка влияния на роль с большим value', () => {
        return request(app.getHttpServer())
            .put('/roles/SMALLER')
            .auth(bobToken.token, { type: "bearer" })
            .send({
                name: "SMOLLER"
            })
            .expect(403);
    });

    it('Удаление роли SMALLER[12] от имени Bob ADMIN[10] -> неудача, попытка влияния на роль с большим value', () => {
        return request(app.getHttpServer())
            .delete('/roles/SMALLER')
            .auth(bobToken.token, { type: "bearer" })
            .expect(403);
    });
    
    it('Проверяем, что все роли на месте, 7 шт. : (USER, SMALLER, SMALL, ADMIN, MIDDLE, BIG, OWNER)', () => {
        return request(app.getHttpServer())
            .get('/roles')
            .expect(200)
            .expect( (res) => {
                const roles = JSON.parse(res.text) as Array<Role>;
                expect(roles).toBeInstanceOf(Array);
                expect(roles).toHaveLength(7);
                const roleNames = roles.map( role => role.name );
                expect(roleNames).toEqual(expect.arrayContaining(['USER', 'SMALLER', 'SMALL', 'ADMIN', 'MIDDLE', 'BIG', 'OWNER']));
            });
    });

    it('Удаление роли SMALL[5] от имени Bob ADMIN[10] -> успех', () => {
        return request(app.getHttpServer())
            .delete('/roles/SMALL')
            .auth(bobToken.token, { type: "bearer" })
            .expect(204);
    });

    it('Проверяем, что стало 6 ролей', () => {
        return request(app.getHttpServer())
            .get('/roles')
            .expect(200)
            .expect( (res) => {
                const roles = JSON.parse(res.text) as Array<Role>;
                expect(roles).toBeInstanceOf(Array);
                expect(roles).toHaveLength(6);
                const roleNames = roles.map( role => role.name );
                expect(roleNames).toEqual(expect.arrayContaining(['USER', 'SMALLER', 'ADMIN', 'MIDDLE', 'BIG', 'OWNER']));
            });
    });

    afterAll(async () => {
        await app.close();
    });
});