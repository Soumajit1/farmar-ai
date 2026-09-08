const express = require('express');
const router = express.Router();
const db = require('../db');


// =====================================================
// GET ALL TRANSACTIONS FOR A FARMER
// =====================================================

router.get('/:farmerId', (req, res) => {

    const farmerId = Number(req.params.farmerId);

    if (!Number.isInteger(farmerId) || farmerId <= 0) {
        return res.status(400).json({
            error: 'Invalid farmer ID'
        });
    }

    const sql = `
        SELECT
            t.id,
            t.offer_id,
            t.farmer_id,
            t.buyer_id,
            t.amount,
            t.quantity,
            t.status,
            t.transaction_date,

            o.offered_price,

            p.crop_name,
            p.unit,
            p.quality,

            u.name AS buyer_name,
            u.email AS buyer_email

        FROM transactions t

        INNER JOIN offers o
            ON t.offer_id = o.id

        INNER JOIN produce_listings p
            ON o.produce_id = p.id

        INNER JOIN users u
            ON t.buyer_id = u.id

        WHERE t.farmer_id = ?

        ORDER BY t.transaction_date DESC
    `;

    db.query(sql, [farmerId], (err, results) => {

        if (err) {

            console.error(
                'Error loading farmer transactions:',
                err
            );

            return res.status(500).json({
                error: 'Failed to load transactions',
                details: err.message,
                code: err.code
            });
        }

        res.json({
            success: true,
            transactions: results
        });

    });

});


// =====================================================
// TRANSACTION STATISTICS
// =====================================================

router.get('/:farmerId/stats', (req, res) => {

    const farmerId = Number(req.params.farmerId);

    if (!Number.isInteger(farmerId) || farmerId <= 0) {
        return res.status(400).json({
            error: 'Invalid farmer ID'
        });
    }

    const sql = `
        SELECT

            COUNT(*) AS total_transactions,

            COALESCE(
                SUM(
                    CASE
                        WHEN status = 'pending'
                        THEN 1
                        ELSE 0
                    END
                ),
                0
            ) AS pending_transactions,

            COALESCE(
                SUM(
                    CASE
                        WHEN status = 'completed'
                        THEN 1
                        ELSE 0
                    END
                ),
                0
            ) AS completed_transactions,

            COALESCE(
                SUM(
                    CASE
                        WHEN status = 'cancelled'
                        THEN 1
                        ELSE 0
                    END
                ),
                0
            ) AS cancelled_transactions,

            COALESCE(
                SUM(
                    CASE
                        WHEN status = 'completed'
                        THEN amount
                        ELSE 0
                    END
                ),
                0
            ) AS completed_amount,

            COALESCE(
                SUM(amount),
                0
            ) AS total_amount

        FROM transactions

        WHERE farmer_id = ?
    `;

    db.query(sql, [farmerId], (err, results) => {

        if (err) {

            console.error(
                'Error loading transaction statistics:',
                err
            );

            return res.status(500).json({
                error: 'Failed to load transaction statistics',
                details: err.message,
                code: err.code
            });
        }

        const stats = results[0] || {};

        res.json({
            success: true,

            stats: {

                total: Number(
                    stats.total_transactions || 0
                ),

                pending: Number(
                    stats.pending_transactions || 0
                ),

                completed: Number(
                    stats.completed_transactions || 0
                ),

                cancelled: Number(
                    stats.cancelled_transactions || 0
                ),

                completedAmount: Number(
                    stats.completed_amount || 0
                ),

                totalAmount: Number(
                    stats.total_amount || 0
                )

            }
        });

    });

});


// =====================================================
// CREATE TRANSACTION FROM ACCEPTED OFFER
// =====================================================

