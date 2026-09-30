import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { ObjectId } from 'mongodb';
import { getDb } from '../config/db';
import { config } from '../config/env';
import { AuthRequest } from '../middleware/auth';
import { UserRole } from '../models/types';

export async function login(req: Request, res: Response): Promise<void> {
  const { email, password } = req.body;
  if (!email || !password) {
    res.status(400).json({ success: false, error: 'Email and password are required.' });
    return;
  }

  const db = getDb();
  const user = await db.collection('users').findOne({ email: email.toLowerCase().trim() });

  if (!user) {
    res.status(401).json({ success: false, error: 'Invalid email or password.' });
    return;
  }

  const isMatch = await bcrypt.compare(password, user.password);
  if (!isMatch) {
    res.status(401).json({ success: false, error: 'Invalid email or password.' });
    return;
  }

  const token = jwt.sign(
    {
      userId: user._id.toString(),
      email: user.email,
      role: user.role,
      name: user.name,
    },
    config.jwtSecret,
    { expiresIn: '7d' }
  );

  res.json({
    success: true,
    token,
    user: {
      id: user._id.toString(),
      name: user.name,
      email: user.email,
      role: user.role,
      preferences: user.preferences,
      travelStats: user.travelStats,
    },
  });
}

export async function demoLogin(req: Request, res: Response): Promise<void> {
  const role: UserRole = req.body.role === 'admin' ? 'admin' : 'commuter';
  const email = role === 'admin' ? 'admin@transit.demo' : 'commuter@transit.demo';

  const db = getDb();
  let user = await db.collection('users').findOne({ email });

  if (!user) {
    // If not seeded yet, find any user with that role
    user = await db.collection('users').findOne({ role });
  }

  if (!user) {
    res.status(404).json({ success: false, error: 'Demo user not found. Please run seed script first.' });
    return;
  }

  const token = jwt.sign(
    {
      userId: user._id.toString(),
      email: user.email,
      role: user.role,
      name: user.name,
    },
    config.jwtSecret,
    { expiresIn: '7d' }
  );

  res.json({
    success: true,
    token,
    user: {
      id: user._id.toString(),
      name: user.name,
      email: user.email,
      role: user.role,
      preferences: user.preferences,
      travelStats: user.travelStats,
    },
  });
}

export async function register(req: Request, res: Response): Promise<void> {
  const { name, email, password } = req.body;
  if (!name || !email || !password) {
    res.status(400).json({ success: false, error: 'Name, email, and password are required.' });
    return;
  }

  const db = getDb();
  const existing = await db.collection('users').findOne({ email: email.toLowerCase().trim() });
  if (existing) {
    res.status(400).json({ success: false, error: 'User with this email already exists.' });
    return;
  }

  const passwordHash = await bcrypt.hash(password, 10);
  const newUser = {
    name,
    email: email.toLowerCase().trim(),
    password: passwordHash,
    role: 'commuter' as UserRole,
    preferences: {
      avoidCrowds: true,
      lessWalking: true,
      fewerTransfers: false,
      fasterTravel: true,
      preferReliable: true,
      accessibleRoute: false,
      maxWalkDistanceMeters: 800,
    },
    travelStats: {
      tripsSaved: 0,
      routesUsed: [],
      totalDistanceKm: 0,
      carbonSavedKg: 0,
      lastActive: new Date(),
    },
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const insertResult = await db.collection('users').insertOne(newUser);
  const token = jwt.sign(
    {
      userId: insertResult.insertedId.toString(),
      email: newUser.email,
      role: newUser.role,
      name: newUser.name,
    },
    config.jwtSecret,
    { expiresIn: '7d' }
  );

  res.status(201).json({
    success: true,
    token,
    user: {
      id: insertResult.insertedId.toString(),
      name: newUser.name,
      email: newUser.email,
      role: newUser.role,
      preferences: newUser.preferences,
      travelStats: newUser.travelStats,
    },
  });
}

export async function getProfile(req: AuthRequest, res: Response): Promise<void> {
  if (!req.user) {
    res.status(401).json({ success: false, error: 'Unauthorized.' });
    return;
  }

  const db = getDb();
  const user = await db.collection('users').findOne(
    { _id: new ObjectId(req.user.userId) },
    { projection: { password: 0 } }
  );

  if (!user) {
    res.status(404).json({ success: false, error: 'User not found.' });
    return;
  }

  res.json({
    success: true,
    user: {
      id: user._id.toString(),
      name: user.name,
      email: user.email,
      role: user.role,
      preferences: user.preferences,
      travelStats: user.travelStats,
    },
  });
}

export async function updatePreferences(req: AuthRequest, res: Response): Promise<void> {
  if (!req.user) {
    res.status(401).json({ success: false, error: 'Unauthorized.' });
    return;
  }

  const preferences = req.body;
  const db = getDb();

  await db.collection('users').updateOne(
    { _id: new ObjectId(req.user.userId) },
    {
      $set: {
        preferences: {
          avoidCrowds: !!preferences.avoidCrowds,
          lessWalking: !!preferences.lessWalking,
          fewerTransfers: !!preferences.fewerTransfers,
          fasterTravel: !!preferences.fasterTravel,
          preferReliable: !!preferences.preferReliable,
          accessibleRoute: !!preferences.accessibleRoute,
          maxWalkDistanceMeters: preferences.maxWalkDistanceMeters || 800,
        },
        updatedAt: new Date(),
      },
    }
  );

  res.json({
    success: true,
    message: 'Commuter preferences saved to MongoDB successfully.',
    preferences,
  });
}
