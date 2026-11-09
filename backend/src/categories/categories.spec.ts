import { BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service.js';
import { CategoriesController } from './categories.controller.js';
import { CategoriesModule } from './categories.module.js';
import { CategoriesService } from './categories.service.js';
import { CategoryQueryDto } from './dto/category-query.dto.js';
import { CreateCategoryDto } from './dto/create-category.dto.js';
import { UpdateCategoryDto } from './dto/update-category.dto.js';

describe('CategoriesModule', () => {
  let categoriesController: CategoriesController;
  let categoriesService: CategoriesService;
  let prismaMock: Partial<PrismaService>;

  beforeEach(async () => {
    prismaMock = {};

    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [CategoriesModule],
    })
      .overrideProvider(PrismaService)
      .useValue(prismaMock)
      .compile();

    categoriesController =
      moduleRef.get<CategoriesController>(CategoriesController);
    categoriesService = moduleRef.get<CategoriesService>(CategoriesService);
  });

  it('should initialize CategoriesController and CategoriesService', () => {
    expect(categoriesController).toBeDefined();
    expect(categoriesService).toBeDefined();
    expect(categoriesService.getPrismaClient()).toBe(prismaMock);
  });

  describe('DTO Validation', () => {
    it('should validate a valid CreateCategoryDto payload', () => {
      const dto = CreateCategoryDto.validate({
        name: '  Network & VPN  ',
        description: '  Connectivity issues  ',
        isActive: true,
      });

      expect(dto.name).toBe('Network & VPN');
      expect(dto.description).toBe('Connectivity issues');
      expect(dto.isActive).toBe(true);
    });

    it('should reject invalid CreateCategoryDto payloads', () => {
      expect(() => CreateCategoryDto.validate(null)).toThrow(
        BadRequestException,
      );
      expect(() => CreateCategoryDto.validate({ name: '   ' })).toThrow(
        BadRequestException,
      );
      expect(() =>
        CreateCategoryDto.validate({ name: 'Hardware', description: 123 }),
      ).toThrow(BadRequestException);
      expect(() =>
        CreateCategoryDto.validate({ name: 'Hardware', isActive: 'yes' }),
      ).toThrow(BadRequestException);
    });

    it('should validate UpdateCategoryDto and reject invalid fields', () => {
      const dto = UpdateCategoryDto.validate({
        name: ' Software ',
        isActive: false,
      });

      expect(dto.name).toBe('Software');
      expect(dto.isActive).toBe(false);

      expect(() => UpdateCategoryDto.validate({ name: '' })).toThrow(
        BadRequestException,
      );
      expect(() => UpdateCategoryDto.validate('invalid')).toThrow(
        BadRequestException,
      );
    });

    it('should validate CategoryQueryDto', () => {
      const dto = CategoryQueryDto.validate({
        search: ' printer ',
        isActive: 'true',
      });

      expect(dto.search).toBe('printer');
      expect(dto.isActive).toBe(true);

      expect(() => CategoryQueryDto.validate({ isActive: 'invalid' })).toThrow(
        BadRequestException,
      );
    });
  });
});
