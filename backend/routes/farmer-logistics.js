const express = require('express');
const router = express.Router();
const db = require('../db');

// =====================================================
// HELPER
// =====================================================

function query(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.query(sql, params, (err, results) => {
            if (err) {
                reject(err);
            } else {
                resolve(results);
            }
        });
    });
}

// =====================================================
// GET ALL SHIPMENTS FOR A FARMER
// =====================================================

router.get('/:farmerId', async (req, res) => {
    try {
        const farmerId = Number(req.params.farmerId);

        if (!Number.isInteger(farmerId) || farmerId <= 0) {
            return res.status(400).json({
                error: 'Invalid farmer ID'
            });
        }

        const sql = `
            SELECT
                s.id,
                s.transaction_id,

                s.pickup_location,
                s.delivery_location,

                s.transporter,
                s.tracking_number,
                s.status,
                s.estimated_delivery,
                s.created_at,

                t.amount AS transaction_amount,
                t.quantity AS transaction_quantity,
                t.status AS transaction_status,
                t.transaction_date,

                o.offered_price,
                o.buyer_offer_price,
                o.counter_price,
                o.final_price,

                p.crop_name,
                p.unit,
                p.quality,

                u.name AS buyer_name,
                u.email AS buyer_email

            FROM shipments s

            INNER JOIN transactions t
                ON s.transaction_id = t.id

            INNER JOIN offers o
                ON t.offer_id = o.id

            INNER JOIN produce_listings p
                ON o.produce_id = p.id

            INNER JOIN users u
                ON t.buyer_id = u.id

            WHERE t.farmer_id = ?

            ORDER BY s.created_at DESC
        `;

        const shipments = await query(sql, [farmerId]);

        return res.json({
            shipments
        });

    } catch (error) {
        console.error(
            'Get farmer shipments error:',
            error
        );

        return res.status(500).json({
            error: 'Failed to load shipments',
            details: error.message,
            code: error.code
        });
    }
});

// =====================================================
// GET SHIPMENT STATISTICS
// =====================================================

router.get('/:farmerId/stats', async (req, res) => {
    try {
        const farmerId = Number(req.params.farmerId);

        if (!Number.isInteger(farmerId) || farmerId <= 0) {
            return res.status(400).json({
                error: 'Invalid farmer ID'
            });
        }

        const sql = `
            SELECT
                COUNT(*) AS total,

                SUM(
                    CASE
                        WHEN s.status = 'pending'
                        THEN 1
                        ELSE 0
                    END
                ) AS pending,

                SUM(
                    CASE
                        WHEN s.status = 'in_transit'
                        THEN 1
                        ELSE 0
                    END
                ) AS in_transit,

                SUM(
                    CASE
                        WHEN s.status = 'delivered'
                        THEN 1
                        ELSE 0
                    END
                ) AS delivered,

                SUM(
                    CASE
                        WHEN s.status = 'cancelled'
                        THEN 1
                        ELSE 0
                    END
                ) AS cancelled

            FROM shipments s

            INNER JOIN transactions t
                ON s.transaction_id = t.id

            WHERE t.farmer_id = ?
        `;

        const results = await query(sql, [farmerId]);

        const stats = results[0] || {};

        return res.json({
            total: Number(stats.total || 0),
            pending: Number(stats.pending || 0),
            in_transit: Number(stats.in_transit || 0),
            delivered: Number(stats.delivered || 0),
            cancelled: Number(stats.cancelled || 0)
        });

    } catch (error) {
        console.error(
            'Get logistics stats error:',
            error
        );

        return res.status(500).json({
            error: 'Failed to load logistics statistics',
            details: error.message,
            code: error.code
        });
    }
});

// =====================================================
// CREATE SHIPMENT
// =====================================================

router.post('/create', async (req, res) => {
    try {
        const {
            transaction_id,
            pickup_location,
            delivery_location,
            transporter,
            tracking_number,
            estimated_delivery
        } = req.body;

        const transactionId = Number(transaction_id);

        if (
            !Number.isInteger(transactionId) ||
            transactionId <= 0
        ) {
            return res.status(400).json({
                error: 'Valid transaction ID is required'
            });
        }

        if (!pickup_location || !String(pickup_location).trim()) {
            return res.status(400).json({
                error: 'Pickup location is required'
            });
        }

        if (!delivery_location || !String(delivery_location).trim()) {
            return res.status(400).json({
                error: 'Delivery location is required'
            });
        }

        // -------------------------------------------------
        // CHECK TRANSACTION
        // -------------------------------------------------

        const transactions = await query(
            `
            SELECT
                id,
                farmer_id,
                buyer_id,
                status
            FROM transactions
            WHERE id = ?
            LIMIT 1
            `,
            [transactionId]
        );

        if (transactions.length === 0) {
            return res.status(404).json({
                error: 'Transaction not found'
            });
        }

        const transaction = transactions[0];

        if (
            transaction.status !== 'completed' &&
            transaction.status !== 'pending'
        ) {
            return res.status(400).json({
                error:
                    'Shipment cannot be created for this transaction',
                status:
                    transaction.status
            });
        }

        // -------------------------------------------------
        // CHECK DUPLICATE SHIPMENT
        // -------------------------------------------------

        const existing = await query(
            `
            SELECT
                id,
                status
            FROM shipments
            WHERE transaction_id = ?
            LIMIT 1
            `,
            [transactionId]
        );

        if (existing.length > 0) {
            return res.status(409).json({
                error: 'Shipment already exists for this transaction',
                shipment: existing[0]
            });
        }

        // -------------------------------------------------
        // INSERT SHIPMENT
        // -------------------------------------------------

        const result = await query(
            `
            INSERT INTO shipments
            (
                transaction_id,
                pickup_location,
                delivery_location,
                transporter,
                tracking_number,
                status,
                estimated_delivery
            )
            VALUES (?, ?, ?, ?, ?, 'pending', ?)
            `,
            [
                transactionId,
                String(pickup_location).trim(),
                String(delivery_location).trim(),
                transporter
                    ? String(transporter).trim()
                    : null,
                tracking_number
                    ? String(tracking_number).trim()
                    : null,
                estimated_delivery || null
            ]
        );

        return res.status(201).json({
            message: 'Shipment created successfully',
            shipmentId: result.insertId
        });

    } catch (error) {
        console.error(
            'Create shipment error:',
            error
        );

        return res.status(500).json({
            error: 'Failed to create shipment',
            details: error.message,
            code: error.code
        });
    }
});

