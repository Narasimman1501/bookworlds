import express from 'express';
import dotenv from 'dotenv';
import cors, { CorsOptions } from 'cors';
import morgan from 'morgan';
import connectDB from './config/db';
import authRoutes from './routes/auth';
import listRoutes from './routes/lists';

dotenv.config();

// Connect to the database
connectDB();

const app = express();

// --------------------------------------
// CORS FIX (FULLY CORRECTED)
// --------------------------------------
const allowedOrigins = [
  'http://localhost:3000',
  'https://bookworlds.vercel.app',
];

const corsOptions: CorsOptions = {
  origin: (origin, callback) => {
    // Allow non-browser tools with no origin (Postman, curl)
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      console.log("❌ CORS blocked origin:", origin);
      callback(new Error("Not allowed by CORS"));
    }
  },
  credentials: true, // required if using cookies or auth headers
};

app.use(cors(corsOptions));

// --------------------------------------
// Middleware
// --------------------------------------
app.use(express.json());
app.use(morgan('dev'));

// --------------------------------------
// Routes
// --------------------------------------
app.use('/api/auth', authRoutes);
app.use('/api/lists', listRoutes);

// --------------------------------------
// Start Server
// --------------------------------------
const PORT = process.env.PORT || 5000;

app.listen(PORT, () =>
  console.log(`✅ Server running on port ${PORT}`)
);
