// server.js (updated)
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const serverless = require('serverless-http');
const AWS = require('aws-sdk');
const fs = require('fs');

// Configure AWS S3 (use env creds if provided, otherwise rely on IAM role)
const s3Config = {
  region: process.env.AWS_REGION || "eu-west-3"
};
if (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) {
  s3Config.accessKeyId = process.env.AWS_ACCESS_KEY_ID;
  s3Config.secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;
}
const s3 = new AWS.S3(s3Config);

const S3_BUCKET_NAME = 'smartphonecity-images'; // replace if different

const app = express();
const PORT = process.env.PORT || 5000;

// CORS - allow preflight + common headers (adjust origin in production)
app.use(cors({
  origin: '*', // change to your frontend origin in production
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept'],
  exposedHeaders: ['Content-Length', 'ETag'],
  preflightContinue: false,
  optionsSuccessStatus: 204
}));
// Ensure OPTIONS for all routes respond (helps API Gateway preflight)
app.options('*', cors());

// Body parsers
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// MongoDB Connection
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://repairShop:repairShop@repairshopcluster.owizlev.mongodb.net/?retryWrites=true&w=majority&appName=repairShopCluster';

mongoose.connect(MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  retryWrites: true,
  w: 'majority'
}).then(() => {
  console.log('Successfully connected to MongoDB');

  // Start server only if not running as Lambda (for local dev)
  if (process.env.NODE_ENV !== 'lambda') {
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  }
}).catch(err => {
  console.error('MongoDB connection error:', err);
  // don't exit when running in lambda (let lambda handle retries)
  if (process.env.NODE_ENV !== 'lambda') process.exit(1);
});

// Schemas & Models (kept from your original file)
const productSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 100 },
  brand: { type: String, required: true, trim: true },
  image: { type: String, required: true },
  price: { type: String, required: true },
  originalPrice: String,
  discount: String,
  rating: { type: Number, min: 0, max: 5, default: 0 },
  reviews: { type: Number, min: 0, default: 0 },
  features: [String],
  specifications: { type: Map, of: String },
  description: String,
  inStock: { type: Boolean, default: true },
  category: String,
  type: { type: String, enum: ['mobile', 'laptop'], required: true }
}, { timestamps: true, id: false, versionKey: false });

mongoose.set('autoIndex', false);

const appointmentSchema = new mongoose.Schema({
  deviceType: { type: String, required: true },
  deviceName: { type: String, required: true },
  subtype: { type: String, required: true },
  subtypeName: { type: String, required: true },
  brand: { type: String, required: true },
  model: { type: String, required: true },
  services: [{ id: String, name: String, price: Number, description: String }],
  totalPrice: { type: Number, required: true },
  customer: {
    name: { type: String, required: true },
    firstName: { type: String, required: true },
    email: { type: String, required: true },
    phone: String
  },
  appointment: { date: { type: String, required: true }, time: { type: String, required: true } },
  status: { type: String, default: 'pending' },
  createdAt: { type: Date, default: Date.now }
}, { collection: 'appointments' });

const Mobile = mongoose.model('Mobile', productSchema);
const Laptop = mongoose.model('Laptop', productSchema);
const Tablet = mongoose.model('Tablet', productSchema);
const Console = mongoose.model('Console', productSchema);
const Appointment = mongoose.model('Appointment', appointmentSchema);

// Repair schemas & brand schemas (kept)
const mobileRepairSchema = new mongoose.Schema({
  brand: { type: String, required: true },
  model: { type: String, required: true },
  repairOptions: [{
    name: { type: String, required: true },
    estimatedCost: { type: Number, required: true },
    description: { type: String, required: true },
    screenType: { type: String, enum: ['OLED', 'AMOLED', 'LCD'], default: 'AMOLED' }
  }]
}, { timestamps: true });

const laptopRepairSchema = new mongoose.Schema({
  brand: { type: String, required: true },
  model: { type: String, required: true },
  repairOptions: [{
    name: { type: String, required: true },
    estimatedCost: { type: Number, required: true },
    description: { type: String, required: true },
    includesKeyboard: { type: Boolean, default: false }
  }]
}, { timestamps: true });

