const express = require('express');
const cors = require('cors');
const db = require('./db');

const authRoutes = require('./routes/auth');
const farmerRoutes = require('./routes/farmer');
const farmerProduceRoutes = require('./routes/farmer-produce');
const notificationRoutes = require('./routes/notifications');

const app = express();

app.use(cors());
app.use(express.json());

app.use('/api/auth', authRoutes);
app.use('/api/farmer', farmerRoutes);
app.use('/api/farmer/produce', farmerProduceRoutes);
app.use('/api/notifications', notificationRoutes);

app.get('/', (req, res) => {
    res.json({
        message: 'AgriLink AI Backend is running'
    });
});

app.get('/api/test-db', (req, res) => {
    db.query('SELECT 1 AS test', (err, results) => {
        if (err) {
            console.error('Database connection failed:', err);
            return res.status(500).json({
                error: 'Database connection failed'
            });
        }

        res.json({
            message: 'MySQL connected successfully',
            result: results
        });
    });
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
    console.log(`AgriLink AI Backend running on http://localhost:${PORT}`);
});
