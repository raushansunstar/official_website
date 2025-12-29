import mongoose from 'mongoose';

const digitalAssetSchema = new mongoose.Schema({
    title: {
        type: String,
        required: true,
        trim: true
    },
    description: {
        type: String,
        trim: true
    },
    fileUrl: {
        type: String,
        required: true
    },
    fileType: {
        type: String,
        enum: ['pdf', 'image', 'video', 'document', 'other'],
        default: 'other'
    },
    category: {
        type: String,
        enum: ['brochure', 'policy', 'brand_material', 'other'],
        default: 'other'
    },
    targetUserType: {
        type: String,
        enum: ['both', 'agent', 'corporate'],
        default: 'both'
    },
    isActive: {
        type: Boolean,
        default: true
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

const DigitalAsset = mongoose.model('DigitalAsset', digitalAssetSchema);
export default DigitalAsset;
