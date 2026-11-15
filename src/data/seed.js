const mongoose = require('mongoose');
const dotenv = require('dotenv');
const fs = require('fs');
const path = require('path');
const Product = require('../models/productModel');

dotenv.config();

const sampleProducts = JSON.parse(
  fs.readFileSync(path.join(__dirname, 'sampleProducts.json'), 'utf-8')
);

const seedDatabase = async () => {
  try {
    await mongoose.connect(process.env.MONGO_URI);
    console.log('MongoDB Connected for Seeding...');

    // Clear existing products
    await Product.deleteMany({});
    console.log('Existing products cleared.');

    if (process.argv[2] === '-d' || process.argv[2] === '--destroy') {
      console.log('Data successfully destroyed.');
      process.exit(0);
    }

    // Insert sample products
    const inserted = await Product.create(sampleProducts);
    console.log(`Successfully seeded ${inserted.length} products into the database.`);
    process.exit(0);
  } catch (error) {
    console.error(`Error with data seeding: ${error.message}`);
    process.exit(1);
  }
};

seedDatabase();
