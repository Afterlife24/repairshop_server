const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { GridFSBucket } = require('mongodb');
const crypto = require('crypto');



const app = express();
const PORT = process.env.PORT || 5000;
// Middleware
app.use(cors());
app.use(express.json());
// app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
app.use(express.json({ limit: '10mb' }));


// MongoDB Connection
const MONGODB_URI = 'mongodb+srv://repairShop:repairShop@repairshopcluster.owizlev.mongodb.net/?retryWrites=true&w=majority&appName=repairShopCluster';
let gfsBucket;

// mongoose.connect(MONGODB_URI, {
//   useNewUrlParser: true,
//   useUnifiedTopology: true,
//   retryWrites: true,
//   w: 'majority'
// })
// .then(() => console.log('Successfully connected to MongoDB'))
// .catch(err => console.error('MongoDB connection error:', err));

mongoose.connect(MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  retryWrites: true,
  w: 'majority'
}).then(() => {
  console.log('Successfully connected to MongoDB');
  
  // Initialize GridFSBucket
  const db = mongoose.connection.db;
  gfsBucket = new GridFSBucket(db, {
    bucketName: 'uploads'
  });

  if (process.env.NODE_ENV !== 'lambda') {
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}
}).catch(err => {
  console.error('MongoDB connection error:', err);
  process.exit(1);
});

// Add this temporary route to check indexes
// app.get('/api/check-indexes', async (req, res) => {
//   const mobileIndexes = await mongoose.connection.db.collection('mobiles').indexes();
//   const laptopIndexes = await mongoose.connection.db.collection('laptops').indexes();
//   res.json({ mobiles: mobileIndexes, laptops: laptopIndexes });
// });

// Add this temporary route to your server.js
// app.get('/api/remove-bad-indexes', async (req, res) => {
//   try {
//     const db = mongoose.connection.db;
    
//     // Remove from both collections
//     await db.collection('mobiles').dropIndex('id_1');
//     await db.collection('laptops').dropIndex('id_1');
    
//     // Verify removal
//     const newIndexes = {
//       mobiles: await db.collection('mobiles').indexes(),
//       laptops: await db.collection('laptops').indexes()
//     };
    
//     res.json({
//       message: 'Indexes removed successfully',
//       remainingIndexes: newIndexes
//     });
//   } catch (err) {
//     res.status(500).json({ 
//       error: err.message,
//       note: 'If indexes were already missing, this is fine' 
//     });
//   }
// });

// Product Schema
const productSchema = new mongoose.Schema({
  name: { 
    type: String, 
    required: true,
    trim: true,

    maxlength: 100
  },
  brand: { 
    type: String, 
    required: true,
    trim: true
  },
  image: { 
    type: String, 
    required: true
  },
  price: { 
    type: String, 
    required: true
  },
  originalPrice: String,
  discount: String,
  rating: { 
    type: Number, 
    min: 0, 
    max: 5,
    default: 0
  },
  reviews: {
    type: Number,
    min: 0,
    default: 0
  },
  features: [String],
  specifications: {
    type: Map,
    of: String
  },
  description: String,
  inStock: {
    type: Boolean,
    default: true
  },
  category: String,
  type: { 
    type: String, 
    enum: ['mobile', 'laptop'], 
    required: true 
  }
}, { 
  timestamps: true,
  id: false,
  versionKey: false
});

mongoose.set('autoIndex', false);

const appointmentSchema = new mongoose.Schema({
  deviceType: { type: String, required: true },
  deviceName: { type: String, required: true },
  subtype: { type: String, required: true },
  subtypeName: { type: String, required: true },
  brand: { type: String, required: true },
  model: { type: String, required: true },
  services: [{
    id: String,
    name: String,
    price: Number,
    description: String
  }],
  totalPrice: { type: Number, required: true },
  customer: {
    name: { type: String, required: true },
    firstName: { type: String, required: true },
    email: { type: String, required: true },
    phone: String
  },
  appointment: {
    date: { type: String, required: true },
    time: { type: String, required: true }
  },
  status: { type: String, default: 'pending' },
  createdAt: { type: Date, default: Date.now }
}, { collection: 'appointments' });




const Mobile = mongoose.model('Mobile', productSchema);
const Laptop = mongoose.model('Laptop', productSchema);
const Tablet = mongoose.model('Tablet', productSchema);
const Console = mongoose.model('Console', productSchema);
const Appointment = mongoose.model('Appointment', appointmentSchema);


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

// New tablet repair schema
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

