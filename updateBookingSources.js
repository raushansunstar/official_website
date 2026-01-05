/**
 * Script to update BookingSource for existing agent/corporate bookings
 * 
 * This fixes bookings made before the PaymentMethod.jsx fix was applied.
 * Run this script ONCE to update all existing bookings that are missing BookingSource.
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { Agent } from './models/Agent.js';
import getUserModel from './models/User.js';

dotenv.config();

const updateBookingSources = async () => {
    try {
        // Connect to MongoDB
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Connected to MongoDB');

        let updatedCount = 0;

        // Update Agent bookings
        const agents = await Agent.find({ bookingDetails: { $exists: true, $ne: [] } });
        console.log(`\n📋 Found ${agents.length} agents with bookings`);

        for (const agent of agents) {
            let hasUpdates = false;

            agent.bookingDetails.forEach(booking => {
                let updated = false;

                // 1. Update BookingSource if missing
                if (!booking.BookingSource || booking.BookingSource === "") {
                    if (agent.role && agent.role.toLowerCase().includes("corporate")) {
                        booking.BookingSource = "Corporate";
                    } else if (agent.role && agent.role.toLowerCase().includes("agent")) {
                        booking.BookingSource = "Agent";
                    }
                    updated = true;
                }

                // 2. Update BookedBy if missing or default "Regular"
                if (!booking.BookedBy || booking.BookedBy === "Regular") {
                    if (agent.role && agent.role.toLowerCase().includes("corporate")) {
                        booking.BookedBy = "Corporate";
                    } else if (agent.role && agent.role.toLowerCase().includes("agent")) {
                        booking.BookedBy = "Agent";
                    }
                    updated = true;
                }

                if (updated) {
                    hasUpdates = true;
                    console.log(`  ✨ Updated booking ${booking.ResNo} for ${agent.email} -> Source: ${booking.BookingSource}, BookedBy: ${booking.BookedBy}`);
                }
            });

            if (hasUpdates) {
                await agent.save();
                updatedCount++;
            }
        }

        // Also check User collection (in case agent data is stored there)
        const User = getUserModel;
        const users = await User.find({ bookingDetails: { $exists: true, $ne: [] } });
        console.log(`\n📋 Found ${users.length} users with bookings in User collection`);

        for (const user of users) {
            let hasUpdates = false;

            // Try to find if this user is actually an agent
            const agentRecord = await Agent.findOne({ email: user.email });

            if (agentRecord && agentRecord.role) {
                user.bookingDetails.forEach(booking => {
                    let updated = false;

                    // 1. Update BookingSource
                    if (!booking.BookingSource || booking.BookingSource === "") {
                        if (agentRecord.role.toLowerCase().includes("corporate")) {
                            booking.BookingSource = "Corporate";
                        } else if (agentRecord.role.toLowerCase().includes("agent")) {
                            booking.BookingSource = "Agent";
                        }
                        updated = true;
                    }

                    // 2. Update BookedBy
                    if (!booking.BookedBy || booking.BookedBy === "Regular") {
                        if (agentRecord.role.toLowerCase().includes("corporate")) {
                            booking.BookedBy = "Corporate";
                        } else if (agentRecord.role.toLowerCase().includes("agent")) {
                            booking.BookedBy = "Agent";
                        }
                        updated = true;
                    }

                    if (updated) {
                        hasUpdates = true;
                        console.log(`  ✨ Updated booking ${booking.ResNo} for ${user.email} -> Source: ${booking.BookingSource}, BookedBy: ${booking.BookedBy}`);
                    }
                });

                if (hasUpdates) {
                    await user.save();
                    updatedCount++;
                }
            }
        }

        console.log(`\n✅ Done! Updated ${updatedCount} user/agent records with missing BookingSource`);

    } catch (error) {
        console.error('❌ Error:', error);
    } finally {
        await mongoose.disconnect();
        console.log('👋 Disconnected from MongoDB');
    }
};

updateBookingSources();