const tabletRepairSchema = new mongoose.Schema({
  brand: { type: String, required: true },
  model: { type: String, required: true },
  repairOptions: [{
    name: { type: String, required: true },
    estimatedCost: { type: Number, required: true },
    description: { type: String, required: true },
    includesStylus: { type: Boolean, default: false }
  }]
}, { timestamps: true });

const consoleRepairSchema = new mongoose.Schema({
  brand: { type: String, required: true },
  model: { type: String, required: true },
  repairOptions: [{
    name: { type: String, required: true },
    estimatedCost: { type: Number, required: true },
    description: { type: String, required: true },
    includesControllers: { type: Boolean, default: false }
  }]
}, { timestamps: true });

const mobileBrandSchema = new mongoose.Schema({ name: { type: String, required: true, unique: true }, models: [String], repairCount: { type: Number, default: 0 } }, { timestamps: true });
const laptopBrandSchema = new mongoose.Schema({ name: { type: String, required: true, unique: true }, models: [String], repairCount: { type: Number, default: 0 } }, { timestamps: true });
const tabletBrandSchema = new mongoose.Schema({ name: { type: String, required: true, unique: true }, models: [String], repairCount: { type: Number, default: 0 } }, { timestamps: true });
const consoleBrandSchema = new mongoose.Schema({ name: { type: String, required: true, unique: true }, models: [String], repairCount: { type: Number, default: 0 } }, { timestamps: true });

const MobileRepair = mongoose.model('MobileRepair', mobileRepairSchema);
const LaptopRepair = mongoose.model('LaptopRepair', laptopRepairSchema);
const TabletRepair = mongoose.model('TabletRepair', tabletRepairSchema);
const ConsoleRepair = mongoose.model('ConsoleRepair', consoleRepairSchema);

const MobileBrand = mongoose.model('MobileBrand', mobileBrandSchema);
const LaptopBrand = mongoose.model('LaptopBrand', laptopBrandSchema);
const TabletBrand = mongoose.model('TabletBrand', tabletBrandSchema);
const ConsoleBrand = mongoose.model('ConsoleBrand', consoleBrandSchema);

// Multer setup (memory storage for S3 upload)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg'];
    if (allowedTypes.includes(file.mimetype)) cb(null, true);
    else cb(new Error('Only .jpeg, .jpg, and .png formats are allowed'), false);
  }
});

// Routes
app.get('/api/products/:type', async (req, res) => {
  try {
    const { type } = req.params;
    const normalizedType = type.replace(/s$/, '');
    if (!['mobile', 'laptop'].includes(normalizedType)) return res.status(400).json({ error: 'Invalid product type' });
    const Model = normalizedType === 'mobile' ? Mobile : Laptop;
    const products = await Model.find();
    res.json(products);
  } catch (err) {
    console.error('Error fetching products:', err);
    res.status(500).json({ error: 'Failed to fetch products' });
  }
});

// S3 helper
const uploadToS3 = (fileBuffer, fileName, mimetype) => {
  const params = {
    Bucket: S3_BUCKET_NAME,
    Key: fileName,
    Body: fileBuffer,
    ContentType: mimetype,
    ACL: 'public-read'
  };
  return s3.upload(params).promise();
};

// Add mobile
app.post('/api/products/add-mobile', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Image is required' });

    const fileName = `mobile-${Date.now()}${path.extname(req.file.originalname)}`;
    const s3Response = await uploadToS3(req.file.buffer, fileName, req.file.mimetype);

    const mobile = new Mobile({
      id: req.body.id,
      name: req.body.name,
      brand: req.body.brand,
      price: req.body.price,
      originalPrice: req.body.originalPrice,
      discount: req.body.discount,
      image: s3Response.Location,
      type: 'mobile',
      features: req.body.features ? req.body.features.split(',').map(f => f.trim()) : [],
      rating: Number(req.body.rating) || 0,
      reviews: Number(req.body.reviews) || 0,
      description: req.body.description,
      category: req.body.category,
      inStock: req.body.inStock === 'true'
    });

    await mobile.save();
    res.status(201).json({ message: 'Mobile added successfully', product: mobile });
  } catch (err) {
    console.error('Error adding mobile:', err);
    res.status(500).json({ error: 'Failed to add mobile', details: err.message });
  }
});

