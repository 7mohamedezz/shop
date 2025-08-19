require('dotenv').config();

const { connectLocalDb, getLocalModels } = require('../services/db');
const invoiceService = require('../services/invoiceService');

function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pad(n, w = 3) {
  return String(n).padStart(w, '0');
}

async function seed() {
  const uri = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/plumbing_shop';
  console.log('🔌 Connecting to DB:', uri);
  await connectLocalDb(uri);
  const { Customer, Plumber, Product } = getLocalModels();

  // Create 100 customers
  console.log('👤 Seeding customers...');
  const customers = [];
  for (let i = 1; i <= 100; i++) {
    customers.push({ name: `عميل ${pad(i, 3)}`, phone: `0100${pad(i, 3)}${pad(i, 3)}` });
  }
  const customerDocs = await Customer.insertMany(customers, { ordered: false }).catch(async (e) => {
    console.warn('Customer insert warnings:', e?.writeErrors?.length || e.message);
    // Fetch existing if duplicates due to re-run
    return await Customer.find({}).limit(100);
  });
  console.log('✅ Customers ready:', Array.isArray(customerDocs) ? customerDocs.length : (await Customer.countDocuments()));

  // Create 100 plumbers
  console.log('🛠️  Seeding plumbers...');
  const plumbers = [];
  for (let i = 1; i <= 100; i++) {
    plumbers.push({ name: `سباك ${pad(i, 3)}`, phone: `0111${pad(i, 3)}${pad(i, 3)}` });
  }
  const plumberDocs = await Plumber.insertMany(plumbers, { ordered: false }).catch(async (e) => {
    console.warn('Plumber insert warnings:', e?.writeErrors?.length || e.message);
    return await Plumber.find({}).limit(100);
  });
  console.log('✅ Plumbers ready:', Array.isArray(plumberDocs) ? plumberDocs.length : (await Plumber.countDocuments()));

  // Create 100 products
  console.log('📦 Seeding products...');
  const categories = ['ابوغالي', 'br', 'عام'];
  const products = [];
  for (let i = 1; i <= 100; i++) {
    const buying = randInt(10, 500);
    const sell = Number((buying * (1 + Math.random() * 0.6 + 0.1)).toFixed(2));
    products.push({
      name: `منتج-${pad(i, 3)}`,
      category: categories[randInt(0, categories.length - 1)],
      buyingPrice: buying,
      sellingPrice: sell,
      stock: randInt(500, 2000) // high stock to tolerate invoice decrements
    });
  }
  const productDocs = await Product.insertMany(products, { ordered: false }).catch(async (e) => {
    console.warn('Product insert warnings:', e?.writeErrors?.length || e.message);
    return await Product.find({}).limit(100);
  });
  const allProducts = Array.isArray(productDocs) ? productDocs : await Product.find({}).limit(100);
  console.log('✅ Products ready:', allProducts.length);

  // Build plumber names list for invoices
  const plumberNames = (Array.isArray(plumberDocs) ? plumberDocs : await Plumber.find({}).limit(100)).map(p => p.name);

  // Create 100 invoices, each with 100 items
  console.log('🧾 Seeding invoices (100 invoices x 100 items)... This may take a few minutes.');
  for (let invIdx = 1; invIdx <= 100; invIdx++) {
    const cust = Array.isArray(customerDocs) ? customerDocs[randInt(0, customerDocs.length - 1)] : (await Customer.findOne().skip(randInt(0, 99)));
    const plumberName = plumberNames[randInt(0, plumberNames.length - 1)] || '';

    // Pick 100 items (allow duplicates for variability)
    const items = [];
    for (let i = 0; i < 100; i++) {
      const p = allProducts[randInt(0, allProducts.length - 1)];
      const qty = randInt(1, 5);
      items.push({
        product: p._id,
        name: p.name, // for fallback
        category: p.category || '',
        price: p.sellingPrice,
        buyingPrice: p.buyingPrice,
        qty
      });
    }

    // Optional random payments
    const payCount = randInt(0, 3);
    const payments = Array.from({ length: payCount }).map(() => ({
      amount: randInt(50, 2000),
      date: new Date(),
      note: Math.random() < 0.5 ? 'نقدي' : 'شبكة'
    }));

    const payload = {
      customer: { name: cust.name, phone: cust.phone },
      plumberName,
      items,
      payments,
      notes: `فاتورة اختبار ${invIdx}`,
      // Random discount percents to exercise logic
      discountAbogaliPercent: Math.random() < 0.5 ? randInt(5, 20) : 0,
      discountBrPercent: Math.random() < 0.5 ? randInt(5, 20) : 0
    };

    try {
      await invoiceService.createInvoice(payload);
      if (invIdx % 10 === 0) console.log(`  ✅ Created ${invIdx}/100 invoices`);
    } catch (e) {
      console.error(`  ❌ Failed creating invoice ${invIdx}:`, e.message);
    }
  }

  console.log('🎉 Seeding completed.');
}

seed()
  .then(() => process.exit(0))
  .catch((err) => { console.error('Seed error:', err); process.exit(1); });
