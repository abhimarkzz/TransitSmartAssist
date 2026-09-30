import express from 'express';
import cors from 'cors';
import { config } from './config/env';
import { connectToDatabase, closeDatabaseConnection } from './config/db';
import apiRouter from './routes';
import { errorHandler } from './middleware/errorHandler';
import { changeStreamService } from './services/changeStreamService';
import { simulationService } from './services/simulationService';

const app = express();

// Middleware
app.use(cors({
  origin: '*', // Allow client connections
  credentials: true,
}));
app.use(express.json());

// API Routes
app.use('/api', apiRouter);

// Centralized Error Handler
app.use(errorHandler);

// Server Startup
async function startServer() {
  try {
    console.log('----------------------------------------------------');
    console.log('🚀 Starting TransitSmartAssist Backend Service...');
    console.log('----------------------------------------------------');

    await connectToDatabase();

    // Start MongoDB Change Streams listener
    await changeStreamService.start();

    // Start Real-time Transit Telemetry background simulator
    simulationService.start();

    const server = app.listen(config.port, () => {
      console.log(`[Server] TransitSmartAssist API listening on port ${config.port}`);
      console.log(`[Server] Environment: ${config.nodeEnv}`);
      console.log(`[Server] API Base URL: http://localhost:${config.port}/api`);
      console.log('----------------------------------------------------');
    });

    // Graceful Shutdown
    const shutdown = async (signal: string) => {
      console.log(`\n[Server] Received ${signal}. Gracefully shutting down...`);
      simulationService.stop();
      await changeStreamService.stop();
      server.close(async () => {
        await closeDatabaseConnection();
        console.log('[Server] Service terminated cleanly.');
        process.exit(0);
      });
    };

    process.on('SIGINT', () => shutdown('SIGINT'));
    process.on('SIGTERM', () => shutdown('SIGTERM'));

  } catch (err: any) {
    console.error('[Server] Fatal startup error:', err);
    process.exit(1);
  }
}

// Only start listening if executed directly (allows test runner to import app without binding port)
if (process.env.NODE_ENV !== 'test') {
  startServer();
}

export default app;
