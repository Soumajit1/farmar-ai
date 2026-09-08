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
// GET FPO OVERVIEW
// GET /api/fpo/overview/:fpoId
// =====================================================

router.get('/overview/:fpoId', async (req, res) => {
    try {
        const fpoId = Number(req.params.fpoId);

        if (!Number.isInteger(fpoId) || fpoId <= 0) {
            return res.status(400).json({
                error: 'Invalid FPO ID'
            });
        }

        // Verify FPO user
        const fpoUsers = await query(
            `
            SELECT
                id,
                name,
                email,
                role
            FROM users
            WHERE id = ?
              AND role = 'fpo'
            LIMIT 1
            `,
            [fpoId]
        );

        if (fpoUsers.length === 0) {
            return res.status(404).json({
                error: 'FPO user not found'
            });
        }

        const fpo = fpoUsers[0];

        // Total farmers
        const memberResults = await query(
            `
            SELECT
                COUNT(*) AS total_members
            FROM users
            WHERE role = 'farmer'
            `
        );

        const totalMembers =
            Number(memberResults[0]?.total_members || 0);

        // Active farmers
        const activeMemberResults = await query(
            `
            SELECT
                COUNT(DISTINCT u.id) AS active_members
            FROM users u
            INNER JOIN produce_listings p
                ON p.farmer_id = u.id
            WHERE u.role = 'farmer'
              AND p.status = 'available'
            `
        );

        const activeMembers =
            Number(activeMemberResults[0]?.active_members || 0);

        // Aggregated produce
        const produceResults = await query(
            `
            SELECT
                COUNT(*) AS produce_types,
                COALESCE(SUM(quantity), 0) AS total_quantity
            FROM produce_listings
            WHERE status != 'sold'
            `
        );

        const produceTypes =
            Number(produceResults[0]?.produce_types || 0);

        const totalQuantity =
            Number(produceResults[0]?.total_quantity || 0);

        // Accepted transactions
        const transactionResults = await query(
            `
            SELECT
                COUNT(*) AS total_transactions,
                COALESCE(SUM(amount), 0) AS total_sales
            FROM transactions
            WHERE status = 'completed'
            `
        );

        const totalTransactions =
            Number(
                transactionResults[0]?.total_transactions || 0
            );

        const totalSales =
            Number(
                transactionResults[0]?.total_sales || 0
            );

        // Active buyer connections
        const buyerResults = await query(
            `
            SELECT
                COUNT(DISTINCT buyer_id) AS active_buyers
            FROM offers
            WHERE status IN ('pending', 'accepted')
            `
        );

        const activeBuyers =
            Number(
                buyerResults[0]?.active_buyers || 0
            );

        // Recent member activity
        const recentMembers = await query(
            `
            SELECT
                u.id,
                u.name,
                p.crop_name,
                p.quantity,
                p.unit,
                p.created_at
            FROM produce_listings p
            INNER JOIN users u
                ON p.farmer_id = u.id
            WHERE u.role = 'farmer'
            ORDER BY p.created_at DESC
            LIMIT 5
            `
        );

        // Monthly sales
        const monthlySales = await query(
            `
            SELECT
                DATE_FORMAT(
                    transaction_date,
                    '%Y-%m'
                ) AS month,
                COALESCE(SUM(amount), 0) AS sales,
                COALESCE(SUM(quantity), 0) AS volume
            FROM transactions
            WHERE status = 'completed'
            GROUP BY
                DATE_FORMAT(
                    transaction_date,
                    '%Y-%m'
                )
            ORDER BY month ASC
            LIMIT 12
            `
        );

        return res.json({
            success: true,

            fpo: {
                id: fpo.id,
                name: fpo.name,
                email: fpo.email,
                role: fpo.role
            },

            statistics: {
                totalMembers,
                activeMembers,
                inactiveMembers:
                    Math.max(
                        totalMembers - activeMembers,
                        0
                    ),

                produceTypes,

                aggregatedVolume:
                    totalQuantity,

                activeBuyerContracts:
                    activeBuyers,

                totalTransactions,

                totalSales
            },

            recentMembers,

            monthlySales
        });

    } catch (error) {
        console.error(
            'FPO overview error:',
            error
        );

        return res.status(500).json({
            error: 'Failed to load FPO overview',
            details: error.message,
            code: error.code
        });
    }
});

