const express = require('express');
const router = express.Router();
const db = require('../db');

// =====================================================
// GET BUYER LOGISTICS
// GET /api/buyer/logistics/:buyerId
// =====================================================

router.get('/:buyerId', (req, res) => {

    const buyerId = Number(req.params.buyerId);

    if (!Number.isInteger(buyerId) || buyerId <= 0) {
        return res.status(400).json({
            error: 'Invalid buyer ID'
        });
    }

    const sql = `
        SELECT
            s.id AS shipment_id,
            s.transaction_id,
            s.pickup_location,
            s.delivery_location,
            s.transporter,
            s.tracking_number,
            s.status AS shipment_status,
            s.estimated_delivery,
            s.created_at AS shipment_created_at,

            t.id AS transaction_id,
            t.amount,
            t.quantity,
            t.status AS transaction_status,
            t.transaction_date,

            o.id AS offer_id,
            o.buyer_id,
            o.buyer_offer_price,
            o.counter_price,
            o.final_price,

            p.id AS produce_id,
            p.crop_name,
            p.unit,
            p.quality,
            p.price_per_unit,

            u.id AS farmer_id,
            u.name AS farmer_name,
            u.email AS farmer_email

        FROM shipments s

        INNER JOIN transactions t
            ON s.transaction_id = t.id

        INNER JOIN offers o
            ON t.offer_id = o.id

        INNER JOIN produce_listings p
            ON o.produce_id = p.id

        INNER JOIN users u
            ON p.farmer_id = u.id

        WHERE t.buyer_id = ?

        ORDER BY
            s.created_at DESC
    `;

    db.query(sql, [buyerId], (err, results) => {

        if (err) {

            console.error(
                'Buyer logistics database error:',
                err
            );

            return res.status(500).json({
                error: 'Database error',
                details: err.message,
                code: err.code
            });
        }

        res.json({
            buyer_id: buyerId,
            shipments: results
        });

    });

});


// =====================================================
// GET BUYER LOGISTICS STATS
// GET /api/buyer/logistics/:buyerId/stats
// =====================================================

router.get('/:buyerId/stats', (req, res) => {

    const buyerId = Number(req.params.buyerId);

    if (!Number.isInteger(buyerId) || buyerId <= 0) {
        return res.status(400).json({
            error: 'Invalid buyer ID'
        });
    }

    const sql = `
        SELECT

            COUNT(*) AS total_shipments,

            SUM(
                CASE
                    WHEN s.status = 'pending'
                    THEN 1
                    ELSE 0
                END
            ) AS pending_shipments,

            SUM(
                CASE
                    WHEN s.status = 'in_transit'
                    THEN 1
                    ELSE 0
                END
            ) AS in_transit_shipments,

            SUM(
                CASE
                    WHEN s.status = 'delivered'
                    THEN 1
                    ELSE 0
                END
            ) AS delivered_shipments,

            SUM(
                CASE
                    WHEN s.status = 'cancelled'
                    THEN 1
                    ELSE 0
                END
            ) AS cancelled_shipments

        FROM shipments s

        INNER JOIN transactions t
            ON s.transaction_id = t.id

        WHERE t.buyer_id = ?
    `;

    db.query(sql, [buyerId], (err, results) => {

        if (err) {

            console.error(
                'Buyer logistics stats error:',
                err
            );

            return res.status(500).json({
                error: 'Database error',
                details: err.message,
                code: err.code
            });
        }

        const stats = results[0] || {};

        res.json({
            buyer_id: buyerId,
            statistics: {
                totalShipments:
                    Number(stats.total_shipments || 0),

                pendingShipments:
                    Number(stats.pending_shipments || 0),

                inTransitShipments:
                    Number(stats.in_transit_shipments || 0),

                deliveredShipments:
                    Number(stats.delivered_shipments || 0),

                cancelledShipments:
                    Number(stats.cancelled_shipments || 0)
            }
        });

    });

});


module.exports = router;