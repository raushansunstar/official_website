
import axios from 'axios';

// Configuration
const API_URL = 'http://localhost:5000/api'; // Adjust port if needed
const PAGE_NAME = 'dining';

// Data to Insert
const faqs = [
    {
        question: "What type of cuisines do you serve?",
        answer: "We offer a diverse range of cuisines including Indian, Continental, Chinese, and regional specialties to cater to every palate.",
        page: PAGE_NAME
    },
    {
        question: "Is there a dress code for the dining area?",
        answer: "We recommend smart casuals. However, we want you to be comfortable while you enjoy your meal.",
        page: PAGE_NAME
    },
    {
        question: "Do you offer vegan and gluten-free options?",
        answer: "Yes, we have a dedicated selection of vegan and gluten-free dishes. Please inform our staff of any dietary restrictions.",
        page: PAGE_NAME
    },
    {
        question: "Do I need to make a reservation?",
        answer: "While walk-ins are welcome, we highly recommend making a reservation, especially for dinner and weekends, to avoid waiting.",
        page: PAGE_NAME
    },
    {
        question: "Do you serve alcohol?",
        answer: "Yes, we have a fully stocked bar with a wide selection of wines, spirits, and cocktails to complement your meal.",
        page: PAGE_NAME
    },
    {
        question: "Is the restaurant child-friendly?",
        answer: "Absolutely! We have a special kid's menu and high chairs available for our younger guests.",
        page: PAGE_NAME
    },
    {
        question: "Do you offer private dining experiences?",
        answer: "Yes, we have private dining rooms perfect for intimate gatherings, business meetings, or special celebrations.",
        page: PAGE_NAME
    },
    {
        question: "What are your operating hours?",
        answer: "Our restaurant is open for breakfast from 7:00 AM to 10:30 AM, lunch from 12:30 PM to 3:30 PM, and dinner from 7:00 PM to 11:00 PM.",
        page: PAGE_NAME
    },
    {
        question: "Do you provide room service?",
        answer: "Yes, 24-hour in-room dining is available for all hotel guests with a comprehensive menu.",
        page: PAGE_NAME
    },
    {
        question: "Can you accommodate large groups?",
        answer: "Yes, we can accommodate large groups. For parties larger than 10, please contact us in advance to arrange suitable seating.",
        page: PAGE_NAME
    }
];

const testimonials = [
    {
        heading: "A Culinary Delight",
        name: "Aarav Patel",
        location: "Mumbai",
        description: "The food was absolutely outstanding! Every dish was bursting with flavor and clearly made with high-quality ingredients. A must-visit.",
        page: PAGE_NAME
    },
    {
        heading: "Excellent Service",
        name: "Sarah Jenkins",
        location: "UK",
        description: "The staff went above and beyond to ensure we had a great evening. They were attentive, polite, and very knowledgeable about the menu.",
        page: PAGE_NAME
    },
    {
        heading: "Perfect Ambience",
        name: "Rahul Sharma",
        location: "Delhi",
        description: "The ambience is just perfect for a romantic dinner. Soft lighting, great music, and comfortable seating made our anniversary special.",
        page: PAGE_NAME
    },
    {
        heading: "Best Breakfast Buffet",
        name: "Emily Clark",
        location: "USA",
        description: "The breakfast spread is huge! From fresh fruits to live dosa counters, they have it all. Everything was fresh and delicious.",
        page: PAGE_NAME
    },
    {
        heading: "Great for Families",
        name: "Vikram Singh",
        location: "Jaipur",
        description: "We went with our two kids and they loved the food. The staff was very accommodating with our requests for less spicy food for the children.",
        page: PAGE_NAME
    },
    {
        heading: "Authentic Flavors",
        name: "Priya Gupta",
        location: "Bangalore",
        description: "I was looking for authentic local cuisine and Sunstar delivered. The traditional dishes were cooked to perfection.",
        page: PAGE_NAME
    },
    {
        heading: "Wonderful Experience",
        name: "David Ross",
        location: "Australia",
        description: "A truly 5-star dining experience. The chef even came out to check on us. Highly recommended for anyone visiting the city.",
        page: PAGE_NAME
    },
    {
        heading: "Delicious Vegan Options",
        name: "Sneha Reddy",
        location: "Hyderabad",
        description: "It's hard to find good vegan options, but their menu surprised me. The vegan curry was one of the best I've ever had.",
        page: PAGE_NAME
    },
    {
        heading: "Top Notch Hospitality",
        name: "Mohit Verma",
        location: "Chandigarh",
        description: "From the moment we walked in, we felt welcomed. The hospitality at Sunstar is unmatched. Will definitely come back.",
        page: PAGE_NAME
    },
    {
        heading: "Memorable Evening",
        name: "Anjali Mehta",
        location: "Pune",
        description: "Everything from the appetizers to the dessert was flawless. The presentation was beautiful and the taste was divine.",
        page: PAGE_NAME
    }
];

async function seedData() {
    console.log('Starting seed...');

    // 1. Insert FAQs
    try {
        console.log('Seeding FAQs...');
        // Correct Endpoint: /api/faqs/add-multiple
        const response = await axios.post(`${API_URL}/faqs/add-multiple`, faqs);
        console.log(`Added ${faqs.length} FAQs successfully.`);
    } catch (err) {
        console.error('Error seeding FAQs:', err.response?.data || err.message);
    }

    // 2. Insert Testimonials
    try {
        console.log('Seeding Testimonials...');
        // Correct Endpoint: /api/testimonials/bulk
        const response = await axios.post(`${API_URL}/testimonials/bulk`, testimonials);
        console.log(`Added ${testimonials.length} Testimonials successfully.`);
    } catch (err) {
        console.error('Error seeding Testimonials:', err.response?.data || err.message);
    }

    console.log('Seeding complete.');
}

seedData();
