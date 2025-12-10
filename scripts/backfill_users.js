
import mongoose from 'mongoose';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import User from '../models/User.js';
import { Agent } from '../models/Agent.js';
import { syncUserToSheet } from '../utils/sheetSync.js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const connectDB = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('MongoDB Connected');
    } catch (err) {
        console.error('MongoDB connection error:', err);
        process.exit(1);
    }
};

const backfillUsers = async () => {
    await connectDB();

    try {
        // 1. Sync Users
        const users = await User.find({});
        console.log(`Found ${users.length} users to backfill.`);

        for (const [index, user] of users.entries()) {
            console.log(`Syncing user ${index + 1}/${users.length}: ${user.email}`);
            await syncUserToSheet(user);
            // Add a small delay to avoid hitting rate limits
            await new Promise(resolve => setTimeout(resolve, 500));
        }

        // 2. Sync Agents
        const agents = await Agent.find({});
        console.log(`Found ${agents.length} agents to backfill.`);

        for (const [index, agent] of agents.entries()) {
            console.log(`Syncing agent ${index + 1}/${agents.length}: ${agent.email}`);
            await syncUserToSheet(agent);
            // Add a small delay to avoid hitting rate limits
            await new Promise(resolve => setTimeout(resolve, 500));
        }

        console.log('Backfill completed successfully.');
    } catch (error) {
        console.error('Backfill error:', error);
    } finally {
        mongoose.connection.close();
        process.exit();
    }
};

backfillUsers();
