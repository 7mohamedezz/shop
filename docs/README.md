# Plumbing Shop Management System

A desktop management system for a plumbing supplies store built with Electron, MongoDB, and Mongoose.

## Project Structure

```
📁 shop/
├── 📁 src/                          # Main source code
│   ├── 📁 main/                     # Main process files
│   │   ├── main.js                  # Main Electron process
│   │   └── preload.js               # Preload script
│   ├── 📁 renderer/                 # Renderer process files
│   │   ├── index.html
│   │   ├── renderer.js
│   │   ├── edit-invoice.js
│   │   └── styles.css
│   ├── 📁 models/                   # Database models
│   │   ├── Counter.js
│   │   ├── Customer.js
│   │   ├── Invoice.js
│   │   ├── Plumber.js
│   │   ├── Product.js
│   │   └── ReturnInvoice.js
│   ├── 📁 services/                 # Business logic services
│   │   ├── customerService.js
│   │   ├── invoiceService.js
│   │   ├── plumberService.js
│   │   ├── productService.js
│   │   └── syncService.js
│   ├── 📁 database/                 # Database related files
│   │   └── db.js
│   └── 📁 utils/                    # Utility functions
│       └── objectIdUtils.js
├── 📁 config/                       # Configuration files
│   ├── database.js
│   └── electron.js
├── 📁 scripts/                      # Utility scripts
│   ├── test.js
│   ├── check-atlas-data.js
│   └── seed.js
├── 📁 assets/                       # Static assets
│   └── logo.png
├── 📁 docs/                         # Documentation
│   └── README.md
├── package.json
├── package-lock.json
└── .env.example
```

## Features

- **Product Management**: Add, edit, delete, and search products
- **Customer Management**: Manage customer information and contact details
- **Invoice System**: Create, edit, and manage invoices with payment tracking
- **Plumber Management**: Track plumber information and assignments
- **Return Invoices**: Handle product returns and refunds
- **Backup & Restore**: Export and import data for backup purposes
- **Low Stock Alerts**: Monitor product inventory levels
- **Print Functionality**: Print invoices with customizable formatting

## Installation

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```

3. Set up environment variables:
   ```bash
   cp .env.example .env
   # Edit .env with your MongoDB connection strings
   ```

4. Start the application:
   ```bash
   npm start
   ```

## Development

- **Start in development mode**: `npm run dev`
- **Build for production**: `npm run build`
- **Create distribution**: `npm run dist`

## Database

The application uses MongoDB with Mongoose ODM. It supports both local MongoDB instances and MongoDB Atlas cloud database.

### Models

- **Product**: Product information, pricing, and inventory
- **Customer**: Customer contact information and history
- **Invoice**: Sales invoices with items and payments
- **Plumber**: Plumber information and assignments
- **ReturnInvoice**: Product return records
- **Counter**: Auto-incrementing counters for invoice numbers

## API

The application uses Electron's IPC (Inter-Process Communication) for communication between the main and renderer processes. All database operations are handled through service layers.

### Key Services

- **ProductService**: Product CRUD operations and inventory management
- **CustomerService**: Customer management and search
- **InvoiceService**: Invoice creation, payment tracking, and reporting
- **PlumberService**: Plumber management
- **SyncService**: Database synchronization between local and cloud

## Configuration

Configuration files are located in the `config/` directory:

- `database.js`: Database connection settings
- `electron.js`: Electron application configuration

## Scripts

Utility scripts are located in the `scripts/` directory:

- `test.js`: Database connection testing
- `check-atlas-data.js`: Atlas database verification
- `seed.js`: Database seeding (if available)

## Building

The application is built using electron-builder with the following targets:

- **Windows**: NSIS installer
- **Linux**: AppImage
- **macOS**: DMG

## License

MIT License - see LICENSE file for details.

## Author

Mohamed Ezz - 7mohamedezz@gmail.com