const { connectLocalDb, getLocalModels } = require('./services/db');
const invoiceService = require('./services/invoiceService');
require('dotenv').config();

async function checkAtlasData() {
  try {
    console.log('Checking Atlas database data...');
    await connectLocalDb(process.env.MONGODB_URI);

    const { Invoice, Customer, Product } = getLocalModels();

    // Check existing data
    const invoices = await Invoice.find().lean();
    const customers = await Customer.find().lean();
    const products = await Product.find().lean();

    console.log('Invoices:', invoices.length);
    console.log('Customers:', customers.length);
    console.log('Products:', products.length);

    if (invoices.length === 0) {
      console.log('Creating test data in Atlas...');

      // Create test data
      const customer = await Customer.create({
        name: 'أحمد محمد',
        phone: '01234567890'
      });

      const product = await Product.create({
        name: 'أنبوب PVC',
        category: 'ابوغالي',
        buyingPrice: 10,
        sellingPrice: 15,
        stock: 100
      });

      const invoiceData = {
        customer: { name: customer.name, phone: customer.phone },
        plumberName: 'محمد السباك',
        items: [
          {
            product: product._id,
            name: product.name,
            category: product.category,
            qty: 2,
            price: product.sellingPrice,
            buyingPrice: product.buyingPrice
          }
        ],
        payments: [
          {
            amount: 20,
            date: new Date(),
            note: 'دفعة أولى'
          }
        ],
        notes: 'فاتورة تجريبية',
        discountAbogaliPercent: 0,
        discountBrPercent: 0
      };

      const invoice = await invoiceService.createInvoice(invoiceData);
      console.log('✅ Created test invoice in Atlas:', invoice._id);
    } else {
      console.log('✅ Atlas database has data');
      invoices.forEach(inv => {
        console.log(`Invoice: ${inv._id} - Customer: ${inv.customer?.name || 'N/A'}`);
      });
    }
  } catch (error) {
    console.error('❌ Error:', error);
  }

  process.exit(0);
}

checkAtlasData();
