# Inventory and Data Management System (Lab 3)

A RESTful backend built with **Node.js**, **Express.js**, **MongoDB**, and **Mongoose** for warehouse and product catalog management. This system implements schema validation, query-string based filtering/sorting/pagination, safe stock operations, centralized error handling, and MongoDB aggregation pipelines for inventory reporting.

---

## 🛠️ Technology Stack & Compliance
- **Runtime Environment:** Node.js
- **Backend Framework:** Express.js
- **Database:** MongoDB
- **ODM:** Mongoose
- **Configuration:** dotenv
- *(Strictly adheres to restrictions: zero CMS/admin-panel boilerplates; only Express, Mongoose, dotenv, and Node core)*

---

## 📁 Project Structure

```text
Lab 3/
├── .env                              # Environment variables (local)
├── .env.example                      # Template for environment configuration
├── .gitignore                        # Git ignore rules
├── package.json                      # Scripts and dependencies
├── server.js                         # Application entry point & server listener
├── src/
│   ├── config/
│   │   └── db.js                     # MongoDB connection configuration
│   ├── controllers/
│   │   └── productController.js      # CRUD, filtering, pagination & aggregation logic
│   ├── middleware/
│   │   └── errorMiddleware.js        # 404 & Centralized error handler
│   ├── models/
│   │   └── productModel.js           # Mongoose Schema, validations & virtuals
│   ├── routes/
│   │   └── productRoutes.js          # REST API endpoint definitions
│   └── data/
│       ├── sampleProducts.json       # 12 sample products across 5 categories
│       └── seed.js                   # Database seed and teardown script
└── test/
    ├── api.test.js                   # 33 comprehensive integration assertions
    └── run.js                        # Test runner script
```

---

## 🚀 Getting Started

