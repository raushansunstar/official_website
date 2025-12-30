import mongoose from "mongoose";

const diningSchema = new mongoose.Schema(
    {
        hero: {
            heading: String,
            subheading: String,
            ctaText: String,
            backgroundImage: String
        },

        // 🔹 NEW INTRO SECTION
        introSection: {
            heading: String,
            description: String
        },

        cuisinesSection: {
            heading: String,
            items: [
                {
                    name: String,
                    description: String,
                    image: String
                }
            ]
        },

        breakfast: {
            heading: String,
            description: String,
            categories: [
                {
                    name: String,
                    image: String,
                    availableTime: String
                }
            ]
        },

        specialitiesSection: {
            heading: String,
            items: [
                {
                    title: String,
                    description: String,
                    icon: String
                }
            ]
        },

        chefSpecialsSection: {
            heading: String,
            items: [
                {
                    name: String,
                    description: String,
                    image: String,
                    price: Number
                }
            ]
        },

        featuredMenu: {
            heading: String,
            description: String,
            image: String,
            ctaText: String
        },

        chefsSection: {
            heading: String,
            items: [
                {
                    name: String,
                    experience: String,
                    rating: Number,
                    image: String
                }
            ]
        },

        ambienceSection: {
            heading: String,
            description: String,
            images: [
                {
                    image: String
                }
            ]
        },

        menuPdf: {
            type: String
        },

        isActive: {
            type: Boolean,
            default: true
        }
    },
    { timestamps: true }
);

export default mongoose.model("Dining", diningSchema);
