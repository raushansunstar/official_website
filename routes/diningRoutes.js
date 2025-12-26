import express from "express";
import {
    createDining,
    getDining,
    updateDining,
    deleteDining
} from "../controllers/diningController.js";

const router = express.Router();

/**
 * ADMIN – CREATE
 */
router.post("/", createDining);

/**
 * PUBLIC – READ
 */
router.get("/", getDining);

/**
 * ADMIN – UPDATE
 */
router.put("/:id", updateDining);

/**
 * ADMIN – DELETE
 */
router.delete("/:id", deleteDining);

export default router;