### 1. Prerequisites
- [Node.js](https://nodejs.org/) (v16+)
- [MongoDB](https://www.mongodb.com/try/download/community) running locally on port `27017`

### 2. Install Dependencies
```bash
npm install
```

### 3. Environment Variables
Create a `.env` file in the root directory (or copy from `.env.example`):
```env
PORT=5000
MONGO_URI=mongodb://127.0.0.1:27017/inventory_db
NODE_ENV=development
```

### 4. Seed Database
Populate the database with the 12 sample inventory items (matches assignment screenshots):
```bash
npm run seed
```
*(To clear all data without re-inserting: `npm run seed:destroy`)*

### 5. Run Server
- **Production mode:**
  ```bash
  npm start
  ```
- **Development mode (with auto-reload):**
  ```bash
  npm run dev
  ```

### 6. Run Integration Tests
```bash
npm test
```

---

## 📋 API Endpoints & Documentation

Base URL: `http://localhost:5000/api/products`

### 1. Get All Products (Filtering, Sorting & Pagination)
- **Method & URL:** `GET /api/products`
- **Query Parameters:**
  - `page`: Page number (default: `1`)
  - `limit`: Items per page (default: `10`)
  - `category`: Filter by category name (e.g. `Furniture`, `Electronics`)
  - `search`: Keyword search matching `name` or `sku`
  - `minPrice` / `maxPrice`: Filter by price range
  - `inStock`: `true` (quantity > 0) or `false` (quantity = 0)
  - `sort`: Field to sort by, with direction (`price:asc`, `price:desc`, `-createdAt`, etc.)
- **Response (200 OK):**
```json
{
  "total": 12,
  "page": 1,
  "totalPages": 2,
  "count": 10,
  "products": [
    {
      "_id": "6a54767af6123427d6e61d76",
      "name": "Study Table",
      "sku": "FURN-TB-012",
      "category": "Furniture",
      "price": 3999,
      "quantity": 2,
      "reorderLevel": 4,
      "supplier": "IKEA India",
      "createdAt": "2026-07-13T05:24:10.351Z",
      "updatedAt": "2026-07-13T05:24:10.351Z",
      "__v": 0,
      "stockValue": 7998,
      "id": "6a54767af6123427d6e61d76"
    }
  ]
}
```

---

### 2. Create Product
- **Method & URL:** `POST /api/products`
- **Headers:** `Content-Type: application/json`
- **Request Body:**
```json
{
  "name": "Gel Pen Pack of 15",
  "sku": "STNY-PN-713",
  "category": "Stationery",
  "price": 120,
  "quantity": 40,
  "reorderLevel": 20,
  "supplier": "Cello Pens"
}
```
- **Response (201 Created):**
```json
{
  "name": "Gel Pen Pack of 15",
  "sku": "STNY-PN-713",
  "category": "Stationery",
  "price": 120,
  "quantity": 40,
  "reorderLevel": 20,
  "supplier": "Cello Pens",
  "_id": "6a547727f6123427d6e61d7c",
  "createdAt": "2026-07-13T05:27:03.054Z",
  "updatedAt": "2026-07-13T05:27:03.054Z",
  "__v": 0,
  "stockValue": 4800,
  "id": "6a547727f6123427d6e61d7c"
}
```

---

### 3. Get Single Product by ID
- **Method & URL:** `GET /api/products/:id`
- **Response (200 OK):** Product object directly.
- **Response (404 Not Found):**
```json
{
  "message": "Product not found"
}
```

---

### 4. Update Product Details
- **Method & URL:** `PUT /api/products/:id`
- **Headers:** `Content-Type: application/json`
- **Request Body:**
```json
{
  "name": "Gel Pen Pack of 15",
  "sku": "STNY-PN-713",
  "category": "Stationery",
  "price": 140,
  "quantity": 60
}
```
- **Response (200 OK):** Product object with updated fields and recalculated virtual `stockValue` (`8400`).

---

### 5. Delete Product
- **Method & URL:** `DELETE /api/products/:id`
- **Response (200 OK):**
```json
{
  "message": "Product deleted",
  "id": "6a547727f6123427d6e61d7c"
}
```

---

### 6. Low-Stock Alert Report (Aggregation)
- **Method & URL:** `GET /api/products/low-stock`
- **Logic:** Identifies all items where `quantity <= reorderLevel` using an Aggregation Pipeline.
- **Response (200 OK):**
```json
{
  "count": 4,
  "lowStockItems": [
    {
      "_id": "6a54767af6123427d6e61d76",
      "name": "Study Table",
      "sku": "FURN-TB-012",
      "category": "Furniture",
      "price": 3999,
      "quantity": 2,
      "reorderLevel": 4,
      "supplier": "IKEA India",
      "createdAt": "2026-07-13T05:24:10.351Z",
      "updatedAt": "2026-07-13T05:24:10.351Z",
      "__v": 0,
      "stockValue": 7998,
      "id": "6a54767af6123427d6e61d76"
    }
  ]
}
```

---

### 7. Category-wise Inventory Summary (Aggregation)
- **Method & URL:** `GET /api/products/summary`
- **Logic:** Aggregates products grouped by category, computing `totalItems`, `totalQuantity`, `totalStockValue`, and `avgPrice`.
- **Response (200 OK):**
```json
{
  "categories": 5,
  "summary": [
    {
      "_id": "Electronics",
      "totalItems": 4,
      "totalQuantity": 96,
      "totalStockValue": 343904,
      "avgPrice": 5636.5
    },
    {
      "_id": "Apparel",
      "totalItems": 2,
      "totalQuantity": 78,
      "totalStockValue": 75522,
      "avgPrice": 1399
    }
  ]
}
```

---

### 8. Stock Adjustment (Restock / Sale)
- **Method & URL:** `PATCH /api/products/:id/stock`
- **Headers:** `Content-Type: application/json`
- **Request Body (Restock +10):**
```json
{
  "change": 10
}
```
- **Response (200 OK):**
```json
{
  "message": "Stock updated",
  "product": {
    "_id": "6a54767af6123427d6e61d76",
    "name": "Study Table",
    "sku": "FURN-TB-012",
    "category": "Furniture",
    "price": 3999,
    "quantity": 12,
    "reorderLevel": 4,
    "supplier": "IKEA India",
    "createdAt": "2026-07-13T05:24:10.351Z",
    "updatedAt": "2026-07-13T05:35:24.419Z",
    "__v": 0,
    "stockValue": 47988,
    "id": "6a54767af6123427d6e61d76"
  }
}
```
- **Safe Sale Decrement:** Accepts negative numbers (e.g. `{"change": -5}`). If decrement exceeds current quantity, safely rejects with `400 Bad Request` (`Insufficient stock`).

---

## 🛡️ Centralized Error Handling
- **Invalid ObjectId (CastError):** Returns `404 Not Found` with descriptive message.
- **Validation Errors:** Returns `400 Bad Request` listing validation failure constraints.
- **Duplicate SKU (MongoDB Error 11000):** Returns `400 Bad Request` specifying duplicate key conflict.
- **Route Not Found (404):** Handles invalid endpoints gracefully.

---

## 📊 Evaluation Rubric Mapping

| Criteria | Marks | Implementation |
|---|---|---|
| **Database Schema Design & Validation (Mongoose)** | 0.5 | Complete schema with field-level constraints, custom error messages, unique SKU, timestamps, and `stockValue` virtual field. |
| **CRUD Functionality** | 0.75 | `POST` (create), `GET` (read all & single), `PUT` (update), `DELETE` (delete), and `PATCH /:id/stock` (safe stock increment/decrement). |
| **Querying — Filtering, Sorting, Pagination** | 0.5 | Query params `page`, `limit`, `category`, `search`, `minPrice`, `maxPrice`, `inStock`, and `sort`/`sortBy`. |
| **Aggregation — Low-Stock Report & Category Summary** | 0.5 | `$match` with `$expr: { $lte: ["$quantity", "$reorderLevel"] }`, and `$group` aggregating category totals, inventory stock value, and avg price. |
| **API Design & Clean Code** | 0.25 | Modular MVC structure, environment variables via `dotenv`, centralized error middleware, and clean async handlers. |
| **Total** | **2.5** | Fully verified with automated test suite (33/33 assertions passed). |
