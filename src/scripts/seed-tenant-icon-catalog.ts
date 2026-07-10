import 'reflect-metadata';
import '../config/load-env';
import { copyFile, mkdir } from 'fs/promises';
import { extname, join } from 'path';
import { v4 as uuidv4 } from 'uuid';
import { AppDataSource } from '../dataSource/data-source';
import { Tenant } from '../entities/tenant.entity';
import { Category } from '../entities/categories.entity';
import { Product } from '../entities/product.entity';
import { createTenantDataSource } from '../common/database/tenant-data-source.util';

type SeedItem = {
  key: string;
  sourceImage: string;
  categoryName: string;
  categoryDescription: string;
  categoryAliases?: string[];
  productName: string;
  productDescription: string;
  productAliases?: string[];
  price: number;
  quantity: number;
};

type CliOptions = {
  tenantId?: string;
  dryRun: boolean;
};

const ICON_ITEMS: SeedItem[] = [
  {
    key: 'butter',
    sourceImage:
      'C:\\Users\\Pratik\\.cursor\\projects\\c-Users-Pratik-Documents-pratik-IW-Milk-Delivery-SAAS-Backend\\assets\\c__Users_Pratik_AppData_Roaming_Cursor_User_workspaceStorage_256e547a86aaaca583c0ed13966859d7_images_butter-91d0d3c9-749d-4ec1-af44-987e4860670d.png',
    categoryName: 'Butter',
    categoryDescription: 'Rich and creamy butter for daily kitchen use.',
    productName: 'Table Butter',
    productDescription: 'Smooth table butter made for daily meals.',
    price: 68,
    quantity: 100,
  },
  {
    key: 'curd',
    sourceImage:
      'C:\\Users\\Pratik\\.cursor\\projects\\c-Users-Pratik-Documents-pratik-IW-Milk-Delivery-SAAS-Backend\\assets\\c__Users_Pratik_AppData_Roaming_Cursor_User_workspaceStorage_256e547a86aaaca583c0ed13966859d7_images_curd-9d72fdad-ca9a-4bd4-bf3e-5fd73d2d355e.png',
    categoryName: 'Curd',
    categoryDescription: 'Fresh curd prepared for regular family meals.',
    productName: 'Fresh Curd',
    productDescription: 'Thick fresh curd with a clean dairy taste.',
    price: 42,
    quantity: 100,
  },
  {
    key: 'buttermilk',
    sourceImage:
      'C:\\Users\\Pratik\\.cursor\\projects\\c-Users-Pratik-Documents-pratik-IW-Milk-Delivery-SAAS-Backend\\assets\\c__Users_Pratik_AppData_Roaming_Cursor_User_workspaceStorage_256e547a86aaaca583c0ed13966859d7_images_butter_milk-9168671d-9a5c-4e0a-a903-3cdc2e1de6a8.png',
    categoryName: 'Buttermilk',
    categoryDescription: 'Light and refreshing buttermilk for every day.',
    productName: 'Classic Buttermilk',
    productDescription: 'Refreshing buttermilk ideal for daily serving.',
    price: 28,
    quantity: 100,
  },
  {
    key: 'ghee',
    sourceImage:
      'C:\\Users\\Pratik\\.cursor\\projects\\c-Users-Pratik-Documents-pratik-IW-Milk-Delivery-SAAS-Backend\\assets\\c__Users_Pratik_AppData_Roaming_Cursor_User_workspaceStorage_256e547a86aaaca583c0ed13966859d7_images_Ghee-38e48ad6-52af-415b-b62d-4acbee5f6acf.png',
    categoryName: 'Ghee',
    categoryDescription: 'Pure ghee for cooking, sweets, and daily meals.',
    productName: 'Pure Cow Ghee',
    productDescription: 'Aromatic pure ghee for cooking and sweets.',
    price: 349,
    quantity: 100,
  },
  {
    key: 'milk',
    sourceImage:
      'C:\\Users\\Pratik\\.cursor\\projects\\c-Users-Pratik-Documents-pratik-IW-Milk-Delivery-SAAS-Backend\\assets\\c__Users_Pratik_AppData_Roaming_Cursor_User_workspaceStorage_256e547a86aaaca583c0ed13966859d7_images_milk-ba63e48e-f79e-4347-976f-f59445d9121c.png',
    categoryName: 'Milk',
    categoryDescription: 'Fresh milk options for everyday household needs.',
    categoryAliases: ['milk'],
    productName: 'Fresh Milk',
    productDescription: 'Fresh bottled milk for everyday home delivery.',
    productAliases: ['milk', 'milk1'],
    price: 36,
    quantity: 100,
  },
  {
    key: 'more',
    sourceImage:
      'C:\\Users\\Pratik\\.cursor\\projects\\c-Users-Pratik-Documents-pratik-IW-Milk-Delivery-SAAS-Backend\\assets\\c__Users_Pratik_AppData_Roaming_Cursor_User_workspaceStorage_256e547a86aaaca583c0ed13966859d7_images_more-e880b812-4e5f-4577-8709-331eabc37828.png',
    categoryName: 'More',
    categoryDescription: 'Extra dairy and household picks beyond basics.',
    productName: 'More Essentials',
    productDescription: 'Featured essentials collected under more items.',
    price: 99,
    quantity: 100,
  },
  {
    key: 'bread',
    sourceImage:
      'C:\\Users\\Pratik\\.cursor\\projects\\c-Users-Pratik-Documents-pratik-IW-Milk-Delivery-SAAS-Backend\\assets\\c__Users_Pratik_AppData_Roaming_Cursor_User_workspaceStorage_256e547a86aaaca583c0ed13966859d7_images_bread-f58798c9-039c-4f3b-821a-cd6fcb71fc2c.png',
    categoryName: 'Bread',
    categoryDescription: 'Soft bread and bakery staples for daily use.',
    productName: 'Fresh Bread',
    productDescription: 'Soft fresh bread for breakfast and snacks.',
    price: 48,
    quantity: 100,
  },
  {
    key: 'sweets',
    sourceImage:
      'C:\\Users\\Pratik\\.cursor\\projects\\c-Users-Pratik-Documents-pratik-IW-Milk-Delivery-SAAS-Backend\\assets\\c__Users_Pratik_AppData_Roaming_Cursor_User_workspaceStorage_256e547a86aaaca583c0ed13966859d7_images_sweets-2e0c0295-f41d-4145-aa21-de0d0aaddc3e.png',
    categoryName: 'Sweets',
    categoryDescription: 'Traditional milk sweets for gifting and treats.',
    productName: 'Milk Sweets',
    productDescription: 'Traditional milk sweets for festive moments.',
    price: 189,
    quantity: 100,
  },
];