// =====================================================
// UPDATE SHIPMENT STATUS
// =====================================================

router.post('/:shipmentId/status', async (req, res) => {
    try {
        const shipmentId = Number(
            req.params.shipmentId
        );

        const {
            status,
            farmer_id,
            farmerId,
            userId
        } = req.body;

        if (
            !Number.isInteger(shipmentId) ||
            shipmentId <= 0
        ) {
            return res.status(400).json({
                error: 'Invalid shipment ID'
            });
        }

        // -------------------------------------------------
        // GET FARMER ID
        // -------------------------------------------------

        const farmerIdValue =
            farmer_id ??
            farmerId ??
            userId;

        const validFarmerId = Number(farmerIdValue);

        if (
            !Number.isInteger(validFarmerId) ||
            validFarmerId <= 0
        ) {
            return res.status(400).json({
                error: 'Valid farmer ID is required'
            });
        }

        // -------------------------------------------------
        // VALIDATE STATUS
        // -------------------------------------------------

        const validStatuses = [
            'pending',
            'in_transit',
            'delivered',
            'cancelled'
        ];

        if (!validStatuses.includes(status)) {
            return res.status(400).json({
                error: 'Invalid shipment status',
                allowedStatuses: validStatuses
            });
        }

        // -------------------------------------------------
        // VERIFY OWNERSHIP
        // -------------------------------------------------

        const shipments = await query(
            `
            SELECT
                s.id,
                s.status,
                t.farmer_id
            FROM shipments s

            INNER JOIN transactions t
                ON s.transaction_id = t.id

            WHERE
                s.id = ?
                AND t.farmer_id = ?

            LIMIT 1
            `,
            [
                shipmentId,
                validFarmerId
            ]
        );

        if (shipments.length === 0) {
            return res.status(404).json({
                error:
                    'Shipment not found for this farmer'
            });
        }

        const currentStatus =
            shipments[0].status;

        // -------------------------------------------------
        // DELIVERED SHIPMENTS ARE PERMANENT
        // -------------------------------------------------

        if (currentStatus === 'delivered') {
            return res.status(400).json({
                error:
                    'Delivered shipment cannot be updated'
            });
        }

        // -------------------------------------------------
        // UPDATE STATUS
        // -------------------------------------------------

        await query(
            `
            UPDATE shipments
            SET status = ?
            WHERE id = ?
            `,
            [
                status,
                shipmentId
            ]
        );

        return res.json({
            message:
                'Shipment status updated successfully',
            shipmentId,
            status
        });

    } catch (error) {
        console.error(
            'Update shipment status error:',
            error
        );

        return res.status(500).json({
            error:
                'Failed to update shipment status',
            details:
                error.message,
            code:
                error.code
        });
    }
});

// =====================================================
// GET SINGLE SHIPMENT
// =====================================================

router.get('/shipment/:shipmentId', async (req, res) => {
    try {
        const shipmentId = Number(
            req.params.shipmentId
        );

        if (
            !Number.isInteger(shipmentId) ||
            shipmentId <= 0
        ) {
            return res.status(400).json({
                error: 'Invalid shipment ID'
            });
        }

        const sql = `
            SELECT
                s.id,
                s.transaction_id,

                s.pickup_location,
                s.delivery_location,

                s.transporter,
                s.tracking_number,
                s.status,
                s.estimated_delivery,
                s.created_at,

                t.amount AS transaction_amount,
                t.quantity AS transaction_quantity,
                t.status AS transaction_status,
                t.transaction_date,

                o.offered_price,
                o.buyer_offer_price,
                o.counter_price,
                o.final_price,

                p.crop_name,
                p.unit,
                p.quality,

                u.name AS buyer_name,
                u.email AS buyer_email

            FROM shipments s

            INNER JOIN transactions t
                ON s.transaction_id = t.id

            INNER JOIN offers o
                ON t.offer_id = o.id

            INNER JOIN produce_listings p
                ON o.produce_id = p.id

            INNER JOIN users u
                ON t.buyer_id = u.id

            WHERE s.id = ?

            LIMIT 1
        `;

        const shipments = await query(
            sql,
            [shipmentId]
        );

        if (shipments.length === 0) {
            return res.status(404).json({
                error: 'Shipment not found'
            });
        }

        return res.json({
            shipment: shipments[0]
        });

    } catch (error) {
        console.error(
            'Get shipment error:',
            error
        );

        return res.status(500).json({
            error:
                'Failed to load shipment',
            details:
                error.message,
            code:
                error.code
        });
    }
});

module.exports = router;