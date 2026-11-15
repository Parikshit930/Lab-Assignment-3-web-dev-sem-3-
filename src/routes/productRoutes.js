const express = require('express');
const router = express.Router();

const {
  getProducts,
  createProduct,
  getLowStockProducts,
  getCategorySummary,
  getProductById,
  updateProduct,
  deleteProduct,
  adjustStock
} = require('../controllers/productController');

// Main collection routes
router.route('/')
  .get(getProducts)
  .post(createProduct);

// Aggregation & Report routes (Must be defined BEFORE /:id)
router.route('/low-stock').get(getLowStockProducts);
router.route('/summary').get(getCategorySummary);

// Single item routes
router.route('/:id')
  .get(getProductById)
  .put(updateProduct)
  .delete(deleteProduct);

// Stock adjustment route
router.route('/:id/stock').patch(adjustStock);

module.exports = router;