router.post('/create-from-offer', (req, res) => {

    const offerId = Number(req.body.offerId);
    const farmerId = Number(req.body.farmerId);

    if (
        !Number.isInteger(offerId) ||
        offerId <= 0
    ) {
        return res.status(400).json({
            error: 'Invalid offer ID'
        });
    }

    if (
        !Number.isInteger(farmerId) ||
        farmerId <= 0
    ) {
        return res.status(400).json({
            error: 'Invalid farmer ID'
        });
    }


    const findOfferSql = `
        SELECT

            o.id AS offer_id,
            o.produce_id,
            o.buyer_id,
            o.offered_price,
            o.quantity,
            o.status AS offer_status,

            p.farmer_id,
            p.crop_name,
            p.unit

        FROM offers o

        INNER JOIN produce_listings p
            ON o.produce_id = p.id

        WHERE o.id = ?
          AND p.farmer_id = ?

        LIMIT 1
    `;


    db.query(
        findOfferSql,
        [offerId, farmerId],
        (err, results) => {

            if (err) {

                console.error(
                    'Error finding offer:',
                    err
                );

                return res.status(500).json({
                    error: 'Failed to find offer',
                    details: err.message
                });
            }


            if (results.length === 0) {

                return res.status(404).json({
                    error: 'Offer not found'
                });

            }


            const offer = results[0];


            if (offer.offer_status !== 'accepted') {

                return res.status(400).json({
                    error:
                        'Only accepted offers can create transactions'
                });

            }


            const amount =
                Number(offer.offered_price) *
                Number(offer.quantity);


            const checkSql = `
                SELECT id

                FROM transactions

                WHERE offer_id = ?

                LIMIT 1
            `;


            db.query(
                checkSql,
                [offerId],
                (checkErr, existing) => {

                    if (checkErr) {

                        console.error(
                            'Transaction check error:',
                            checkErr
                        );

                        return res.status(500).json({
                            error:
                                'Failed to check existing transaction'
                        });

                    }


                    if (existing.length > 0) {

                        return res.status(409).json({

                            error:
                                'A transaction already exists for this offer',

                            transactionId:
                                existing[0].id

                        });

                    }


                    const insertSql = `
                        INSERT INTO transactions
                        (
                            offer_id,
                            farmer_id,
                            buyer_id,
                            amount,
                            quantity,
                            status
                        )

                        VALUES
                        (?, ?, ?, ?, ?, 'pending')
                    `;


                    db.query(
                        insertSql,
                        [
                            offerId,
                            farmerId,
                            offer.buyer_id,
                            amount,
                            offer.quantity
                        ],
                        (insertErr, result) => {

                            if (insertErr) {

                                console.error(
                                    'Transaction creation error:',
                                    insertErr
                                );

                                return res.status(500).json({
                                    error:
                                        'Failed to create transaction',

                                    details:
                                        insertErr.message,

                                    code:
                                        insertErr.code
                                });

                            }


                            res.status(201).json({

                                success: true,

                                message:
                                    'Transaction created successfully',

                                transaction: {

                                    id:
                                        result.insertId,

                                    offerId,

                                    farmerId,

                                    buyerId:
                                        offer.buyer_id,

                                    amount,

                                    quantity:
                                        offer.quantity,

                                    status:
                                        'pending'

                                }

                            });

                        }
                    );

                }
            );

        }
    );

});


// =====================================================
// MARK TRANSACTION AS COMPLETED
// =====================================================

router.post('/:transactionId/complete', (req, res) => {

    const transactionId =
        Number(req.params.transactionId);

    const farmerId =
        Number(req.body.farmerId);


    if (
        !Number.isInteger(transactionId) ||
        transactionId <= 0
    ) {
        return res.status(400).json({
            error: 'Invalid transaction ID'
        });
    }


    if (
        !Number.isInteger(farmerId) ||
        farmerId <= 0
    ) {
        return res.status(400).json({
            error: 'Invalid farmer ID'
        });
    }


    const sql = `
        UPDATE transactions

        SET status = 'completed'

        WHERE id = ?
          AND farmer_id = ?
          AND status = 'pending'
    `;


    db.query(
        sql,
        [transactionId, farmerId],
        (err, result) => {

            if (err) {

                console.error(
                    'Complete transaction error:',
                    err
                );

                return res.status(500).json({
                    error:
                        'Failed to complete transaction',

                    details:
                        err.message
                });
            }


            if (result.affectedRows === 0) {

                return res.status(404).json({
                    error:
                        'Transaction not found or already processed'
                });

            }


            res.json({

                success: true,

                message:
                    'Transaction marked as completed',

                transactionId,

                status:
                    'completed'

            });

        }
    );

});


// =====================================================
// CANCEL TRANSACTION
// =====================================================

router.post('/:transactionId/cancel', (req, res) => {

    const transactionId =
        Number(req.params.transactionId);

    const farmerId =
        Number(req.body.farmerId);


    if (
        !Number.isInteger(transactionId) ||
        transactionId <= 0
    ) {
        return res.status(400).json({
            error: 'Invalid transaction ID'
        });
    }


    if (
        !Number.isInteger(farmerId) ||
        farmerId <= 0
    ) {
        return res.status(400).json({
            error: 'Invalid farmer ID'
        });
    }


    const sql = `
        UPDATE transactions

        SET status = 'cancelled'

        WHERE id = ?
          AND farmer_id = ?
          AND status = 'pending'
    `;


    db.query(
        sql,
        [transactionId, farmerId],
        (err, result) => {

            if (err) {

                console.error(
                    'Cancel transaction error:',
                    err
                );

                return res.status(500).json({
                    error:
                        'Failed to cancel transaction',

                    details:
                        err.message
                });
            }


            if (result.affectedRows === 0) {

                return res.status(404).json({
                    error:
                        'Transaction not found or already processed'
                });

            }


            res.json({

                success: true,

                message:
                    'Transaction cancelled',

                transactionId,

                status:
                    'cancelled'

            });

        }
    );

});


module.exports = router;