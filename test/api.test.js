const http = require('http');

function request(options, data = null) {
  return new Promise((resolve, reject) => {
    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => (body += chunk));
      res.on('end', () => {
        try {
          const parsed = JSON.parse(body);
          resolve({ status: res.statusCode, headers: res.headers, body: parsed });
        } catch {
          resolve({ status: res.statusCode, headers: res.headers, body });
        }
      });
    });

    req.on('error', reject);

    if (data) {
      req.write(typeof data === 'string' ? data : JSON.stringify(data));
    }
    req.end();
  });
}

async function runTests() {
  console.log('--- Starting API Integration Tests ---\n');
  let passed = 0;
  let failed = 0;

  function assert(desc, condition, details = '') {
    if (condition) {
      console.log(`✅ PASS: ${desc}`);
      passed++;
    } else {
      console.error(`❌ FAIL: ${desc} ${details ? `(${details})` : ''}`);
      failed++;
    }
  }

  try {
    // 1. Health check
    const health = await request({ host: '127.0.0.1', port: 5000, path: '/', method: 'GET' });
    assert('Health Check Endpoint', health.status === 200 && health.body.status === 'online');

    // 2. Get Products (Default Pagination: page 1, limit 10)
    const listRes = await request({ host: '127.0.0.1', port: 5000, path: '/api/products', method: 'GET' });
    assert('GET /api/products returns 200', listRes.status === 200);
    assert('Pagination total is 12', listRes.body.total === 12, `got ${listRes.body.total}`);
    assert('Pagination page is 1', listRes.body.page === 1);
    assert('Pagination totalPages is 2', listRes.body.totalPages === 2);
    assert('Pagination count is 10', listRes.body.count === 10);
    assert('Product includes virtual stockValue', typeof listRes.body.products[0].stockValue === 'number');

    // 3. Category Filter
    const catRes = await request({ host: '127.0.0.1', port: 5000, path: '/api/products?category=Furniture', method: 'GET' });
    assert('Category Filter /api/products?category=Furniture', catRes.status === 200 && catRes.body.total === 3);

    // 4. Search Filter
    const searchRes = await request({ host: '127.0.0.1', port: 5000, path: '/api/products?search=Keyboard', method: 'GET' });
    assert('Search Filter /api/products?search=Keyboard', searchRes.status === 200 && searchRes.body.total === 1);

    // 5. Price Range Filter
    const priceRes = await request({ host: '127.0.0.1', port: 5000, path: '/api/products?minPrice=5000&maxPrice=10000', method: 'GET' });
    assert('Price Range Filter /api/products?minPrice=5000&maxPrice=10000', priceRes.status === 200 && priceRes.body.total === 2);

    // 6. Sorting
    const sortRes = await request({ host: '127.0.0.1', port: 5000, path: '/api/products?sort=price:desc', method: 'GET' });
    assert('Sorting /api/products?sort=price:desc', sortRes.status === 200 && sortRes.body.products[0].price >= sortRes.body.products[1].price);

    // 7. Low Stock Aggregation Report
    const lowStockRes = await request({ host: '127.0.0.1', port: 5000, path: '/api/products/low-stock', method: 'GET' });
    assert('GET /api/products/low-stock returns 200', lowStockRes.status === 200);
    assert('Low stock count is 4', lowStockRes.body.count === 4, `got ${lowStockRes.body.count}`);
    assert('All low stock items have quantity <= reorderLevel',
      lowStockRes.body.lowStockItems.every(item => item.quantity <= item.reorderLevel));

    // 8. Category Summary Aggregation Report
    const summaryRes = await request({ host: '127.0.0.1', port: 5000, path: '/api/products/summary', method: 'GET' });
    assert('GET /api/products/summary returns 200', summaryRes.status === 200);
    assert('Categories count is 5', summaryRes.body.categories === 5, `got ${summaryRes.body.categories}`);
    assert('Summary has aggregation fields',
      summaryRes.body.summary[0]._id &&
      typeof summaryRes.body.summary[0].totalItems === 'number' &&
      typeof summaryRes.body.summary[0].totalStockValue === 'number' &&
      typeof summaryRes.body.summary[0].avgPrice === 'number');

    // 9. POST Create Product
    const newProductData = {
      name: "Smart LED Desk Lamp",
      sku: "ELEC-LP-999",
      category: "Electronics",
      price: 1899,
      quantity: 20,
      reorderLevel: 5,
      supplier: "Philips Lighting"
    };
    const createRes = await request({
      host: '127.0.0.1',
      port: 5000,
      path: '/api/products',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, newProductData);
    assert('POST /api/products returns 201 Created', createRes.status === 201);
    assert('Created product has correct SKU', createRes.body.sku === 'ELEC-LP-999');
    assert('Created product has virtual stockValue (1899 * 20 = 37980)', createRes.body.stockValue === 37980);
    const createdId = createRes.body._id;

    // 10. GET Single Product by ID
    const singleRes = await request({ host: '127.0.0.1', port: 5000, path: `/api/products/${createdId}`, method: 'GET' });
    assert('GET /api/products/:id returns 200', singleRes.status === 200 && singleRes.body.name === "Smart LED Desk Lamp");

    // 11. PUT Update Product Details
    const updateRes = await request({
      host: '127.0.0.1',
      port: 5000,
      path: `/api/products/${createdId}`,
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' }
    }, { price: 2199, quantity: 25 });
    assert('PUT /api/products/:id returns 200', updateRes.status === 200);
    assert('Price updated to 2199', updateRes.body.price === 2199);
    assert('stockValue updated to 54975', updateRes.body.stockValue === 2199 * 25);

    // 12. PATCH Stock Adjustment (+10)
    const restockRes = await request({
      host: '127.0.0.1',
      port: 5000,
      path: `/api/products/${createdId}/stock`,
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' }
    }, { change: 10 });
    assert('PATCH /api/products/:id/stock restock (+10) returns 200', restockRes.status === 200);
    assert('Quantity incremented from 25 to 35', restockRes.body.product.quantity === 35);

    // 13. PATCH Stock Adjustment (-5 sale)
    const saleRes = await request({
      host: '127.0.0.1',
      port: 5000,
      path: `/api/products/${createdId}/stock`,
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' }
    }, { change: -5 });
    assert('PATCH /api/products/:id/stock sale (-5) returns 200', saleRes.status === 200);
    assert('Quantity decremented from 35 to 30', saleRes.body.product.quantity === 30);

    // 14. PATCH Stock Adjustment (Insufficient stock error)
    const overSaleRes = await request({
      host: '127.0.0.1',
      port: 5000,
      path: `/api/products/${createdId}/stock`,
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' }
    }, { change: -100 });
    assert('PATCH /api/products/:id/stock over-sale returns 400 Bad Request', overSaleRes.status === 400);

    // 15. DELETE Product
    const delRes = await request({ host: '127.0.0.1', port: 5000, path: `/api/products/${createdId}`, method: 'DELETE' });
    assert('DELETE /api/products/:id returns 200', delRes.status === 200 && delRes.body.message === 'Product deleted');

    // 16. Verify Deleted Product returns 404
    const checkDeleted = await request({ host: '127.0.0.1', port: 5000, path: `/api/products/${createdId}`, method: 'GET' });
    assert('GET deleted product returns 404 Not Found', checkDeleted.status === 404);

    // 17. Validation Error test (empty name / missing fields)
    const invalidRes = await request({
      host: '127.0.0.1',
      port: 5000,
      path: '/api/products',
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    }, { name: "" });
    assert('POST invalid product triggers Mongoose ValidationError (400)', invalidRes.status === 400);

    // 18. CastError test (malformed ObjectId)
    const castRes = await request({ host: '127.0.0.1', port: 5000, path: '/api/products/invalid-id-123', method: 'GET' });
    assert('GET invalid ObjectId triggers CastError (404)', castRes.status === 404);

  } catch (err) {
    console.error('Test execution error:', err);
    failed++;
  }

  console.log(`\n--- Test Results: ${passed} passed, ${failed} failed ---`);
  return failed === 0;
}

module.exports = runTests;

if (require.main === module) {
  runTests().then((success) => process.exit(success ? 0 : 1));
}