// New console repair schema
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




// Brand Tracking Schemas
const mobileBrandSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
  models: [String],
  repairCount: { type: Number, default: 0 }
}, { timestamps: true });

const laptopBrandSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
  models: [String],
  repairCount: { type: Number, default: 0 }
}, { timestamps: true });

// New tablet brand schema
const tabletBrandSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
  models: [String],
  repairCount: { type: Number, default: 0 }
}, { timestamps: true });

// New console brand schema
const consoleBrandSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
  models: [String],
  repairCount: { type: Number, default: 0 }
}, { timestamps: true });



const MobileRepair = mongoose.model('MobileRepair', mobileRepairSchema);
const LaptopRepair = mongoose.model('LaptopRepair', laptopRepairSchema);
const TabletRepair = mongoose.model('TabletRepair', tabletRepairSchema);
const ConsoleRepair = mongoose.model('ConsoleRepair', consoleRepairSchema);


const MobileBrand = mongoose.model('MobileBrand', mobileBrandSchema);
const LaptopBrand = mongoose.model('LaptopBrand', laptopBrandSchema);
const TabletBrand = mongoose.model('TabletBrand', tabletBrandSchema);
const ConsoleBrand = mongoose.model('ConsoleBrand', consoleBrandSchema);

// Create uploads directory if it doesn't exist
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// // Configure storage for uploaded files
// const storage = multer.diskStorage({
//   destination: function (req, file, cb) {
//     cb(null, uploadDir);
//   },
//   filename: function (req, file, cb) {
//     const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
//     cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
//   }
// });

// const upload = multer({ 
//   storage: storage,
//   fileFilter: fileFilter,
//   limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
// });


let gfs;
// conn.once('open', () => {
//   // Initialize GridFS stream
//   gfs = Grid(conn.db, mongoose.mongo);
//   gfs.collection('uploads');
// });

const storage = new multer.memoryStorage();
const upload = multer({ 
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only .jpeg, .jpg, and .png formats are allowed'), false);
    }
  }
});

// File filter to accept only images
const fileFilter = (req, file, cb) => {
  const allowedTypes = ['image/jpeg', 'image/png', 'image/jpg'];
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Only .jpeg, .jpg, and .png formats are allowed'), false);
  }
};





// // Add mobile product with image upload
// app.post('/api/products/add-mobile', upload.single('image'), async (req, res) => {
//   try {
//     if (!req.file) {
//       return res.status(400).json({ message: 'Image is required' });
//     }

//     const imagePath = `/uploads/${req.file.filename}`;
//     const mobile = new Mobile({
//       ...req.body,
//       image: imagePath,
//       type: 'mobile',
//       features: req.body.features.split(',').map(f => f.trim()),
//       rating: Number(req.body.rating),
//       reviews: Number(req.body.reviews),
//       inStock: req.body.inStock === 'true'
//     });

//     await mobile.save();
//     res.status(201).json({ message: 'Mobile added successfully', product: mobile });



// Route to serve images
app.get('/api/images/:filename', (req, res) => {
  if (!gfsBucket) {
    return res.status(503).json({ error: 'Storage system not ready' });
  }

  const downloadStream = gfsBucket.openDownloadStreamByName(req.params.filename);
  
  downloadStream.on('error', () => {
    res.status(404).json({ error: 'File not found' });
  });
  
  downloadStream.pipe(res);
});

app.get('/api/products/:type', async (req, res) => {
  try {
    const { type } = req.params;
    if (!['mobile', 'laptop'].includes(type)) {
      return res.status(400).json({ error: 'Invalid product type' });
    }

    const Model = type === 'mobile' ? Mobile : Laptop;
    const products = await Model.find();
    res.json(products);
  } catch (err) {
    console.error('Error fetching products:', err);
    res.status(500).json({ error: 'Failed to fetch products' });
  }
});



