import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { SequelizeModule } from '@nestjs/sequelize';
import { InitModule } from '../../src/init/init.module';

describe('e2e', () => {
    let app: INestApplication;

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

    it('Инициализируем ресурс', () => {
        return request(app.getHttpServer())
            .post('/init')
            .send({email: 'admin@mail.ru', password: 'Adm1nPa$$word' })
            .expect(201);
    });

    afterAll(async () => {
        await app.close();
    });
});