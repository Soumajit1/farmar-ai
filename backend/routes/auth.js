const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");

const db = require("../db");

const router = express.Router();

// --------------------------------------------------
// POST /api/auth/login
// --------------------------------------------------

router.post("/login", async (req, res) => {
    try {
        console.log("LOGIN REQUEST BODY:", {
            email: req.body?.email,
            identifier: req.body?.identifier,
            role: req.body?.role,
            password: req.body?.password
                ? "provided"
                : "missing"
        });

        // Accept both email and identifier
        const email =
            req.body?.email ||
            req.body?.identifier;

        const password =
            req.body?.password;

        const role =
            req.body?.role;

        // --------------------------------------------------
        // Validate input
        // --------------------------------------------------

        if (!email || !password || !role) {
            return res.status(400).json({
                message:
                    "Email, password and role are required."
            });
        }

        // --------------------------------------------------
        // Allowed roles
        // --------------------------------------------------

        const allowedRoles = [
            "farmer",
            "buyer",
            "fpo",
            "admin"
        ];

        if (!allowedRoles.includes(role)) {
            return res.status(400).json({
                message:
                    "Invalid user role."
            });
        }

        // --------------------------------------------------
        // Find user
        // --------------------------------------------------

        const sql = `
            SELECT
                id,
                name,
                email,
                password,
                role
            FROM users
            WHERE email = ?
            LIMIT 1
        `;

        db.query(
            sql,
            [email],
            async (err, results) => {

                if (err) {
                    console.error(
                        "Login database error:",
                        err
                    );

                    return res.status(500).json({
                        message:
                            "Database error during login."
                    });
                }

                // --------------------------------------------------
                // User not found
                // --------------------------------------------------

                if (
                    !results ||
                    results.length === 0
                ) {
                    return res.status(401).json({
                        message:
                            "Invalid email or password."
                    });
                }

                const user = results[0];

                // --------------------------------------------------
                // Check selected role
                // --------------------------------------------------

                if (user.role !== role) {
                    return res.status(403).json({
                        message:
                            "This account does not have the selected role."
                    });
                }

                // --------------------------------------------------
                // Check password
                // --------------------------------------------------

                try {
                    const passwordMatch =
                        await bcrypt.compare(
                            password,
                            user.password
                        );

                    if (!passwordMatch) {
                        return res.status(401).json({
                            message:
                                "Invalid email or password."
                        });
                    }

                } catch (passwordError) {
                    console.error(
                        "Password comparison error:",
                        passwordError
                    );

                    return res.status(500).json({
                        message:
                            "Password verification failed."
                    });
                }

                // --------------------------------------------------
                // JWT secret
                // --------------------------------------------------

                const JWT_SECRET =
                    process.env.JWT_SECRET ||
                    "agrilink-development-secret";

                // --------------------------------------------------
                // Create JWT token
                // --------------------------------------------------

                const token = jwt.sign(
                    {
                        id: user.id,
                        email: user.email,
                        role: user.role
                    },
                    JWT_SECRET,
                    {
                        expiresIn: "7d"
                    }
                );

                // --------------------------------------------------
                // Successful login
                // --------------------------------------------------

                return res.status(200).json({
                    message:
                        "Login successful.",

                    token,

                    user: {
                        id: user.id,
                        name: user.name,
                        email: user.email,
                        role: user.role
                    }
                });
            }
        );

    } catch (error) {

        console.error(
            "Login route error:",
            error
        );

        return res.status(500).json({
            message:
                "Internal server error during login."
        });
    }
});

// --------------------------------------------------
// Export router
// --------------------------------------------------

module.exports = router;