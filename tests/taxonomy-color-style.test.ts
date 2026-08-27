import { describe, it, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  createColorSchema,
  updateColorSchema,
  colorQuerySchema,
  hexColorRegex,
} from '../src/modules/color/color.validation';
import {
  createStyleSchema,
  updateStyleSchema,
  styleQuerySchema,
} from '../src/modules/style/style.validation';
import {
  createKeyboardSchema,
  updateKeyboardSchema,
  keyboardPublicQuerySchema,
} from '../src/modules/keyboard/keyboard.validation';
import { ColorService } from '../src/modules/color/color.service';
import { StyleService } from '../src/modules/style/style.service';
import { KeyboardService } from '../src/modules/keyboard/keyboard.service';
import { AppError } from '../src/common/errors/app-error';
import { ERROR_CODE } from '../src/common/errors/error-code';

describe('Color & Style Validation Schemas', () => {
  it('should validate hex color code formats', () => {
    assert.equal(hexColorRegex.test('#FFB7C5'), true);
    assert.equal(hexColorRegex.test('#ffffff'), true);
    assert.equal(hexColorRegex.test('#000000'), true);
    assert.equal(hexColorRegex.test('#A2CFFE'), true);
    assert.equal(hexColorRegex.test('#FFF'), true); // 3-digit shorthand hex
    assert.equal(hexColorRegex.test('#FF'), false); // 2 digits invalid
    assert.equal(hexColorRegex.test('FFB7C5'), false); // Missing #
    assert.equal(hexColorRegex.test('#ZZZZZZ'), false); // Invalid hex
    assert.equal(hexColorRegex.test('#1234567'), false); // 7 digits invalid
  });

  it('should validate createColorSchema', () => {
    const valid = createColorSchema.parse({
      name: 'Pastel Pink',
      hex: '#FFB7C5',
    });
    assert.equal(valid.name, 'Pastel Pink');
    assert.equal(valid.hex, '#FFB7C5');

    assert.throws(() => {
      createColorSchema.parse({ name: 'P', hex: '#FFB7C5' }); // Min 2 chars
    });

    assert.throws(() => {
      createColorSchema.parse({ name: 'Pink', hex: 'invalid' });
    });
  });

  it('should validate createStyleSchema', () => {
    const valid = createStyleSchema.parse({
      name: 'Cyberpunk Neon',
      description: 'Futuristic aesthetic',
    });
    assert.equal(valid.name, 'Cyberpunk Neon');
    assert.equal(valid.description, 'Futuristic aesthetic');

    assert.throws(() => {
      createStyleSchema.parse({ name: 'C' }); // Min 2 chars
    });
  });

  it('should validate keyboardPublicQuerySchema with color, colors, style, styles', () => {
    const parsed = keyboardPublicQuerySchema.parse({
      color: 'pink',
      styles: 'kawaii,pastel',
    });
    assert.equal(parsed.color, 'pink');
    assert.equal(parsed.styles, 'kawaii,pastel');
  });

  it('should validate createKeyboardSchema with colorIds and styleIds', () => {
    const valid = createKeyboardSchema.parse({
      name: 'Cyber Sakura',
      coverUrl: 'https://cdn.example.com/cover.webp',
      driveUrl: 'https://drive.google.com/file/d/123/view',
      platform: 'BOTH',
      categoryIds: ['b9bdf875-6c80-4a0a-8b14-0b64f71a1f81'],
      colorIds: ['a1b2c3d4-e5f6-4a0a-8b14-0b64f71a1f81'],
      styleIds: ['c1d2e3f4-a5b6-4a0a-8b14-0b64f71a1f81'],
    });
    assert.equal(valid.colorIds?.length, 1);
    assert.equal(valid.styleIds?.length, 1);
  });
});