// Add laptop
app.post('/api/products/add-laptop', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Image is required' });

    const fileName = `laptop-${Date.now()}${path.extname(req.file.originalname)}`;
    const s3Response = await uploadToS3(req.file.buffer, fileName, req.file.mimetype);

    const laptop = new Laptop({
      id: req.body.id,
      name: req.body.name,
      brand: req.body.brand,
      price: req.body.price,
      originalPrice: req.body.originalPrice,
      discount: req.body.discount,
      image: s3Response.Location,
      type: 'laptop',
      features: req.body.features ? req.body.features.split(',').map(f => f.trim()) : [],
      rating: Number(req.body.rating) || 0,
      reviews: Number(req.body.reviews) || 0,
      description: req.body.description,
      category: req.body.category,
      inStock: req.body.inStock === 'true'
    });

    await laptop.save();
    res.status(201).json({ message: 'Laptop added successfully', product: laptop });
  } catch (err) {
    console.error('Error adding laptop:', err);
    res.status(500).json({ error: 'Failed to add laptop', details: err.message });
  }
});

// Brand update helper
async function updateBrandCollection(category, brand, model) {
  let BrandModel;
  switch (category) {
    case 'mobile': BrandModel = MobileBrand; break;
    case 'laptop': BrandModel = LaptopBrand; break;
    case 'tablet': BrandModel = TabletBrand; break;
    case 'console': BrandModel = ConsoleBrand; break;
    default: throw new Error('Invalid category');
  }

  await BrandModel.findOneAndUpdate(
    { name: brand },
    { $addToSet: { models: model }, $inc: { repairCount: 1 } },
    { upsert: true, new: true }
  );
}

// Repairs endpoints (kept from original)
app.post('/api/repairs', async (req, res) => {
  try {
    const { category, brand, model, repairOptions } = req.body;
    if (!category || !brand || !model) return res.status(400).json({ error: 'Category, brand and model are required' });

    let result;
    switch (category) {
      case 'mobile':
        result = await MobileRepair.create({ brand, model, repairOptions: repairOptions.map(option => ({ ...option, screenType: option.screenType || 'AMOLED' })) });
        break;
      case 'laptop':
        result = await LaptopRepair.create({ brand, model, repairOptions: repairOptions.map(option => ({ ...option, includesKeyboard: option.includesKeyboard || false })) });
        break;
      case 'tablet':
        result = await TabletRepair.create({ brand, model, repairOptions: repairOptions.map(option => ({ ...option, includesStylus: option.includesStylus || false })) });
        break;
      case 'console':
        result = await ConsoleRepair.create({ brand, model, repairOptions: repairOptions.map(option => ({ ...option, includesControllers: option.includesControllers || false })) });
        break;
      default:
        return res.status(400).json({ error: 'Invalid category' });
    }

    await updateBrandCollection(category, brand, model);
    res.status(201).json(result);
  } catch (err) {
    console.error('Error:', err);
    res.status(500).json({ error: err.message, ...(process.env.NODE_ENV === 'development' && { stack: err.stack }) });
  }
});

// Many read endpoints kept as-is (brands, repairs, products, appointments...) - omitted here to keep file shorter,
// but in your actual file you can keep the remaining endpoints exactly as you had them.
// For brevity in this snippet, make sure you re-add the rest of your GET/PUT/DELETE endpoints below if you trimmed.


// Example minimal remaining endpoints (keep your full list in your file)
app.get('/api/products/mobiles', async (req, res) => {
  try {
    const mobiles = await Mobile.find();
    res.json(mobiles);
  } catch (err) {
    console.error('Error fetching mobiles:', err);
    res.status(500).json({ error: 'Failed to fetch mobiles' });
  }
});

// Delete helper for S3
const deleteFromS3 = (fileUrl) => {
  const key = fileUrl.split('/').pop();
  const params = { Bucket: S3_BUCKET_NAME, Key: key };
  return s3.deleteObject(params).promise();
};

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'OK',
    database: mongoose.connection.readyState === 1 ? 'Connected' : 'Disconnected',
    timestamp: new Date()
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  if (err instanceof multer.MulterError) {
    return res.status(400).json({ message: err.message });
  } else if (err) {
    console.error(err.stack || err);
    return res.status(500).json({ message: err.message || 'Something went wrong!' });
  }
  next();
});

// Export for Serverless (Lambda) + keep app export for local dev
const serverlessHandler = serverless(app);
module.exports.handler = serverlessHandler;
module.exports.app = app;