function parseArgs(argv: string[]): CliOptions {
  const options: CliOptions = {
    dryRun: argv.includes('--dry-run'),
  };

  for (const arg of argv) {
    if (arg.startsWith('--tenant-id=')) {
      options.tenantId = arg.split('=')[1];
    }
  }

  return options;
}

function normalize(value?: string | null): string {
  return (value || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '');
}

function buildAliasSet(primary: string, aliases?: string[]): Set<string> {
  return new Set([primary, ...(aliases || [])].map((value) => normalize(value)));
}

async function copySeedImage(
  sourcePath: string,
  targetDir: string,
  prefix: string,
): Promise<string> {
  await mkdir(targetDir, { recursive: true });
  const targetName = `${prefix}-${uuidv4()}${extname(sourcePath) || '.png'}`;
  const targetPath = join(targetDir, targetName);
  await copyFile(sourcePath, targetPath);
  return targetPath.replace(process.cwd(), '').replace(/\\/g, '/');
}

async function run() {
  const options = parseArgs(process.argv.slice(2));
  if (!options.tenantId) {
    throw new Error('Usage: --tenant-id=<uuid> [--dry-run]');
  }

  await AppDataSource.initialize();
  const tenantRepo = AppDataSource.getRepository(Tenant);
  const tenant = await tenantRepo.findOne({ where: { id: options.tenantId } });

  if (!tenant?.dbName) {
    throw new Error(`Tenant ${options.tenantId} not found or has no dbName.`);
  }

  const tenantDs = createTenantDataSource(tenant);
  await tenantDs.initialize();

  try {
    const categoryRepo = tenantDs.getRepository(Category);
    const productRepo = tenantDs.getRepository(Product);
    const existingCategories = await categoryRepo.find();
    const existingProducts = await productRepo.find();

    const plan = ICON_ITEMS.map((item) => {
      const categoryAliases = buildAliasSet(
        item.categoryName,
        item.categoryAliases,
      );
      const productAliases = buildAliasSet(item.productName, item.productAliases);

      const existingCategory =
        existingCategories.find((category) =>
          categoryAliases.has(normalize(category.name)),
        ) || null;

      const existingProduct =
        existingProducts.find((product) =>
          productAliases.has(normalize(product.name)),
        ) || null;

      return {
        key: item.key,
        categoryAction: existingCategory ? 'update' : 'create',
        productAction: existingProduct ? 'update' : 'create',
        existingCategoryId: existingCategory?.id || null,
        existingProductId: existingProduct?.id || null,
        categoryName: item.categoryName,
        productName: item.productName,
      };
    });

    if (options.dryRun) {
      console.log(
        JSON.stringify(
          {
            mode: 'dry-run',
            tenantId: tenant.id,
            tenantDb: tenant.dbName,
            existingCategoryCount: existingCategories.length,
            existingProductCount: existingProducts.length,
            finalCategoryCountEstimate:
              existingCategories.length +
              plan.filter((entry) => entry.categoryAction === 'create').length,
            finalProductCountEstimate:
              existingProducts.length +
              plan.filter((entry) => entry.productAction === 'create').length,
            plan,
          },
          null,
          2,
        ),
      );
      return;
    }

    const categoryUploadDir = join(process.cwd(), 'uploads', 'categories');
    const productUploadDir = join(process.cwd(), 'uploads', 'products');
    const currentCategories = [...existingCategories];
    const currentProducts = [...existingProducts];

    for (const item of ICON_ITEMS) {
      const categoryAliases = buildAliasSet(
        item.categoryName,
        item.categoryAliases,
      );
      const productAliases = buildAliasSet(item.productName, item.productAliases);

      let category =
        currentCategories.find((entry) =>
          categoryAliases.has(normalize(entry.name)),
        ) || null;

      const categoryImage = await copySeedImage(
        item.sourceImage,
        categoryUploadDir,
        `${item.key}-category`,
      );

      if (!category) {
        category = categoryRepo.create({
          tenantId: null,
          name: item.categoryName,
          description: item.categoryDescription,
          image: categoryImage,
          isActive: true,
        });
      } else {
        category.name = item.categoryName;
        category.description = item.categoryDescription;
        category.image = categoryImage;
        category.isActive = true;
      }

      category = await categoryRepo.save(category);
      if (!currentCategories.some((entry) => entry.id === category.id)) {
        currentCategories.push(category);
      }

      let product =
        currentProducts.find((entry) => productAliases.has(normalize(entry.name))) ||
        null;

      const productImage = await copySeedImage(
        item.sourceImage,
        productUploadDir,
        `${item.key}-product`,
      );

      if (!product) {
        product = productRepo.create({
          tenantId: null,
          categoryId: category.id,
          name: item.productName,
          images: [productImage],
          price: item.price,
          quantity: item.quantity,
          remainingQuantity: item.quantity,
          description: item.productDescription,
          isActive: true,
        });
      } else {
        const delta = item.quantity - product.quantity;
        product.categoryId = category.id;
        product.name = item.productName;
        product.images = [productImage];
        product.price = item.price;
        product.quantity = item.quantity;
        product.remainingQuantity = Math.max(
          0,
          (product.remainingQuantity ?? product.quantity) + delta,
        );
        product.description = item.productDescription;
        product.isActive = true;
      }

      product = await productRepo.save(product);
      if (!currentProducts.some((entry) => entry.id === product.id)) {
        currentProducts.push(product);
      }
    }

    const finalCategoryCount = await categoryRepo.count();
    const finalProductCount = await productRepo.count();

    console.log(
      JSON.stringify(
        {
          mode: 'apply',
          tenantId: tenant.id,
          tenantDb: tenant.dbName,
          finalCategoryCount,
          finalProductCount,
        },
        null,
        2,
      ),
    );
  } finally {
    await tenantDs.destroy();
    await AppDataSource.destroy();
  }
}

run().catch(async (error) => {
  console.error(error);
  try {
    if (AppDataSource.isInitialized) {
      await AppDataSource.destroy();
    }
  } catch {
    // noop
  }
  process.exit(1);
});
