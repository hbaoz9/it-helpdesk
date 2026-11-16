import { Controller, Get } from '@nestjs/common';
import { CategoriesService } from './categories.service.js';

@Controller('api/v1/categories')
export class CategoriesController {
  constructor(private readonly categoriesService: CategoriesService) {}

  @Get()
  findActive() {
    return this.categoriesService.findActive();
  }
}
