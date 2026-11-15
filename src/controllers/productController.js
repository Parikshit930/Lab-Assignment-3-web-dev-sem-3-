const Product = require('../models/productModel');

// Utility wrapper to catch errors in async route handlers
const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

/**
 * @desc    Get all products with filtering, sorting, and pagination
 * @route   GET /api/products
 * @access  Public
 */
const getProducts = asyncHandler(async (req, res) => {
  const page = Math.max(1, parseInt(req.query.page, 10) || 1);
  const limit = Math.max(1, parseInt(req.query.limit, 10) || 10);
  const skip = (page - 1) * limit;

  // Build filter object
  const filter = {};

  // Search by name or SKU (case-insensitive)
  if (req.query.search) {
    const searchRegex = new RegExp(req.query.search.trim(), 'i');
    filter.$or = [{ name: searchRegex }, { sku: searchRegex }];
  }

  // Filter by category (case-insensitive)
  if (req.query.category) {
    filter.category = new RegExp(`^${req.query.category.trim()}$`, 'i');
  }

  // Filter by supplier (case-insensitive)
  if (req.query.supplier) {
    filter.supplier = new RegExp(req.query.supplier.trim(), 'i');
  }

  // Filter by price range
  if (req.query.minPrice !== undefined || req.query.maxPrice !== undefined) {
    filter.price = {};
    if (req.query.minPrice !== undefined && req.query.minPrice !== '') {
      filter.price.$gte = Number(req.query.minPrice);
    }
    if (req.query.maxPrice !== undefined && req.query.maxPrice !== '') {
      filter.price.$lte = Number(req.query.maxPrice);
    }
  }

  // Filter by stock availability
  if (req.query.inStock !== undefined) {
    if (req.query.inStock === 'true') {
      filter.quantity = { $gt: 0 };
    } else if (req.query.inStock === 'false') {
      filter.quantity = { $lte: 0 };
    }
  }

  // Build sorting option
  let sortOption = { createdAt: -1 };
  if (req.query.sort || req.query.sortBy) {
    const sortParam = (req.query.sort || req.query.sortBy).toString();
    if (sortParam.includes(':')) {
      const [field, direction] = sortParam.split(':');
      sortOption = { [field]: direction.toLowerCase() === 'desc' ? -1 : 1 };
    } else if (sortParam.startsWith('-')) {
      sortOption = { [sortParam.substring(1)]: -1 };
    } else {
      sortOption = { [sortParam]: 1 };
    }
  }

  const total = await Product.countDocuments(filter);
  const products = await Product.find(filter)
    .sort(sortOption)
    .skip(skip)
    .limit(limit);

  const totalPages = Math.ceil(total / limit) || 1;

  res.status(200).json({
    total,
    page,
    totalPages,
    count: products.length,
    products
  });
});

/**
 * @desc    Create a new product
 * @route   POST /api/products
 * @access  Public
 */
const createProduct = asyncHandler(async (req, res) => {
  const { name, sku, category, price, quantity, reorderLevel, supplier } = req.body;

  const product = await Product.create({
    name,
    sku,
    category,
    price,
    quantity,
    reorderLevel,
    supplier
  });

  res.status(201).json(product);
});

/**
 * @desc    Get low-stock products (quantity <= reorderLevel) using Aggregation
 * @route   GET /api/products/low-stock
 * @access  Public
 */
const getLowStockProducts = asyncHandler(async (req, res) => {
  const lowStockItems = await Product.aggregate([
    {
      $match: {
        $expr: { $lte: ['$quantity', '$reorderLevel'] }
      }
    },
    {
      $addFields: {
        stockValue: { $multiply: ['$price', '$quantity'] },
        id: { $toString: '$_id' }
      }
    },
    {
      $sort: { quantity: 1 }
    }
  ]);

  res.status(200).json({
    count: lowStockItems.length,
    lowStockItems
  });
});

/**
 * @desc    Get category-wise inventory summary using Aggregation
 * @route   GET /api/products/summary
 * @access  Public
 */
const getCategorySummary = asyncHandler(async (req, res) => {
  const summary = await Product.aggregate([
    {
      $group: {
        _id: '$category',
        totalItems: { $sum: 1 },
        totalQuantity: { $sum: '$quantity' },
        totalStockValue: { $sum: { $multiply: ['$price', '$quantity'] } },
        avgPrice: { $avg: '$price' }
      }
    },
    {
      $project: {
        _id: 1,
        totalItems: 1,
        totalQuantity: 1,
        totalStockValue: 1,
        avgPrice: { $round: ['$avgPrice', 2] }
      }
    },
    {
      $sort: { totalStockValue: -1 }
    }
  ]);

  res.status(200).json({
    categories: summary.length,
    summary
  });
});

/**
 * @desc    Get single product by ID
 * @route   GET /api/products/:id
 * @access  Public
 */
const getProductById = asyncHandler(async (req, res) => {
  const product = await Product.findById(req.params.id);

  if (!product) {
    res.status(404);
    throw new Error('Product not found');
  }

  res.status(200).json(product);
});

/**
 * @desc    Update product details
 * @route   PUT /api/products/:id
 * @access  Public
 */
const updateProduct = asyncHandler(async (req, res) => {
  const product = await Product.findByIdAndUpdate(req.params.id, req.body, {
    returnDocument: 'after',
    runValidators: true
  });

  if (!product) {
    res.status(404);
    throw new Error('Product not found');
  }

  res.status(200).json(product);
});

/**
 * @desc    Delete a product
 * @route   DELETE /api/products/:id
 * @access  Public
 */
const deleteProduct = asyncHandler(async (req, res) => {
  const product = await Product.findByIdAndDelete(req.params.id);

  if (!product) {
    res.status(404);
    throw new Error('Product not found');
  }

  res.status(200).json({
    message: 'Product deleted',
    id: req.params.id
  });
});

/**
 * @desc    Safely adjust stock (restock or sale)
 * @route   PATCH /api/products/:id/stock
 * @access  Public
 */
const adjustStock = asyncHandler(async (req, res) => {
  const { change } = req.body;

  if (typeof change !== 'number' || isNaN(change)) {
    res.status(400);
    throw new Error('Stock change must be a valid number');
  }

  const product = await Product.findById(req.params.id);

  if (!product) {
    res.status(404);
    throw new Error('Product not found');
  }

  // Prevent stock from going below 0
  if (product.quantity + change < 0) {
    res.status(400);
    throw new Error(
      `Insufficient stock. Current quantity is ${product.quantity}, cannot reduce by ${Math.abs(change)}`
    );
  }

  product.quantity += change;
  await product.save();

  res.status(200).json({
    message: 'Stock updated',
    product
  });
});

module.exports = {
  getProducts,
  createProduct,
  getLowStockProducts,
  getCategorySummary,
  getProductById,
  updateProduct,
  deleteProduct,
  adjustStock
};
