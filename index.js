require('dotenv').config();
const { MongoClient, ServerApiVersion } = require('mongodb');
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const jwt = require('jsonwebtoken');
const connectDB = require('./config/db');

// Import routes
// const authRoutes = require('./routes/authRoutes');
// const carRoutes = require('./routes/carRoutes');
// const bookingRoutes = require('./routes/bookingRoutes');

const app = express();

// Connect to MongoDB
// connectDB();



const uri = process.env.MONGODB_URI;
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {
    //await client.connect();
   // await client.db("admin").command({ ping: 1 });
    console.log("Pinged your deployment. You successfully connected to MongoDB!");

    const db = client.db('driverfleetdb');
    const carsCollection = db.collection('cars');
    const bookingsCollection = db.collection('bookings');

    // Middleware
    app.use(cors({
      origin: [
        'http://localhost:5173', 
        'http://localhost:3000',
        'https://client-iota-henna.vercel.app'
      ],
      credentials: true
    }));
    app.use(express.json());
    app.use(cookieParser());

    // Custom Middleware for JWT verification
    const verifyToken = (req, res, next) => {
      const token = req.cookies?.token;
      if (!token) {
        return res.status(401).json({ error: 'Unauthorized access' });
      }
      jwt.verify(token, process.env.JWT_SECRET || 'secret123', (err, decoded) => {
        if (err) {
          return res.status(401).json({ error: 'Unauthorized access' });
        }
        req.user = decoded;
        next();
      });
    };

    // --- AUTH ROUTES ---
    app.post('/api/jwt', async (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.JWT_SECRET || 'secret123', { expiresIn: '1d' });
      res.cookie('token', token, {
        httpOnly: true,
        secure: true,
        sameSite: 'none',
      }).send({ success: true });
    });

    app.post('/api/logout', async (req, res) => {
      res.clearCookie('token', {
        httpOnly: true,
        secure: true,
        sameSite: 'none',
        maxAge: 0
      }).json({ success: true });
    });

    // --- CAR ROUTES ---

    // 1. Add Car
    app.post('/api/cars', verifyToken, async (req, res) => {
      try {
        const carData = req.body;
        // include addedAt
        carData.addedAt = new Date();
        const result = await carsCollection.insertOne(carData);
        res.status(201).json({ success: true, result });
      } catch (error) {
        res.status(500).json({ error: 'Failed to add car' });
      }
    });

    // 2. Get All Cars (Explore)
    app.get('/api/cars', async (req, res) => {
      try {
        const { search, type } = req.query;
        let query = {};
        
        if (search) {
          query.name = { $regex: search, $options: 'i' };
        }
        if (type && type !== 'All' && type !== '') {
          query.type = type;
        }

        const cars = await carsCollection.find(query).sort({ addedAt: -1 }).toArray();
        res.status(200).json(cars);
      } catch (error) {
        res.status(500).json({ error: 'Failed to fetch cars' });
      }
    });

    // 3. Get Single Car
    app.get('/api/cars/:id', async (req, res) => {
      try {
        const { ObjectId } = require('mongodb');
        const id = req.params.id;
        const car = await carsCollection.findOne({ _id: new ObjectId(id) });
        if (!car) return res.status(404).json({ error: 'Car not found' });
        res.status(200).json(car);
      } catch (error) {
        res.status(500).json({ error: 'Failed to fetch car' });
      }
    });

    // 4. Get My Added Cars
    app.get('/api/my-cars', verifyToken, async (req, res) => {
      try {
        const email = req.query.email;
        if (req.user.email !== email) {
          return res.status(403).json({ error: 'Forbidden access' });
        }
        if (!email) return res.status(400).json({ error: 'Email required' });
        const myCars = await carsCollection.find({ userEmail: email }).sort({ addedAt: -1 }).toArray();
        res.status(200).json(myCars);
      } catch (error) {
        res.status(500).json({ error: 'Failed to fetch my cars' });
      }
    });

    // 5. Update Car
    app.put('/api/cars/:id', verifyToken, async (req, res) => {
      try {
        const { ObjectId } = require('mongodb');
        const id = req.params.id;
        const updatedData = req.body;
        delete updatedData._id; // prevent _id modification
        const result = await carsCollection.updateOne(
          { _id: new ObjectId(id) },
          { $set: updatedData }
        );
        res.status(200).json({ success: true, result });
      } catch (error) {
        res.status(500).json({ error: 'Failed to update car' });
      }
    });

    // 6. Delete Car
    app.delete('/api/cars/:id', verifyToken, async (req, res) => {
      try {
        const { ObjectId } = require('mongodb');
        const id = req.params.id;
        const result = await carsCollection.deleteOne({ _id: new ObjectId(id) });
        res.status(200).json({ success: true, result });
      } catch (error) {
        res.status(500).json({ error: 'Failed to delete car' });
      }
    });

    // --- BOOKING ROUTES ---

    // 1. Book a Car
    app.post('/api/bookings', verifyToken, async (req, res) => {
      try {
        const bookingData = req.body;
        bookingData.bookingDate = new Date();
        const result = await bookingsCollection.insertOne(bookingData);
        
        // Increase bookingCount after booking
        const { ObjectId } = require('mongodb');
        await carsCollection.updateOne(
          { _id: new ObjectId(bookingData.carId) },
          { $inc: { bookingCount: 1 } }
        );

        res.status(201).json({ success: true, result });
      } catch (error) {
        res.status(500).json({ error: 'Failed to book car' });
      }
    });

    // 2. Get My Bookings
    app.get('/api/my-bookings', verifyToken, async (req, res) => {
      try {
        const email = req.query.email;
        if (req.user.email !== email) {
          return res.status(403).json({ error: 'Forbidden access' });
        }
        if (!email) return res.status(400).json({ error: 'Email required' });
        const myBookings = await bookingsCollection.find({ userEmail: email }).sort({ bookingDate: -1 }).toArray();
        res.status(200).json(myBookings);
      } catch (error) {
        res.status(500).json({ error: 'Failed to fetch bookings' });
      }
    });

    // 3. Cancel Booking
    app.delete('/api/bookings/:id', verifyToken, async (req, res) => {
      try {
        const { ObjectId } = require('mongodb');
        const id = req.params.id;
        const result = await bookingsCollection.deleteOne({ _id: new ObjectId(id) });
        res.status(200).json({ success: true, result });
      } catch (error) {
        res.status(500).json({ error: 'Failed to cancel booking' });
      }
    });
    app.get('/', (req, res) => {
      res.send('DriveFleet API is running');
    });

    const PORT = process.env.PORT || 5000;
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });

  } catch (err) {
    console.error(err);
  }
}
run().catch(console.dir);