describe('Color Service Unit Tests', () => {
  let colorsDb: Map<string, any>;
  let mockColorRepo: any;
  let service: ColorService;

  beforeEach(() => {
    colorsDb = new Map();

    mockColorRepo = {
      findPublicColors: async () => {
        return Array.from(colorsDb.values()).map((c) => ({
          id: c.id,
          name: c.name,
          slug: c.slug,
          hex: c.hex,
          themeCount: 0,
        }));
      },
      findAll: async (query: any) => {
        let list = Array.from(colorsDb.values());
        if (query.search) {
          list = list.filter((c) => c.name.toLowerCase().includes(query.search.toLowerCase()));
        }
        return { data: list, meta: { total: list.length, page: 1, limit: 20, totalPages: 1 } };
      },
      findById: async (id: string) => colorsDb.get(id) || null,
      findBySlug: async (slug: string) => {
        return Array.from(colorsDb.values()).find((c) => c.slug === slug) || null;
      },
      findByIds: async (ids: string[]) => {
        return Array.from(colorsDb.values()).filter((c) => ids.includes(c.id));
      },
      create: async (data: any) => {
        const record = { id: 'col-' + (colorsDb.size + 1), ...data, createdAt: new Date(), updatedAt: new Date() };
        colorsDb.set(record.id, record);
        return record;
      },
      update: async (id: string, data: any) => {
        const existing = colorsDb.get(id);
        if (!existing) throw new Error('Not found');
        const updated = { ...existing, ...data, updatedAt: new Date() };
        colorsDb.set(id, updated);
        return updated;
      },
      delete: async (id: string) => {
        colorsDb.delete(id);
      },
      createAuditLog: async () => {},
    };

    service = new ColorService();
    (service as any).repository = mockColorRepo;
  });

  it('should create a color with auto-generated slug and uppercase hex', async () => {
    const created = await service.create({ name: 'Pastel Blue', hex: '#a2cffe' });
    assert.equal(created.name, 'Pastel Blue');
    assert.equal(created.slug, 'pastel-blue');
    assert.equal(created.hex, '#A2CFFE');
  });

  it('should reject creating duplicate color slug', async () => {
    await service.create({ name: 'Pink', hex: '#FFB7C5' });
    await assert.rejects(
      async () => service.create({ name: 'Pink', hex: '#FFC0CB' }),
      (err: AppError) => {
        assert.equal(err.statusCode, 409);
        assert.equal(err.code, ERROR_CODE.COLOR_SLUG_EXISTS);
        return true;
      },
    );
  });

  it('should update color hex and name', async () => {
    const color = await service.create({ name: 'Purple', hex: '#B57EDC' });
    const updated = await service.update(color.id, { hex: '#9B59B6' });
    assert.equal(updated.hex, '#9B59B6');
  });

  it('should delete a color successfully', async () => {
    const color = await service.create({ name: 'White', hex: '#FFFFFF' });
    const res = await service.delete(color.id);
    assert.equal(res.message, 'Color deleted successfully');
    assert.equal(colorsDb.has(color.id), false);
  });
});

describe('Style Service Unit Tests', () => {
  let stylesDb: Map<string, any>;
  let mockStyleRepo: any;
  let service: StyleService;

  beforeEach(() => {
    stylesDb = new Map();

    mockStyleRepo = {
      findPublicStyles: async () => {
        return Array.from(stylesDb.values()).map((s) => ({
          id: s.id,
          name: s.name,
          slug: s.slug,
          description: s.description,
          themeCount: 0,
        }));
      },
      findAll: async (query: any) => {
        let list = Array.from(stylesDb.values());
        if (query.search) {
          list = list.filter((s) => s.name.toLowerCase().includes(query.search.toLowerCase()));
        }
        return { data: list, meta: { total: list.length, page: 1, limit: 20, totalPages: 1 } };
      },
      findById: async (id: string) => stylesDb.get(id) || null,
      findBySlug: async (slug: string) => {
        return Array.from(stylesDb.values()).find((s) => s.slug === slug) || null;
      },
      findByIds: async (ids: string[]) => {
        return Array.from(stylesDb.values()).filter((s) => ids.includes(s.id));
      },
      create: async (data: any) => {
        const record = { id: 'sty-' + (stylesDb.size + 1), ...data, createdAt: new Date(), updatedAt: new Date() };
        stylesDb.set(record.id, record);
        return record;
      },
      update: async (id: string, data: any) => {
        const existing = stylesDb.get(id);
        if (!existing) throw new Error('Not found');
        const updated = { ...existing, ...data, updatedAt: new Date() };
        stylesDb.set(id, updated);
        return updated;
      },
      delete: async (id: string) => {
        stylesDb.delete(id);
      },
      createAuditLog: async () => {},
    };

    service = new StyleService();
    (service as any).repository = mockStyleRepo;
  });

  it('should create a style with auto-generated slug', async () => {
    const created = await service.create({ name: 'Cyberpunk Neon', description: 'Glow neon style' });
    assert.equal(created.name, 'Cyberpunk Neon');
    assert.equal(created.slug, 'cyberpunk-neon');
    assert.equal(created.description, 'Glow neon style');
  });

  it('should reject creating duplicate style slug', async () => {
    await service.create({ name: 'Kawaii' });
    await assert.rejects(
      async () => service.create({ name: 'Kawaii' }),
      (err: AppError) => {
        assert.equal(err.statusCode, 409);
        assert.equal(err.code, ERROR_CODE.STYLE_SLUG_EXISTS);
        return true;
      },
    );
  });

  it('should update style description and name', async () => {
    const style = await service.create({ name: 'Minimal' });
    const updated = await service.update(style.id, { description: 'Super minimal clean look' });
    assert.equal(updated.description, 'Super minimal clean look');
  });

  it('should delete a style successfully', async () => {
    const style = await service.create({ name: 'Retro' });
    const res = await service.delete(style.id);
    assert.equal(res.message, 'Style deleted successfully');
    assert.equal(stylesDb.has(style.id), false);
  });
});

