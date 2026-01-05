/**
 * Migration Script: Add BookedBy field to existing bookings
 * 
 * This updates all existing bookings in the database to have the correct BookedBy value
 * based on the user's role in the Agent collection.
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { Agent } from './models/Agent.js';
import getUserModel from './models/User.js';

dotenv.config();

const migrateBookedByField = async () => {
    try {
        // Connect to MongoDB
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Connected to MongoDB');

        let updatedCount = 0;
        let bookingsUpdated = 0;

        // Update Agent collection bookings
        const agents = await Agent.find({ bookingDetails: { $exists: true, $ne: [] } });
        console.log(`\n📋 Found ${agents.length} agents with bookings`);

        for (const agent of agents) {
            let hasUpdates = false;

            agent.bookingDetails.forEach(booking => {
                // Set BookedBy based on agent role if not already set
                if (!booking.BookedBy || booking.BookedBy === "Regular") {
                    if (agent.role && agent.role.toLowerCase().includes("corporate")) {
                        booking.BookedBy = "Corporate";
                    } else if (agent.role && agent.role.toLowerCase().includes("agent")) {
                        booking.BookedBy = "Agent";
                    }
                    hasUpdates = true;
                    bookingsUpdated++;
                    console.log(`  ✨ Updated booking ${booking.ResNo} for ${agent.email} → BookedBy: ${booking.BookedBy}`);
                }
            });

            if (hasUpdates) {
                await agent.save();
                updatedCount++;
            }
        }

        // Update User collection bookings
        const User = getUserModel;
        const users = await User.find({ bookingDetails: { $exists: true, $ne: [] } });
        console.log(`\n📋 Found ${users.length} users with bookings in User collection`);

        for (const user of users) {
            let hasUpdates = false;

            // Check if this user is an agent/corporate
            const agentRecord = await Agent.findOne({ email: user.email });

            if (agentRecord && agentRecord.role) {
                // User is an agent/corporate
                user.bookingDetails.forEach(booking => {
                    if (!booking.BookedBy || booking.BookedBy === "Regular") {
                        if (agentRecord.role.toLowerCase().includes("corporate")) {
                            booking.BookedBy = "Corporate";
                        } else if (agentRecord.role.toLowerCase().includes("agent")) {
                            booking.BookedBy = "Agent";
                        }
                        hasUpdates = true;
                        bookingsUpdated++;
                        console.log(`  ✨ Updated booking ${booking.ResNo} for ${user.email} → BookedBy: ${booking.BookedBy}`);
                    }
                });
            } else {
                // Regular user - set to "Regular"
                user.bookingDetails.forEach(booking => {
                    if (!booking.BookedBy) {
                        booking.BookedBy = "Regular";
                        hasUpdates = true;
                        bookingsUpdated++;
                        console.log(`  ✨ Updated booking ${booking.ResNo} for ${user.email} → BookedBy: Regular`);
                    }
                });
            }

            if (hasUpdates) {
                await user.save();
                updatedCount++;
            }
        }

        console.log(`\n✅ Migration Complete!`);
        console.log(`   Updated ${updatedCount} user/agent records`);
        console.log(`   Total bookings updated: ${bookingsUpdated}`);

    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        await mongoose.disconnect();
        console.log('👋 Disconnected from MongoDB');
    }
};

migrateBookedByField();
