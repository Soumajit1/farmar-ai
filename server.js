const express = require("express");
const cors = require("cors");

const db = require("./db");

// Routes
const authRoutes = require("./routes/auth");
const farmerRoutes = require("./routes/farmer");
const farmerProduceRoutes = require("./routes/farmer-produce");
const notificationRoutes = require("./routes/notifications");

const app = express();

// --------------------------------------------------
// Middleware
// --------------------------------------------------

app.use(cors());

// Parse JSON request bodies
app.use(express.json());

// Parse form-urlencoded request bodies
app.use(express.urlencoded({ extended: true }));

// --------------------------------------------------
// API Routes
// --------------------------------------------------

app.use("/api/auth", authRoutes);

app.use("/api/farmer", farmerRoutes);

app.use(
    "/api/farmer/produce",
    farmerProduceRoutes
);

app.use(
    "/api/notifications",
    notificationRoutes
);

// --------------------------------------------------
// Root route
// --------------------------------------------------

app.get("/", (req, res) => {
    res.json({
        message: "AgriLink AI Backend is running"
    });
});

// --------------------------------------------------
// Database test
// --------------------------------------------------

app.get("/api/test-db", (req, res) => {
    db.query(
        "SELECT 1 AS test",
        (err, results) => {

            if (err) {
                console.error(
                    "Database connection failed:",
                    err
                );

                return res.status(500).json({
                    error:
                        "Database connection failed"
                });
            }

            res.json({
                message:
                    "MySQL connected successfully",
                result: results
            });
        }
    );
});

// --------------------------------------------------
// Global error handler
// --------------------------------------------------

app.use((err, req, res, next) => {

    console.error(
        "Server error:",
        err
    );

    res.status(500).json({
        message: "Internal server error."
    });
});

// --------------------------------------------------
// Start server
// --------------------------------------------------

const PORT =
    process.env.PORT || 5000;

app.listen(PORT, () => {

    console.log(
        `AgriLink AI Backend running on http://localhost:${PORT}`
    );

});