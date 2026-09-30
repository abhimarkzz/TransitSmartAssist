import dotenv from 'dotenv';
import path from 'path';

// Load .env from server directory or root
dotenv.config();
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

export const config = {
  port: parseInt(process.env.PORT || '5000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  mongodbUri: process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/transit_smart_assist?replicaSet=rs0&directConnection=true',
  mongodbDbName: process.env.MONGODB_DB_NAME || 'transit_smart_assist',
  jwtSecret: process.env.JWT_SECRET || 'transitsmartassist_super_secret_jwt_key_2025',
  geminiApiKey: process.env.GEMINI_API_KEY || '',
  clientUrl: process.env.CLIENT_URL || 'http://localhost:3000',
};
