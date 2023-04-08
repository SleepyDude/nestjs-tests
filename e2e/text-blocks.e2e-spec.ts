import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { SequelizeModule } from '@nestjs/sequelize';
import { InitModule } from '../../src/init/init.module';
import { TextBlock } from 'src/text-blocks/text-blocks.model';
import { TextBlocksModule } from './../../src/text-blocks/text-blocks.module';
import * as path from 'path';
import * as fs from 'fs';

describe('TextBlocks and files e2e', () => {
    let app: INestApplication;
    const dog2_pathfile = path.resolve(__dirname, '../data/dog-2.jpeg');
    const files_folder_path = path.resolve(__dirname, '../../src/static/');
    let ownerToken: { token: string; };

    beforeAll(async () => {
        const moduleFixture: TestingModule = await Test.createTestingModule({
            imports: [
                SequelizeModule.forRoot({
                    dialect: 'sqlite',
                    storage: ':memory:',
                    autoLoadModels: true,
                    logging: false,
                }),
                InitModule,
                TextBlocksModule
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

    it('Сохранение токена владельца', () => {
        return request(app.getHttpServer())
            .post('/auth/login')
            .send({email: 'admin@mail.ru', password: 'Adm1nPa$$word'})
            .expect( (res) => {
                ownerToken = JSON.parse(res.text);
            });
    });

    it('Создаем 1й текстовый блок без изображения', () => {
        return request(app.getHttpServer())
            .post('/text-blocks')
            .auth(ownerToken.token, { type: 'bearer' })
            .send({
                searchName: 'dog-1',
                name: 'Brick Dog',
                text: 'doge',
                group: 'dogs'
            })
            .expect(201)
            .expect( (res) => {
                const tb = JSON.parse(res.text) as TextBlock;
                expect(tb).toHaveProperty('searchName', 'dog-1');
                expect(tb).toHaveProperty('name', 'Brick Dog');
                expect(tb).toHaveProperty('text', 'doge');
                expect(tb).toHaveProperty('group', 'dogs');
            });
    });

    it('Создаем 2й текстовый блок с изображением', () => {
        return request(app.getHttpServer())
            .post('/text-blocks')
            .auth(ownerToken.token, { type: 'bearer' })
            .attach('file', dog2_pathfile)
            .field('searchName', 'dog-2')
            .field('name', 'Sad Dog')
            .field('text', 'why he so sad')
            .field('group', 'dogs')
            .expect(201)
            .expect( (res) => {
                const tb = JSON.parse(res.text) as TextBlock;
                expect(tb).toHaveProperty('searchName', 'dog-2');
                expect(tb).toHaveProperty('name', 'Sad Dog');
                expect(tb).toHaveProperty('text', 'why he so sad');
                expect(tb).toHaveProperty('group', 'dogs');

                try {
                    const files = fs.readdirSync(files_folder_path);
                    console.log(`files: ${files}`);
                } catch (e) {
                    console.log(e);
                }
            });
    });

    afterAll(async () => {
        await app.close();
    });
});