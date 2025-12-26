import Dining from "../models/Dining.js";

/**
 * CREATE Dining Page
 */
export const createDining = async (req, res) => {
    try {
        const exists = await Dining.findOne();
        if (exists) {
            return res.status(400).json({
                success: false,
                message: "Dining page already exists"
            });
        }

        const dining = await Dining.create(req.body);

        res.status(201).json({
            success: true,
            message: "Dining page created",
            data: dining
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
};

/**
 * READ Dining Page
 */
export const getDining = async (req, res) => {
    try {
        const dining = await Dining.findOne({ isActive: true });

        if (!dining) {
            return res.status(404).json({
                success: false,
                message: "Dining page not found"
            });
        }

        res.status(200).json({
            success: true,
            data: dining
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
};

/**
 * UPDATE Dining Page
 */
export const updateDining = async (req, res) => {
    try {
        const dining = await Dining.findByIdAndUpdate(
            req.params.id,
            req.body,
            { new: true }
        );

        if (!dining) {
            return res.status(404).json({
                success: false,
                message: "Dining page not found"
            });
        }

        res.status(200).json({
            success: true,
            message: "Dining page updated",
            data: dining
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
};

/**
 * DELETE Dining Page
 */
export const deleteDining = async (req, res) => {
    try {
        const dining = await Dining.findByIdAndDelete(req.params.id);

        if (!dining) {
            return res.status(404).json({
                success: false,
                message: "Dining page not found"
            });
        }

        res.status(200).json({
            success: true,
            message: "Dining page deleted"
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
};