// =====================================================
// MEMBER FARMERS
// GET /api/fpo/members/:fpoId
// =====================================================

router.get('/members/:fpoId', async (req, res) => {
    try {
        const fpoId = Number(req.params.fpoId);

        if (!Number.isInteger(fpoId) || fpoId <= 0) {
            return res.status(400).json({
                error: 'Invalid FPO ID'
            });
        }

        const fpoUsers = await query(
            `
            SELECT id
            FROM users
            WHERE id = ?
              AND role = 'fpo'
            LIMIT 1
            `,
            [fpoId]
        );

        if (fpoUsers.length === 0) {
            return res.status(404).json({
                error: 'FPO user not found'
            });
        }

        const members = await query(
            `
            SELECT
                u.id,
                u.name,
                u.email,
                u.created_at,

                COUNT(DISTINCT p.id) AS produce_listings,

                COALESCE(
                    SUM(
                        CASE
                            WHEN p.status != 'sold'
                            THEN p.quantity
                            ELSE 0
                        END
                    ),
                    0
                ) AS available_quantity,

                COUNT(
                    DISTINCT
                    CASE
                        WHEN p.status = 'available'
                        THEN p.id
                    END
                ) AS active_listings

            FROM users u

            LEFT JOIN produce_listings p
                ON p.farmer_id = u.id

            WHERE u.role = 'farmer'

            GROUP BY
                u.id,
                u.name,
                u.email,
                u.created_at

            ORDER BY u.name ASC
            `
        );

        return res.json({
            success: true,
            members
        });

    } catch (error) {
        console.error(
            'FPO members error:',
            error
        );

        return res.status(500).json({
            error: 'Failed to load FPO members',
            details: error.message,
            code: error.code
        });
    }
});

// =====================================================
// AGGREGATED PRODUCE
// GET /api/fpo/inventory/:fpoId
// =====================================================

router.get('/inventory/:fpoId', async (req, res) => {
    try {
        const fpoId = Number(req.params.fpoId);

        if (!Number.isInteger(fpoId) || fpoId <= 0) {
            return res.status(400).json({
                error: 'Invalid FPO ID'
            });
        }

        const inventory = await query(
            `
            SELECT

                p.crop_name,

                p.unit,

                COUNT(DISTINCT p.farmer_id)
                    AS member_count,

                COALESCE(
                    SUM(
                        CASE
                            WHEN p.status != 'sold'
                            THEN p.quantity
                            ELSE 0
                        END
                    ),
                    0
                ) AS total_quantity,

                COALESCE(
                    SUM(
                        CASE
                            WHEN p.status = 'available'
                            THEN p.quantity
                            ELSE 0
                        END
                    ),
                    0
                ) AS available_quantity,

                ROUND(
                    AVG(
                        NULLIF(
                            p.price_per_unit,
                            0
                        )
                    ),
                    2
                ) AS average_price,

                COUNT(
                    CASE
                        WHEN p.status = 'available'
                        THEN 1
                    END
                ) AS active_listings

            FROM produce_listings p

            INNER JOIN users u
                ON p.farmer_id = u.id

            WHERE u.role = 'farmer'

            GROUP BY
                p.crop_name,
                p.unit

            ORDER BY total_quantity DESC
            `
        );

        return res.json({
            success: true,
            inventory
        });

    } catch (error) {
        console.error(
            'FPO inventory error:',
            error
        );

        return res.status(500).json({
            error: 'Failed to load aggregated produce',
            details: error.message,
            code: error.code
        });
    }
});

// =====================================================
// BUYER CONNECTIONS
// GET /api/fpo/buyers/:fpoId
// =====================================================

