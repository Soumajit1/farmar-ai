const express = require('express');
const router = express.Router();
const db = require('../db');


// =====================================================
// DATABASE HELPER
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
// BUYER OVERVIEW
// GET /api/buyer/overview?userId=ID
// =====================================================

router.get('/overview', async (req, res) => {

    try {

        const buyerId = Number(req.query.userId);

        if (!Number.isInteger(buyerId) || buyerId <= 0) {
            return res.status(400).json({
                error: 'Valid buyer ID is required'
            });
        }


        // -------------------------------------------------
        // BUYER
        // -------------------------------------------------

        const buyers = await query(
            `
            SELECT
                id,
                name,
                email,
                role,
                created_at
            FROM users
            WHERE id = ?
              AND role = 'buyer'
            LIMIT 1
            `,
            [buyerId]
        );


        if (buyers.length === 0) {
            return res.status(404).json({
                error: 'Buyer not found'
            });
        }


        const buyer = buyers[0];


        // -------------------------------------------------
        // AVAILABLE PRODUCE
        // -------------------------------------------------

        const produceStats = await query(
            `
            SELECT
                COUNT(*) AS total
            FROM produce_listings
            WHERE status = 'available'
            `
        );


        // -------------------------------------------------
        // BUYER OFFERS
        // -------------------------------------------------

        const offerStats = await query(
            `
            SELECT

                COUNT(*) AS total,

                SUM(
                    CASE
                        WHEN status = 'pending'
                        THEN 1
                        ELSE 0
                    END
                ) AS pending,

                SUM(
                    CASE
                        WHEN status = 'accepted'
                        THEN 1
                        ELSE 0
                    END
                ) AS accepted,

                SUM(
                    CASE
                        WHEN status = 'rejected'
                        THEN 1
                        ELSE 0
                    END
                ) AS rejected

            FROM offers
            WHERE buyer_id = ?
            `,
            [buyerId]
        );


        // -------------------------------------------------
        // TRANSACTION STATS
        // -------------------------------------------------

        const transactionStats = await query(
            `
            SELECT

                COUNT(*) AS total,

                SUM(
                    CASE
                        WHEN status = 'pending'
                        THEN 1
                        ELSE 0
                    END
                ) AS pending,

                SUM(
                    CASE
                        WHEN status = 'completed'
                        THEN 1
                        ELSE 0
                    END
                ) AS completed,

                SUM(
                    CASE
                        WHEN status = 'cancelled'
                        THEN 1
                        ELSE 0
                    END
                ) AS cancelled,

                COALESCE(
                    SUM(
                        CASE
                            WHEN status = 'completed'
                            THEN amount
                            ELSE 0
                        END
                    ),
                    0
                ) AS completed_amount

            FROM transactions
            WHERE buyer_id = ?
            `,
            [buyerId]
        );


        // -------------------------------------------------
        // RECENT PRODUCE
        // -------------------------------------------------

        const recentProduce = await query(
            `
            SELECT

                p.id,
                p.farmer_id,
                p.crop_name,
                p.quantity,
                p.unit,
                p.price_per_unit,
                p.quality,
                p.description,
                p.status,
                p.created_at,

                u.name AS farmer_name

            FROM produce_listings p

            INNER JOIN users u
                ON p.farmer_id = u.id

            WHERE p.status = 'available'

            ORDER BY p.created_at DESC

            LIMIT 6
            `
        );


        // -------------------------------------------------
        // RECENT OFFERS
        // -------------------------------------------------

        const recentOffers = await query(
            `
            SELECT

                o.id,
                o.produce_id,
                o.buyer_id,
                o.offered_price,
                o.quantity,
                o.message,
                o.status,
                o.created_at,

                p.crop_name,
                p.unit,

                u.name AS farmer_name

            FROM offers o

            INNER JOIN produce_listings p
                ON o.produce_id = p.id

            INNER JOIN users u
                ON p.farmer_id = u.id

            WHERE o.buyer_id = ?

            ORDER BY o.created_at DESC

            LIMIT 5
            `,
            [buyerId]
        );


        // -------------------------------------------------
        // RECENT TRANSACTIONS
        // -------------------------------------------------

        const recentTransactions = await query(
            `
            SELECT

                t.id,
                t.offer_id,
                t.farmer_id,
                t.buyer_id,
                t.amount,
                t.quantity,
                t.status,
                t.transaction_date,

                p.crop_name,
                p.unit,

                u.name AS farmer_name

            FROM transactions t

            INNER JOIN offers o
                ON t.offer_id = o.id

            INNER JOIN produce_listings p
                ON o.produce_id = p.id

            INNER JOIN users u
                ON t.farmer_id = u.id

            WHERE t.buyer_id = ?

            ORDER BY t.transaction_date DESC

            LIMIT 5
            `,
            [buyerId]
        );


        // -------------------------------------------------
        // RESPONSE
        // -------------------------------------------------

        const offers = offerStats[0] || {};
        const transactions = transactionStats[0] || {};
        const produce = produceStats[0] || {};


        res.json({

            buyer: {
                id: buyer.id,
                name: buyer.name,
                email: buyer.email,
                role: buyer.role,
                created_at: buyer.created_at
            },

            statistics: {

                availableProduce:
                    Number(produce.total || 0),

                totalOffers:
                    Number(offers.total || 0),

                pendingOffers:
                    Number(offers.pending || 0),

                acceptedOffers:
                    Number(offers.accepted || 0),

                rejectedOffers:
                    Number(offers.rejected || 0),

                totalTransactions:
                    Number(transactions.total || 0),

                pendingTransactions:
                    Number(transactions.pending || 0),

                completedTransactions:
                    Number(transactions.completed || 0),

                cancelledTransactions:
                    Number(transactions.cancelled || 0),

                completedAmount:
                    Number(transactions.completed_amount || 0)

            },

            recentProduce,
            recentOffers,
            recentTransactions

        });

    } catch (error) {

        console.error(
            'Buyer overview error:',
            error
        );

        res.status(500).json({
            error: 'Failed to load buyer dashboard',
            details: error.message,
            code: error.code
        });
    }
});


module.exports = router;