// Add mobile product
app.post('/api/products/add-mobile', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Image is required' });
    }

    if (!gfsBucket) {
      return res.status(503).json({ error: 'Storage system not ready' });
    }

    // Generate unique filename
    const filename = crypto.randomBytes(16).toString('hex') + path.extname(req.file.originalname);
    
    // Create upload stream
    const uploadStream = gfsBucket.openUploadStream(filename, {
      contentType: req.file.mimetype
    });

    uploadStream.on('error', () => {
      res.status(500).json({ error: 'Failed to store image' });
    });

    uploadStream.on('finish', async () => {
      try {
        const imagePath = `/api/images/${filename}`;
        const mobile = new Mobile({
          ...req.body,
          image: imagePath,
          type: 'mobile',
          features: req.body.features?.split(',').map(f => f.trim()) || [],
          rating: Number(req.body.rating) || 0,
          reviews: Number(req.body.reviews) || 0,
          inStock: req.body.inStock === 'true'
        });

        await mobile.save();
        res.status(201).json({ message: 'Mobile added successfully', product: mobile });
      } catch (err) {
        console.error('Error saving mobile:', err);
        res.status(500).json({ error: 'Failed to save product' });
      }
    });

    uploadStream.end(req.file.buffer);
  } catch (err) {
    console.error('Error adding mobile:', err);
    res.status(500).json({ error: 'Failed to add mobile' });
  }
});

app.post('/api/products/add-laptop', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Image is required' });
    }

    if (!gfsBucket) {
      return res.status(503).json({ error: 'Storage system not ready' });
    }

    // Generate unique filename
    const filename = crypto.randomBytes(16).toString('hex') + path.extname(req.file.originalname);
    
    // Create upload stream
    const uploadStream = gfsBucket.openUploadStream(filename, {
      contentType: req.file.mimetype
    });

    uploadStream.on('error', () => {
      res.status(500).json({ error: 'Failed to store image' });
    });

    uploadStream.on('finish', async () => {
      try {
        const imagePath = `/api/images/${filename}`;
        const laptop = new Laptop({
          ...req.body,
          image: imagePath,
          type: 'laptop',
          features: req.body.features?.split(',').map(f => f.trim()) || [],
          rating: Number(req.body.rating) || 0,
          reviews: Number(req.body.reviews) || 0,
          inStock: req.body.inStock === 'true'
        });

        await laptop.save();
        res.status(201).json({ message: 'Laptop added successfully', product: laptop });
      } catch (err) {
        console.error('Error saving laptop:', err);
        res.status(500).json({ error: 'Failed to save product' });
      }
    });

    uploadStream.end(req.file.buffer);
  } catch (err) {
    console.error('Error adding laptop:', err);
    res.status(500).json({ error: 'Failed to add laptop' });
  }
});





// Updated helper function to handle all categories
async function updateBrandCollection(category, brand, model) {
  let BrandModel;
  
  switch(category) {
    case 'mobile':
      BrandModel = MobileBrand;
      break;
    case 'laptop':
      BrandModel = LaptopBrand;
      break;
    case 'tablet':
      BrandModel = TabletBrand;
      break;
    case 'console':
      BrandModel = ConsoleBrand;
      break;
    default:
      throw new Error('Invalid category');
  }
  
  await BrandModel.findOneAndUpdate(
    { name: brand },
    { 
      $addToSet: { models: model },
      $inc: { repairCount: 1 }
    },
    { upsert: true, new: true }
  );
}



// API Endpoints for Devices and Repair Options

// Updated repair endpoint to handle all categories
app.post('/api/repairs', async (req, res) => {
  try {
    const { category, brand, model, repairOptions } = req.body;
    
    if (!category || !brand || !model) {
      return res.status(400).json({ error: 'Category, brand and model are required' });
    }

    let result;
    
    switch(category) {
      case 'mobile':
        result = await MobileRepair.create({
          brand,
          model,
          repairOptions: repairOptions.map(option => ({
            ...option,
            screenType: option.screenType || 'AMOLED'
          }))
        });
        break;
      case 'laptop':
        result = await LaptopRepair.create({
          brand,
          model,
          repairOptions: repairOptions.map(option => ({
            ...option,
            includesKeyboard: option.includesKeyboard || false
          }))
        });
        break;
      case 'tablet':
        result = await TabletRepair.create({
          brand,
          model,
          repairOptions: repairOptions.map(option => ({
            ...option,
            includesStylus: option.includesStylus || false
          }))
        });
        break;
      case 'console':
        result = await ConsoleRepair.create({
          brand,
          model,
          repairOptions: repairOptions.map(option => ({
            ...option,
            includesControllers: option.includesControllers || false
          }))
        });
        break;
      default:
        return res.status(400).json({ error: 'Invalid category' });
    }

    // Update the appropriate brand collection
    await updateBrandCollection(category, brand, model);

    res.status(201).json(result);
  } catch (err) {
    console.error('Error:', err);
    res.status(500).json({ 
      error: err.message,
      ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
    });
  }
});


