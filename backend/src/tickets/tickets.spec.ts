import { BadRequestException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { CategoriesService } from '../categories/categories.service.js';
import { PrismaService } from '../prisma/prisma.service.js';
import { CreateTicketDto } from './dto/create-ticket.dto.js';
import { TicketQueryDto } from './dto/ticket-query.dto.js';
import { UpdateTicketDto } from './dto/update-ticket.dto.js';
import { TicketsController } from './tickets.controller.js';
import { TicketsModule } from './tickets.module.js';
import { TicketsService } from './tickets.service.js';

describe('TicketsModule', () => {
  let ticketsController: TicketsController;
  let ticketsService: TicketsService;
  let categoriesService: CategoriesService;
  let prismaMock: Partial<PrismaService>;

  beforeEach(async () => {
    prismaMock = {};

    const moduleRef: TestingModule = await Test.createTestingModule({
      imports: [TicketsModule],
    })
      .overrideProvider(PrismaService)
      .useValue(prismaMock)
      .compile();

    ticketsController = moduleRef.get<TicketsController>(TicketsController);
    ticketsService = moduleRef.get<TicketsService>(TicketsService);
    categoriesService = moduleRef.get<CategoriesService>(CategoriesService);
  });

  it('should initialize TicketsController, TicketsService, and CategoriesService dependency', () => {
    expect(ticketsController).toBeDefined();
    expect(ticketsService).toBeDefined();
    expect(ticketsService.getPrismaClient()).toBe(prismaMock);
    expect(ticketsService.getCategoriesService()).toBe(categoriesService);
  });

  describe('DTO Validation', () => {
    it('should validate a valid CreateTicketDto payload', () => {
      const dto = CreateTicketDto.validate({
        title: '  Cannot connect to VPN  ',
        description: '  VPN client shows error 809  ',
        categoryId: '  cat_01  ',
        priority: '  HIGH  ',
      });

      expect(dto.title).toBe('Cannot connect to VPN');
      expect(dto.description).toBe('VPN client shows error 809');
      expect(dto.categoryId).toBe('cat_01');
      expect(dto.priority).toBe('HIGH');
    });

    it('should reject invalid CreateTicketDto payloads', () => {
      expect(() => CreateTicketDto.validate(null)).toThrow(BadRequestException);
      expect(() =>
        CreateTicketDto.validate({
          title: '',
          description: 'desc',
          categoryId: 'cat_01',
        }),
      ).toThrow(BadRequestException);
      expect(() =>
        CreateTicketDto.validate({
          title: 'Title',
          description: '',
          categoryId: 'cat_01',
        }),
      ).toThrow(BadRequestException);
      expect(() =>
        CreateTicketDto.validate({
          title: 'Title',
          description: 'desc',
          categoryId: '',
        }),
      ).toThrow(BadRequestException);
    });

    it('should validate UpdateTicketDto and reject invalid fields', () => {
      const dto = UpdateTicketDto.validate({
        title: ' Updated Title ',
        categoryId: ' cat_02 ',
      });

      expect(dto.title).toBe('Updated Title');
      expect(dto.categoryId).toBe('cat_02');

      expect(() => UpdateTicketDto.validate({ title: '   ' })).toThrow(
        BadRequestException,
      );
      expect(() => UpdateTicketDto.validate([])).toThrow(BadRequestException);
    });

    it('should validate TicketQueryDto', () => {
      const dto = TicketQueryDto.validate({
        categoryId: ' cat_01 ',
        status: ' OPEN ',
        page: '1',
        limit: '20',
      });

      expect(dto.categoryId).toBe('cat_01');
      expect(dto.status).toBe('OPEN');
      expect(dto.page).toBe(1);
      expect(dto.limit).toBe(20);

      expect(() => TicketQueryDto.validate({ page: '0' })).toThrow(
        BadRequestException,
      );
      expect(() => TicketQueryDto.validate({ limit: '500' })).toThrow(
        BadRequestException,
      );
    });
  });
});
