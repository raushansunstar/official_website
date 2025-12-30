// src/routes/agentRoutes.js
import { Router } from "express";
import { body, param, query } from "express-validator";
import {
  loginAgent, approveAgent, listAgents, verifyAgentOtp,
  deleteAgent, updateCommission, updateEarnings
} from "../controllers/agentController.js";
import { getAgentByEmail, ROLES_ENUM } from "../models/Agent.js";

const router = Router();

// login -> sends OTP
router.post(
  "/login",
  [
    body("email").isEmail().withMessage("Valid email required"),
    body("phone").isLength({ min: 7 }).withMessage("Phone required"),
    body("name").isLength({ min: 2 }).withMessage("Name required"),
    body("role").isIn(ROLES_ENUM).withMessage(`role must be one of: ${ROLES_ENUM.join(", ")}`)
  ],
  loginAgent
);

// verify OTP
router.post(
  "/verify-otp",
  [
    body("email").isEmail().withMessage("Valid email required"),
    body("otp").isLength({ min: 6, max: 6 }).withMessage("6-digit OTP required")
  ],
  verifyAgentOtp
);

router.get("/by-email", [query("email").isEmail().withMessage("Valid email required")], getAgentByEmail);
router.post("/:id/approve", approveAgent);
router.get("/", listAgents);


router.delete(
  "/:id",
  [param("id").isString().withMessage("Valid id required")],
  deleteAgent
);

// Update commission rate
router.patch(
  "/:id/commission",
  [
    param("id").isString().withMessage("Valid id required"),
    body("commissionRate").isFloat({ min: 0, max: 1 }).withMessage("Commission rate must be between 0 and 1")
  ],
  updateCommission
);

// Update earnings for agent/corporate (set from frontend)
router.post(
  "/update-earnings/:email",
  updateEarnings
);


export default router;
