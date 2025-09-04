# Plumbing Shop Management System

A comprehensive desktop management system for a plumbing supplies store built with Electron, MongoDB, and Mongoose. This application provides complete business management functionality for plumbing supply stores.

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

### Core Business Management
- **Product Management**: Add, edit, delete, and search products with category support
- **Customer Management**: Manage customer information and contact details
- **Invoice System**: Create, edit, and manage invoices with payment tracking
- **Plumber Management**: Track plumber information and assignments
- **Return Invoices**: Handle product returns and refunds with detailed tracking

### Advanced Features
- **Smart Product Suggestions**: Auto-complete product names with database integration
- **Flexible Product Entry**: Add any product to invoices (even if not in database)
- **Product Numbering**: Sequential numbering (#1, #2, #3) for easy reference
- **Brand-Specific Discounts**: Automatic discounts for "BR" and "ابوغالي" brands
- **Real-time Calculations**: Live total calculations with discount applications
- **Payment Tracking**: Multiple payment methods with date and note tracking

### System Features
- **Backup & Restore**: Export and import data for backup purposes
- **Low Stock Alerts**: Monitor product inventory levels with reorder notifications
- **Print Functionality**: Print invoices with customizable formatting
- **Database Health Monitoring**: Automatic detection and display of database connectivity issues
- **Modern UI/UX**: Clean, responsive interface with Arabic RTL support
- **Settings Management**: Configurable font sizes and default discount values
- **Search & Filter**: Advanced search capabilities across all data

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

### Environment Configuration

Create a `.env` file in the root directory with the following variables. You can choose one or both database connections based on your needs:

```env
# Option 1: Local MongoDB Connection
MONGODB_URI=mongodb://localhost:27017/plumbing_shop

# Option 2: MongoDB Atlas Cloud Connection
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/database_name

# Option 3: Both Local and Cloud (for sync between databases)
MONGODB_URI=mongodb://localhost:27017/plumbing_shop
MONGODB_ATLAS_URI=mongodb+srv://username:password@cluster.mongodb.net/database_name
```

**Configuration Options:**

1. **Local MongoDB Only**: Use `MONGODB_URI` with local MongoDB connection
2. **Cloud MongoDB Only**: Use `MONGODB_URI` with MongoDB Atlas connection  
3. **Both Local and Cloud**: Use both `MONGODB_URI` (local) and `MONGODB_ATLAS_URI` (cloud) for data synchronization

**Note**: If you configure both connections, the system will automatically sync data between your local and cloud databases.

#### Getting MongoDB Atlas Connection String:

1. **Create MongoDB Atlas Account**: Go to [MongoDB Atlas](https://www.mongodb.com/atlas)
2. **Create a Cluster**: Choose the free tier (M0) for development
3. **Create Database User**:
   - Go to "Database Access" in your Atlas dashboard
   - Click "Add New Database User"
   - Choose "Password" authentication
   - Create a username and strong password
   - Grant "Read and write to any database" privileges
4. **Whitelist IP Address**:
   - Go to "Network Access" in your Atlas dashboard
   - Click "Add IP Address"
   - Add your current IP or use `0.0.0.0/0` for development (not recommended for production)
5. **Get Connection String**:
   - Go to "Clusters" in your Atlas dashboard
   - Click "Connect" on your cluster
   - Choose "Connect your application"
   - Copy the connection string and replace `<password>` with your database user password
   - Replace `<dbname>` with your database name (e.g., `plumbing_shop`)

#### Example .env file:
```env
MONGODB_URI=mongodb+srv://myuser:mypassword123@cluster0.abc123.mongodb.net/plumbing_shop?retryWrites=true&w=majority
MONGODB_ATLAS_URI=mongodb+srv://myuser:mypassword123@cluster0.abc123.mongodb.net/plumbing_shop?retryWrites=true&w=majority
```

**Important Notes:**
- Replace `myuser` with your actual MongoDB username
- Replace `mypassword123` with your actual MongoDB password
- Replace `cluster0.abc123` with your actual cluster identifier
- Replace `plumbing_shop` with your desired database name
- Keep the connection string secure and never commit it to version control

#### Troubleshooting Environment Setup:

**If you see a database error screen on startup:**
1. **Check your .env file**: Ensure it exists and contains valid connection strings
2. **Verify MongoDB Atlas cluster**: Make sure your cluster is running and accessible
3. **Check network access**: Ensure your IP address is whitelisted in MongoDB Atlas
4. **Test connection string**: Try connecting to your database using MongoDB Compass or similar tool
5. **Check credentials**: Verify your username and password are correct

**Common Environment Issues:**
- **Missing .env file**: Create the file in the root directory (same level as package.json)
- **Invalid connection string**: Check for typos in username, password, or cluster URL
- **Network access denied**: Add your IP address to MongoDB Atlas Network Access list
- **Authentication failed**: Verify your database user has proper permissions

4. Start the application:
   ```bash
   npm start
   ```

## Development

- **Start in development mode**: `npm run dev`
- **Build for production**: `npm run build`
- **Create distribution**: `npm run dist`

## Database

The application uses MongoDB with Mongoose ODM. It supports both local MongoDB instances and MongoDB Atlas cloud database with automatic failover and health monitoring.

### Database Features
- **Dual Database Support**: Local and cloud database connections
- **Automatic Failover**: Seamless switching between database connections
- **Health Monitoring**: Real-time database connectivity monitoring
- **Error Handling**: Comprehensive error display when databases are unavailable
- **Data Synchronization**: Background sync between local and cloud databases

### Models

- **Product**: Product information, pricing, inventory, and category management
- **Customer**: Customer contact information and purchase history
- **Invoice**: Sales invoices with items, payments, and discount tracking
- **Plumber**: Plumber information and job assignments
- **ReturnInvoice**: Product return records with detailed tracking
- **Counter**: Auto-incrementing counters for invoice numbers

## API

The application uses Electron's IPC (Inter-Process Communication) for communication between the main and renderer processes. All database operations are handled through service layers with comprehensive error handling.

### Key Services

- **ProductService**: Product CRUD operations, inventory management, and search functionality
- **CustomerService**: Customer management, search, and contact tracking
- **InvoiceService**: Invoice creation, payment tracking, return management, and reporting
- **PlumberService**: Plumber management and assignment tracking
- **SyncService**: Database synchronization between local and cloud instances
- **BackupService**: Data export/import and backup management

## Configuration

Configuration files are located in the `config/` directory:

- `database.js`: Database connection settings
- `electron.js`: Electron application configuration

## Scripts

Utility scripts are located in the `scripts/` directory:

- `test.js`: Database connection testing
- `check-atlas-data.js`: Atlas database verification
- `seed.js`: Database seeding (if available)

## User Interface

### Modern Design System
- **Arabic RTL Support**: Full right-to-left layout support for Arabic text
- **Responsive Design**: Adapts to different screen sizes and resolutions
- **Custom Scrollbars**: Styled scrollbars for better visual consistency
- **Glass Morphism Effects**: Modern UI elements with backdrop blur effects
- **Color-coded Actions**: Different colors for different action types (edit, delete, view, etc.)

### User Experience Features
- **Auto-scroll**: Automatic scrolling to return forms when creating returns
- **Loading States**: Visual feedback during database operations
- **Error Handling**: User-friendly error messages with actionable solutions
- **Keyboard Navigation**: Full keyboard support for accessibility
- **Font Size Control**: Adjustable font sizes for better readability

### Invoice Management
- **Product Numbering**: Sequential numbering (#1, #2, #3) for easy product reference
- **Smart Suggestions**: Auto-complete product names with database integration
- **Flexible Entry**: Add any product name to invoices (database-independent)
- **Real-time Calculations**: Live updates of totals, discounts, and remaining amounts
- **Brand Discounts**: Automatic application of brand-specific discounts

## Building

The application is built using electron-builder with the following targets:

- **Windows**: NSIS installer
- **Linux**: AppImage
- **macOS**: DMG

## Troubleshooting

### Database Connection Issues

If you encounter the database error screen:

1. **Check Internet Connection**: Ensure you have a stable internet connection
2. **Restart Application**: Close and reopen the application
3. **Verify Environment Variables**: Check that your `.env` file contains valid MongoDB connection strings
4. **Check MongoDB Atlas**: Verify that your MongoDB Atlas cluster is running and accessible
5. **Contact Support**: If issues persist, contact technical support

### Common Issues

- **Products not saving**: Check database connectivity and ensure proper permissions
- **Print function not working**: Verify printer drivers and system permissions
- **Slow performance**: Check database connection and system resources
- **Font size not applying**: Clear browser cache and restart the application

## License

MIT License - see LICENSE file for details.

## Author

Mohamed Ezz - 7mohamedezz@gmail.com