router.get('/buyers/:fpoId', async (req, res) => {
    try {
        const fpoId = Number(req.params.fpoId);

        if (!Number.isInteger(fpoId) || fpoId <= 0) {
            return res.status(400).json({
                error: 'Invalid FPO ID'
            });
        }

        const buyers = await query(
            `
            SELECT

                u.id AS buyer_id,

                u.name AS buyer_name,

                u.email AS buyer_email,

                COUNT(o.id)
                    AS total_offers,

                SUM(
                    CASE
                        WHEN o.status = 'pending'
                        THEN 1
                        ELSE 0
                    END
                ) AS pending_offers,

                SUM(
                    CASE
                        WHEN o.status = 'accepted'
                        THEN 1
                        ELSE 0
                    END
                ) AS accepted_offers,

                COALESCE(
                    SUM(
                        CASE
                            WHEN o.status = 'accepted'
                            THEN t.amount
                            ELSE 0
                        END
                    ),
                    0
                ) AS total_purchase_value

            FROM users u

            INNER JOIN offers o
                ON o.buyer_id = u.id

            LEFT JOIN transactions t
                ON t.offer_id = o.id

            WHERE u.role = 'buyer'

            GROUP BY
                u.id,
                u.name,
                u.email

            ORDER BY total_purchase_value DESC
            `
        );

        return res.json({
            success: true,
            buyers
        });

    } catch (error) {
        console.error(
            'FPO buyers error:',
            error
        );

        return res.status(500).json({
            error: 'Failed to load buyer connections',
            details: error.message,
            code: error.code
        });
    }
});

// =====================================================
// TRANSACTIONS
// GET /api/fpo/transactions/:fpoId
// =====================================================

router.get('/transactions/:fpoId', async (req, res) => {
    try {
        const fpoId = Number(req.params.fpoId);

        if (!Number.isInteger(fpoId) || fpoId <= 0) {
            return res.status(400).json({
                error: 'Invalid FPO ID'
            });
        }

        const transactions = await query(
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

                farmer.name
                    AS farmer_name,

                buyer.name
                    AS buyer_name

            FROM transactions t

            INNER JOIN offers o
                ON t.offer_id = o.id

            INNER JOIN produce_listings p
                ON o.produce_id = p.id

            INNER JOIN users farmer
                ON t.farmer_id = farmer.id

            INNER JOIN users buyer
                ON t.buyer_id = buyer.id

            ORDER BY
                t.transaction_date DESC

            LIMIT 100
            `
        );

        return res.json({
            success: true,
            transactions
        });

    } catch (error) {
        console.error(
            'FPO transactions error:',
            error
        );

        return res.status(500).json({
            error: 'Failed to load FPO transactions',
            details: error.message,
            code: error.code
        });
    }
});

// =====================================================
// ANALYTICS
// GET /api/fpo/analytics/:fpoId
// =====================================================

router.get('/analytics/:fpoId', async (req, res) => {
    try {
        const fpoId = Number(req.params.fpoId);

        if (!Number.isInteger(fpoId) || fpoId <= 0) {
            return res.status(400).json({
                error: 'Invalid FPO ID'
            });
        }

        const cropAnalytics = await query(
            `
            SELECT

                p.crop_name,

                COUNT(DISTINCT p.farmer_id)
                    AS farmers,

                COALESCE(
                    SUM(p.quantity),
                    0
                ) AS quantity,

                ROUND(
                    AVG(
                        NULLIF(
                            p.price_per_unit,
                            0
                        )
                    ),
                    2
                ) AS average_price

            FROM produce_listings p

            INNER JOIN users u
                ON p.farmer_id = u.id

            WHERE u.role = 'farmer'

            GROUP BY p.crop_name

            ORDER BY quantity DESC
            `
        );

        const monthlyAnalytics = await query(
            `
            SELECT

                DATE_FORMAT(
                    transaction_date,
                    '%Y-%m'
                ) AS month,

                COUNT(*) AS transactions,

                COALESCE(
                    SUM(amount),
                    0
                ) AS sales,

                COALESCE(
                    SUM(quantity),
                    0
                ) AS volume

            FROM transactions

            WHERE status = 'completed'

            GROUP BY
                DATE_FORMAT(
                    transaction_date,
                    '%Y-%m'
                )

            ORDER BY month ASC

            LIMIT 12
            `
        );

        const statusAnalytics = await query(
            `
            SELECT

                status,

                COUNT(*) AS count,

                COALESCE(
                    SUM(amount),
                    0
                ) AS amount

            FROM transactions

            GROUP BY status
            `
        );

        return res.json({
            success: true,

            cropAnalytics,

            monthlyAnalytics,

            transactionStatus: statusAnalytics
        });

    } catch (error) {
        console.error(
            'FPO analytics error:',
            error
        );

        return res.status(500).json({
            error: 'Failed to load FPO analytics',
            details: error.message,
            code: error.code
        });
    }
});

module.exports = router;