// Get all mobile brands
app.get('/api/brands/mobile', async (req, res) => {
  try {
    const brands = await MobileBrand.find();
    res.json(brands);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get all laptop brands
app.get('/api/brands/laptops', async (req, res) => {
  try {
    const brands = await LaptopBrand.find();
    res.json(brands);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// Add endpoints for new categories
app.get('/api/brands/tablets', async (req, res) => {
  try {
    const brands = await TabletBrand.find();
    res.json(brands);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/brands/consoles', async (req, res) => {
  try {
    const brands = await ConsoleBrand.find();
    res.json(brands);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});



// Get mobile repairs by brand
app.get('/api/repairs/mobiles', async (req, res) => {
  try {
    const { brand } = req.query;
    const query = brand ? { brand: new RegExp(`^${brand}$`, 'i') } : {};
    const mobiles = await MobileRepair.find(query).sort({ model: 1 });
    res.json(mobiles);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get laptop repairs by brand
app.get('/api/repairs/laptops', async (req, res) => {
  try {
    const { brand } = req.query;
    const query = brand ? { brand: new RegExp(`^${brand}$`, 'i') } : {};
    const laptops = await LaptopRepair.find(query).sort({ model: 1 });
    res.json(laptops);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get tablet repairs by brand
app.get('/api/repairs/tablets', async (req, res) => {
  try {
    const { brand } = req.query;
    const query = brand ? { brand: new RegExp(`^${brand}$`, 'i') } : {};
    const tablets = await TabletRepair.find(query).sort({ model: 1 });
    res.json(tablets);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get console repairs by brand
app.get('/api/repairs/consoles', async (req, res) => {
  try {
    const { brand } = req.query;
    const query = brand ? { brand: new RegExp(`^${brand}$`, 'i') } : {};
    const consoles = await ConsoleRepair.find(query).sort({ model: 1 });
    res.json(consoles);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});




// Existing Product Endpoints (kept from your original code)

// Get all laptops
app.get('/api/products/laptops', async (req, res) => {
  try {
    const laptops = await Laptop.find();
    res.json(laptops);
  } catch (err) {
    console.error('Error fetching laptops:', err);
    res.status(500).json({ error: 'Failed to fetch laptops' });
  }
});

// Get all mobiles
app.get('/api/products/mobiles', async (req, res) => {
  try {
    const mobiles = await Mobile.find();
    res.json(mobiles);
    console.log(mobiles)
  } catch (err) {
    console.error('Error fetching mobiles:', err);
    res.status(500).json({ error: 'Failed to fetch mobiles' });
  }
});

// Get single product by ID
app.get('/api/products/:id', async (req, res) => {
  try {
    const product = await Mobile.findOne({ id: req.params.id }) || 
                   await Laptop.findOne({ id: req.params.id });
    
    if (!product) {
      return res.status(404).json({ message: 'Product not found' });
    }
    
    res.json(product);
  } catch (err) {
    console.error('Error fetching product:', err);
    res.status(500).json({ message: 'Failed to fetch product' });
  }
});



// DELETE mobile by ID
app.delete('/api/products/delete-mobile/:id', async (req, res) => {
  try {
    const mobile = await Mobile.findOne({ id: req.params.id });
    if (!mobile) {
      return res.status(404).json({ message: 'Mobile not found' });
    }

    // Delete the associated image file
    const imagePath = path.join(__dirname, mobile.image);
    if (fs.existsSync(imagePath)) {
      fs.unlinkSync(imagePath);
    }

    await Mobile.deleteOne({ id: req.params.id });
    res.json({ message: 'Mobile deleted successfully' });
  } catch (err) {
    console.error('Error deleting mobile:', err);
    res.status(500).json({ message: 'Failed to delete mobile' });
  }
});

// DELETE laptop by ID
app.delete('/api/products/delete-laptop/:id', async (req, res) => {
  try {
    const laptop = await Laptop.findOne({ id: req.params.id });
    if (!laptop) {
      return res.status(404).json({ message: 'Laptop not found' });
    }

    // Delete the associated image file
    const imagePath = path.join(__dirname, laptop.image);
    if (fs.existsSync(imagePath)) {
      fs.unlinkSync(imagePath);
    }

    await Laptop.deleteOne({ id: req.params.id });
    res.json({ message: 'Laptop deleted successfully' });
  } catch (err) {
    console.error('Error deleting laptop:', err);
    res.status(500).json({ message: 'Failed to delete laptop' });
  }
});

// Health check endpoint
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
    console.error(err.stack);
    return res.status(500).json({ message: err.message || 'Something went wrong!' });
  }
  next();
});





// In your Express backend (server.ts or similar)

// Get brands by category
// Get brands by category and optionally subtype
// In your backend (server.js or similar)
// Get brands by category
app.get('/api/brands/:category', async (req, res) => {
  try {
    const { category } = req.params;
    let brands;
    
    switch(category) {
      case 'mobile':
        brands = await MobileBrand.find().sort({ name: 1 });
        break;
      case 'tablet':
        brands = await TabletBrand.find().sort({ name: 1 });
        break;
      case 'laptop':
        brands = await LaptopBrand.find().sort({ name: 1 });
        break;
      case 'console':
        brands = await ConsoleBrand.find().sort({ name: 1 });
        break;
      default:
        return res.status(400).json({ error: 'Invalid category' });
    }
    
    res.json(brands);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get brands by device type and subtype
app.get('/api/brands/:type', async (req, res) => {
  try {
    const { type } = req.params;
    const { subtype } = req.query;
    let brands;

    if (type === 'mobile' && subtype === 'tablet') {
      brands = await TabletBrand.find().sort({ name: 1 });
    } 
    else if (type === 'laptop' && subtype === 'console') {
      brands = await ConsoleBrand.find().sort({ name: 1 });
    }
    else if (type === 'mobile') {
      brands = await MobileBrand.find().sort({ name: 1 });
    }
    else if (type === 'laptop') {
      brands = await LaptopBrand.find().sort({ name: 1 });
    }
    else {
      return res.status(400).json({ error: 'Invalid device type or subtype' });
    }

    res.json(brands);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get models by brand and category
app.get('/api/models', async (req, res) => {
  try {
    const { brandId, category } = req.query;
    let models;
    
    switch(category) {
      case 'mobile':
        models = await Mobile.find({ brandId }).sort({ name: 1 });
        break;
      case 'laptop':
        models = await Laptop.find({ brandId }).sort({ name: 1 });
        break;
      case 'tablet':
        models = await Tablet.find({ brandId }).sort({ name: 1 });
        break;
      case 'console':
        models = await Console.find({ brandId }).sort({ name: 1 });
        break;
      default:
        return res.status(400).json({ error: 'Invalid category' });
    }
    
    res.json(models);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get repair services by category and subtype
app.get('/api/repairs', async (req, res) => {
  try {
    const { category, subtype } = req.query;
    let services;
    
    switch(category) {
      case 'mobile':
        services = await MobileRepair.find({ 
          brand: subtype === 'mobile' ? 'mobile' : 'tablet' 
        });
        break;
      case 'laptop':
        services = await LaptopRepair.find({ 
          brand: subtype === 'laptop' ? 'laptop' : 'console' 
        });
        break;
      default:
        return res.status(400).json({ error: 'Invalid category' });
    }
    
    res.json(services);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
// Add these endpoints to your backend

// Get mobile models by brand
app.get('/api/repairs/mobiles', async (req, res) => {
  try {
    const { brand } = req.query;
    const query = brand ? { brand } : {};
    const mobiles = await MobileRepair.find(query).sort({ model: 1 });
    res.json(mobiles);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get laptop models by brand
app.get('/api/repairs/laptops', async (req, res) => {
  try {
    const { brand } = req.query;
    const query = brand ? { brand } : {};
    const laptops = await LaptopRepair.find(query).sort({ model: 1 });
    res.json(laptops);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get tablet models by brand
app.get('/api/repairs/tablets', async (req, res) => {
  try {
    const { brand } = req.query;
    const query = brand ? { brand } : {};
    const tablets = await TabletRepair.find(query).sort({ model: 1 });
    res.json(tablets);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get console models by brand
app.get('/api/repairs/consoles', async (req, res) => {
  try {
    const { brand } = req.query;
    const query = brand ? { brand } : {};
    const consoles = await ConsoleRepair.find(query).sort({ model: 1 });
    res.json(consoles);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});


// In your server code (backend)
app.get('/api/repairs/:category', async (req, res) => {
  try {
    const { category } = req.params;
    const { brand } = req.query; // Get brand from query params
    
    let query = {};
    if (brand) {
      query.brand = brand;
    }
    
    let repairs;
    switch(category) {
      case 'mobiles':
        repairs = await MobileRepair.find(query);
        break;
      case 'tablets':
        repairs = await TabletRepair.find(query);
        break;
      case 'laptops':
        repairs = await LaptopRepair.find(query);
        break;
      case 'consoles':
        repairs = await ConsoleRepair.find(query);
        break;
      default:
        return res.status(400).json({ error: 'Invalid category' });
    }
    
    res.json(repairs);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
// Create appointment
// app.post('/api/appointments', async (req, res) => {
//   try {
//     // Here you would save the appointment to your database
//     // This is just a basic example
//     const appointmentData = req.body;
    
//     // Save to database (you'll need to create an Appointment model)
//     // const appointment = new Appointment(appointmentData);
//     // await appointment.save();
    
//     res.status(201).json({ 
//       message: 'Appointment created successfully',
//       appointment: appointmentData
//     });
//   } catch (err) {
//     res.status(500).json({ error: err.message });
//   }
// });


//-----------------------------------------------------------------------------------------------------------------------------------------------------------

// Update mobile repair by ID
app.put('/api/repairs/mobiles/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updatedRepair = await MobileRepair.findByIdAndUpdate(
      id,
      req.body,
      { new: true, runValidators: true }
    );
    
    if (!updatedRepair) {
      return res.status(404).json({ error: 'Mobile repair not found' });
    }
    
    res.json(updatedRepair);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update laptop repair by ID
app.put('/api/repairs/laptops/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updatedRepair = await LaptopRepair.findByIdAndUpdate(
      id,
      req.body,
      { new: true, runValidators: true }
    );
    
    if (!updatedRepair) {
      return res.status(404).json({ error: 'Laptop repair not found' });
    }
    
    res.json(updatedRepair);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update tablet repair by ID
app.put('/api/repairs/tablets/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updatedRepair = await TabletRepair.findByIdAndUpdate(
      id,
      req.body,
      { new: true, runValidators: true }
    );
    
    if (!updatedRepair) {
      return res.status(404).json({ error: 'Tablet repair not found' });
    }
    
    res.json(updatedRepair);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update console repair by ID
app.put('/api/repairs/consoles/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const updatedRepair = await ConsoleRepair.findByIdAndUpdate(
      id,
      req.body,
      { new: true, runValidators: true }
    );
    
    if (!updatedRepair) {
      return res.status(404).json({ error: 'Console repair not found' });
    }
    
    res.json(updatedRepair);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete mobile repair by ID
app.delete('/api/repairs/mobiles/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const deletedRepair = await MobileRepair.findByIdAndDelete(id);
    
    if (!deletedRepair) {
      return res.status(404).json({ error: 'Mobile repair not found' });
    }
    
    res.json({ message: 'Mobile repair deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete laptop repair by ID
app.delete('/api/repairs/laptops/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const deletedRepair = await LaptopRepair.findByIdAndDelete(id);
    
    if (!deletedRepair) {
      return res.status(404).json({ error: 'Laptop repair not found' });
    }
    
    res.json({ message: 'Laptop repair deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete tablet repair by ID
app.delete('/api/repairs/tablets/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const deletedRepair = await TabletRepair.findByIdAndDelete(id);
    
    if (!deletedRepair) {
      return res.status(404).json({ error: 'Tablet repair not found' });
    }
    
    res.json({ message: 'Tablet repair deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete console repair by ID
app.delete('/api/repairs/consoles/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const deletedRepair = await ConsoleRepair.findByIdAndDelete(id);
    
    if (!deletedRepair) {
      return res.status(404).json({ error: 'Console repair not found' });
    }
    
    res.json({ message: 'Console repair deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get single mobile repair by ID
app.get('/api/repairs/mobiles/:id', async (req, res) => {
  try {
    const repair = await MobileRepair.findById(req.params.id);
    if (!repair) {
      return res.status(404).json({ error: 'Mobile repair not found' });
    }
    res.json(repair);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get single laptop repair by ID
app.get('/api/repairs/laptops/:id', async (req, res) => {
  try {
    const repair = await LaptopRepair.findById(req.params.id);
    if (!repair) {
      return res.status(404).json({ error: 'Laptop repair not found' });
    }
    res.json(repair);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get single tablet repair by ID
app.get('/api/repairs/tablets/:id', async (req, res) => {
  try {
    const repair = await TabletRepair.findById(req.params.id);
    if (!repair) {
      return res.status(404).json({ error: 'Tablet repair not found' });
    }
    res.json(repair);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get single console repair by ID
app.get('/api/repairs/consoles/:id', async (req, res) => {
  try {
    const repair = await ConsoleRepair.findById(req.params.id);
    if (!repair) {
      return res.status(404).json({ error: 'Console repair not found' });
    }
    res.json(repair);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

//-------




// Update repair option endpoint
app.put('/api/repairs/:category/:repairId/options/:optionId', async (req, res) => {
  try {
    const { category, repairId, optionId } = req.params;
    const updateData = req.body;

    let RepairModel;
    switch(category) {
      case 'mobiles': RepairModel = MobileRepair; break;
      case 'laptops': RepairModel = LaptopRepair; break;
      case 'tablets': RepairModel = TabletRepair; break;
      case 'consoles': RepairModel = ConsoleRepair; break;
      default: return res.status(400).json({ error: 'Invalid category' });
    }

    const repair = await RepairModel.findById(repairId);
    if (!repair) {
      return res.status(404).json({ error: 'Repair not found' });
    }

    const optionIndex = repair.repairOptions.findIndex(opt => opt._id.toString() === optionId);
    if (optionIndex === -1) {
      return res.status(404).json({ error: 'Repair option not found' });
    }

    // Update the option
    repair.repairOptions[optionIndex] = {
      ...repair.repairOptions[optionIndex].toObject(),
      ...updateData
    };

    await repair.save();
    res.json(repair.repairOptions[optionIndex]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete repair option endpoint
app.delete('/api/repairs/:category/:repairId/options/:optionId', async (req, res) => {
  try {
    const { category, repairId, optionId } = req.params;

    let RepairModel;
    switch(category) {
      case 'mobiles': RepairModel = MobileRepair; break;
      case 'laptops': RepairModel = LaptopRepair; break;
      case 'tablets': RepairModel = TabletRepair; break;
      case 'consoles': RepairModel = ConsoleRepair; break;
      default: return res.status(400).json({ error: 'Invalid category' });
    }

    const repair = await RepairModel.findById(repairId);
    if (!repair) {
      return res.status(404).json({ error: 'Repair not found' });
    }

    repair.repairOptions = repair.repairOptions.filter(opt => opt._id.toString() !== optionId);
    await repair.save();
    res.json({ message: 'Repair option deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Add repair option endpoint
app.post('/api/repairs/:category/:repairId/options', async (req, res) => {
  try {
    const { category, repairId } = req.params;
    const newOption = req.body;

    let RepairModel;
    switch(category) {
      case 'mobiles': RepairModel = MobileRepair; break;
      case 'laptops': RepairModel = LaptopRepair; break;
      case 'tablets': RepairModel = TabletRepair; break;
      case 'consoles': RepairModel = ConsoleRepair; break;
      default: return res.status(400).json({ error: 'Invalid category' });
    }

    const repair = await RepairModel.findById(repairId);
    if (!repair) {
      return res.status(404).json({ error: 'Repair not found' });
    }

    repair.repairOptions.push(newOption);
    await repair.save();
    res.status(201).json(repair.repairOptions[repair.repairOptions.length - 1]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});



// app.post('/appointments', async (req, res) => {
//   try {
//     const {
//       deviceType,
//       deviceName,
//       subtype,
//       subtypeName,
//       brand,
//       model,
//       services,
//       totalPrice,
//       customer,
//       appointment
//     } = req.body;

//     // Validate required fields
//     if (!deviceType || !brand || !model || !services || !customer || !appointment) {
//       return res.status(400).json({ message: 'Données manquantes' });
//     }

//     // Here you would typically save to a database
//     // For example, using MongoDB:
//     const newAppointment = new Appointment({
//       deviceType,
//       deviceName,
//       subtype,
//       subtypeName,
//       brand,
//       model,
//       services,
//       totalPrice,
//       customer,
//       appointment,
//       status: 'pending',
//       createdAt: new Date()
//     });
//     console.log("new appointment:", newAppointment)
//     const savedAppointment = await newAppointment.save();
    
//     res.status(201).json({
//       message: 'Rendez-vous créé avec succès',
//       appointment: savedAppointment
//     });

//   } catch (error) {
//     console.error('Erreur:', error);
//     res.status(500).json({ message: 'Erreur serveur' });
//   }
//   });



app.post('/api/appointments', async (req, res) => {
  
  try {
    const {
      deviceType,
      deviceName,
      subtype,
      subtypeName,
      brand,
      model,
      services,
      totalPrice,
      customer,
      appointment
    } = req.body;

    // Validate required fields
    if (!deviceType || !brand || !model || !services || !customer || !appointment) {
      return res.status(400).json({ message: 'Données manquantes' });
    }
    
    // Create new appointment document
    const newAppointment = new Appointment({
      deviceType,
      deviceName,
      subtype,
      subtypeName,
      brand,
      model,
      services,
      totalPrice,
      customer: {
        name: customer.name,
        firstName: customer.firstName,
        email: customer.email,
        phone: customer.phone || ''
      },
      appointment: {
        date: appointment.date,
        time: appointment.time
      }
      // status and createdAt will be set automatically
    });
    
    console.log("New appointment to be saved:", newAppointment);

    // Save to MongoDB
    const savedAppointment = await newAppointment.save();
   
    console.log("Appointment saved successfully:", savedAppointment);
    
    res.status(201).json({
      success: true,
      message: 'Rendez-vous créé avec succès',
      appointment: savedAppointment
    });

  } catch (error) {
    console.error('Erreur:', error);
    
    // Handle duplicate key errors
    if (error.name === 'MongoError' && error.code === 11000) {
      return res.status(400).json({ 
        success: false,
        message: 'Un rendez-vous avec ces informations existe déjà' 
      });
    }
    
    // Handle validation errors
    if (error.name === 'ValidationError') {
      const errors = {};
      Object.keys(error.errors).forEach(key => {
        errors[key] = error.errors[key].message;
      });
      return res.status(400).json({ 
        success: false,
        message: 'Erreur de validation',
        errors 
      });
    }
    
    res.status(500).json({ 
      success: false,
      message: 'Erreur serveur lors de la création du rendez-vous',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});



//-----------------------------------------------------------------------------------------------------------------------------------------------------------------

// Service templates data
const serviceTemplates = [
  { name: "Vitre + écran LCD compatible", cost: 159, description: "réparation en 1 heure en atelier. Garantie 3 mois." },
  { name: "Vitre + écran OLED similaire à l'original", cost: 259, description: "réparation en 1 heure en atelier. Garantie 3 mois." },
  { name: "Batterie", cost: 149, description: "réparation en 1 heure en atelier. Garantie 3 mois." },
  { name: "Connecteur de charge", cost: 159, description: "réparation en 1 heure en atelier. Garantie 3 mois." },
  { name: "Micro", cost: 159, description: "réparation en 1 heure en atelier. Garantie 3 mois." },
  { name: "Caméra avant", cost: 89, description: "réparation en 1 heure en atelier. Garantie 3 mois." },
  { name: "Caméra arrière", cost: 159, description: "réparation en 1 heure en atelier. Garantie 3 mois." },
  { name: "Vitre camera arrière", cost: 59, description: "réparation en 1 heure en atelier. Garantie 3 mois." },
  { name: "Vitre arrière", cost: 169, description: "réparation en 1 heure en atelier. Garantie 3 mois." },
  { name: "Bouton power", cost: 149, description: "réparation en 1 heure en atelier. Garantie 3 mois." },
  { name: "Bouton volume", cost: 149, description: "réparation en 1 heure en atelier. Garantie 3 mois." },
  { name: "Vibreur", cost: 79, description: "réparation en 1 heure en atelier. Garantie 3 mois." },
  { name: "Ecouteur Interne", cost: 79, description: "réparation en 1 heure en atelier. Garantie 3 mois." },
  { name: "Haut parleur", cost: 79, description: "réparation en 1 heure en atelier. Garantie 3 mois." },
  { name: "Nappe NFC", cost: 149, description: "réparation en 1 heure en atelier. Garantie 3 mois." },
  { name: "Lecteur sim", cost: null, description: "réparation en 1 heure en atelier. Garantie 3 mois." },
  { name: "Tiroir sim", cost: 10, description: "Sur commande en 24h-48h." },
  { name: "Desoxydation", cost: 49, description: "résultat en 24h-48h selon les dégâts." },
  { name: "Transfert de donnees", cost: 20, description: "" },
  { name: "Recuperation de donnees", cost: 30, description: "Forfait démontage de 20€ supplémentaires si l'appareil est endommagé ou non fonctionnel." },
  { name: "Recherche de panne", cost: 0, description: "Résultat sous 24h. Déductible des éventuelles réparations." }
];

// Endpoint to get service templates
app.get('/api/service-templates', (req, res) => {
  res.json(serviceTemplates);
});


// Start server
// mongoose.connect(MONGODB_URI, {
//   useNewUrlParser: true,
//   useUnifiedTopology: true,
//   retryWrites: true,
//   w: 'majority'
// })
// .then(() => {
//   app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
// })
// .catch(err => console.error('MongoDB connection error:', err));

module.exports = app;