describe('Keyboard Service Taxonomy Association & Validation', () => {
  let mockCategoryRepo: any;
  let mockColorRepo: any;
  let mockStyleRepo: any;
  let mockKeyboardRepo: any;
  let keyboardService: KeyboardService;

  beforeEach(() => {
    mockCategoryRepo = {
      findActiveByIds: async (ids: string[]) => ids.map((id) => ({ id, isActive: true })),
    };
    mockColorRepo = {
      findByIds: async (ids: string[]) => ids.filter((id) => id !== 'invalid-col-id').map((id) => ({ id })),
    };
    mockStyleRepo = {
      findByIds: async (ids: string[]) => ids.filter((id) => id !== 'invalid-sty-id').map((id) => ({ id })),
    };
    mockKeyboardRepo = {
      findBySlug: async () => null,
      findById: async (id: string) => ({ id, slug: 'sample-theme', status: 'DRAFT' }),
      findManagementById: async (id: string) => ({ id }),
      create: async (data: any) => ({ id: 'theme-123', ...data }),
      update: async (id: string, data: any) => ({ id, ...data }),
      createAuditLog: async () => {},
    };

    keyboardService = new KeyboardService();
    (keyboardService as any).categoryRepository = mockCategoryRepo;
    (keyboardService as any).colorRepository = mockColorRepo;
    (keyboardService as any).styleRepository = mockStyleRepo;
    (keyboardService as any).repository = mockKeyboardRepo;
  });

  it('should reject creating keyboard with non-existent colorIds', async () => {
    await assert.rejects(
      async () =>
        keyboardService.create({
          name: 'Kawaii Sakura',
          coverUrl: 'https://cdn.example.com/cover.webp',
          driveUrl: 'https://drive.google.com/file/d/123/view',
          platform: 'BOTH',
          categoryIds: ['cat-1'],
          colorIds: ['invalid-col-id'],
        }),
      (err: AppError) => {
        assert.equal(err.statusCode, 400);
        assert.equal(err.code, ERROR_CODE.COLOR_NOT_FOUND);
        return true;
      },
    );
  });

  it('should reject creating keyboard with non-existent styleIds', async () => {
    await assert.rejects(
      async () =>
        keyboardService.create({
          name: 'Kawaii Sakura',
          coverUrl: 'https://cdn.example.com/cover.webp',
          driveUrl: 'https://drive.google.com/file/d/123/view',
          platform: 'BOTH',
          categoryIds: ['cat-1'],
          styleIds: ['invalid-sty-id'],
        }),
      (err: AppError) => {
        assert.equal(err.statusCode, 400);
        assert.equal(err.code, ERROR_CODE.STYLE_NOT_FOUND);
        return true;
      },
    );
  });

  it('should create keyboard with valid colorIds and styleIds', async () => {
    const res = await keyboardService.create({
      name: 'Kawaii Sakura',
      coverUrl: 'https://cdn.example.com/cover.webp',
      driveUrl: 'https://drive.google.com/file/d/123/view',
      platform: 'BOTH',
      categoryIds: ['cat-1'],
      colorIds: ['col-1', 'col-2'],
      styleIds: ['sty-1'],
    });
    assert.equal(res.id, 'theme-123');
  });
});
