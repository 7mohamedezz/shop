# 🏪 Plumbing Shop Management System

A comprehensive desktop application for managing a plumbing supplies store, built with Electron and MongoDB.

## 🎯 Recent Major Improvements

This application has been completely modernized with:

### 🔒 Security Enhancements
- ✅ Removed `ELECTRON_DISABLE_SANDBOX` vulnerability
- ✅ Added comprehensive input validation and sanitization
- ✅ Implemented XSS protection
- ✅ Secured IPC communication channels

### ⚡ Performance Optimizations
- ✅ Virtual scrolling for large lists
- ✅ Smart caching system with TTL
- ✅ Request deduplication
- ✅ Memory leak prevention
- ✅ Optimized database queries

### 🏗️ Architecture Improvements
- ✅ Modular component structure
- ✅ Centralized state management
- ✅ Proper error handling
- ✅ Event management system
- ✅ Clean separation of concerns

### 🧪 Quality Assurance
- ✅ ESLint and Prettier configuration
- ✅ Jest testing framework
- ✅ TypeScript support
- ✅ Comprehensive test coverage
- ✅ Code quality standards

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ 
- MongoDB (local or Atlas)
- Windows/macOS/Linux

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd shop

# Install dependencies
npm install

# Set up environment variables
cp .env.example .env
# Edit .env with your MongoDB connection string

# Run development server
npm run dev
```

### Available Scripts

```bash
# Development
npm run dev          # Start in development mode
npm start            # Start in production mode

# Code Quality
npm run lint         # Check code quality
npm run lint:fix     # Fix linting issues
npm run format       # Format code with Prettier
npm run type-check   # TypeScript type checking

# Testing
npm test             # Run test suite
npm run test:watch   # Watch mode for tests
npm run test:coverage # Generate coverage report

# Build
npm run build        # Build for production
npm run dist         # Create distribution packages

# Database
npm run seed         # Seed database with sample data
npm run wipe:local   # Clear local database
npm run wipe:atlas   # Clear Atlas database
```

## 🏗️ Architecture

### Frontend Structure
```
src/renderer/
├── js/
│   ├── components/     # Reusable UI components
│   │   ├── Modal.js
│   │   ├── Notification.js
│   │   └── EventManager.js
│   ├── services/       # Business logic
│   │   ├── ApiService.js
│   │   └── StateManager.js
│   └── utils/         # Utility functions
│       ├── dom.js
│       ├── formatting.js
│       ├── performance.js
│       ├── validation.js
│       └── errorHandler.js
├── css/
│   ├── components.css
│   └── autocomplete.css
└── index.html
```

### Backend Structure
```
src/
├── main/              # Electron main process
│   ├── main.js
│   └── preload.js
├── models/            # MongoDB schemas
├── services/          # Business logic services
├── database/          # Database connection
└── utils/            # Utility functions
```

## 🔧 Key Features

### Invoice Management
- Create and edit invoices
- Multiple payment tracking
- Print and PDF export
- Customer and plumber management
- Item inventory tracking

### Product Management
- Product catalog with categories
- Stock level monitoring
- Low stock alerts
- Pricing and discount management
- Popularity tracking

### Customer Management
- Customer database
- Contact information
- Purchase history
- Arabic name support

### Data Management
- Local and cloud database sync
- Backup and restore functionality
- Data export capabilities
- Offline support

## 🛡️ Security Features

### Input Validation
- Comprehensive data validation
- XSS protection
- SQL injection prevention
- Arabic text sanitization

### Electron Security
- Context isolation enabled
- Node integration disabled
- Sandbox mode active
- Secure IPC channels

## 📊 Performance Features

### Virtual Scrolling
- Handle thousands of items
- Smooth 60fps scrolling
- Memory efficient rendering

### Smart Caching
- API response caching
- TTL-based expiration
- Memory usage optimization

### Request Optimization
- Deduplication of identical requests
- Retry logic with exponential backoff
- Loading state management

## 🧪 Testing

### Test Coverage
- Unit tests for all utilities
- Component testing
- Error handling verification
- Arabic text support validation

### Running Tests
```bash
npm test                 # Run all tests
npm run test:watch      # Watch mode
npm run test:coverage   # Coverage report
```

## 🌐 Localization

### Arabic Support
- Right-to-left (RTL) layout
- Arabic number formatting
- Unicode text handling
- Culturally appropriate error messages

## 📦 Build and Distribution

### Development Build
```bash
npm run dev
```

### Production Build
```bash
npm run build
npm run dist
```

### Supported Platforms
- Windows (NSIS installer)
- macOS (DMG)
- Linux (AppImage)

## 🔄 Database

### MongoDB Integration
- Local MongoDB support
- MongoDB Atlas cloud support
- Automatic failover
- Data synchronization

### Models
- Products
- Customers
- Invoices
- Plumbers
- Return invoices
- Counters

## 📈 Monitoring

### Performance Monitoring
- Memory usage tracking
- Performance metrics
- Error rate monitoring
- User activity logging

### Error Handling
- Centralized error management
- User-friendly error messages
- Detailed error logging
- Graceful degradation

## 🤝 Contributing

### Development Setup
1. Fork the repository
2. Install dependencies: `npm install`
3. Run tests: `npm test`
4. Start development: `npm run dev`

### Code Standards
- Follow ESLint rules
- Use Prettier for formatting
- Write tests for new features
- Follow Arabic naming for UI elements

### Pull Request Process
1. Run `npm run pre-commit` before submitting
2. Ensure all tests pass
3. Update documentation as needed
4. Follow conventional commit messages

## 📄 License

MIT License - see [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Built with Electron and MongoDB
- Arabic localization support
- Modern JavaScript/Node.js practices
- Comprehensive testing with Jest

## 📞 Support

For support and questions:
- Check the documentation
- Run tests to understand expected behavior
- Review code comments for implementation details
- Use the built-in error reporting system

---

**Status**: Production Ready ✅
**Version**: 1.0.0
**Last Updated**: 2025-01-19
