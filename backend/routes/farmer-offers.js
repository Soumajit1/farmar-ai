const express = require('express');
const router = express.Router();
const db = require('../db');


// =====================================================
// GET ALL OFFERS FOR A FARMER
// GET /api/farmer/offers/:farmerId
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
            o.id,
            o.produce_id,
            o.buyer_id,

            o.offered_price,
            o.buyer_offer_price,
            o.counter_price,
            o.final_price,

            o.quantity,
            o.message,
            o.status,
            o.created_at,

            p.crop_name,
            p.unit,
            p.price_per_unit,
            p.quality,
            p.description,

            u.name AS buyer_name,
            u.email AS buyer_email

        FROM offers o

        INNER JOIN produce_listings p
            ON o.produce_id = p.id

        INNER JOIN users u
            ON o.buyer_id = u.id

        WHERE p.farmer_id = ?

        ORDER BY o.created_at DESC
    `;


    db.query(
        sql,
        [farmerId],
        (err, results) => {

            if (err) {

                console.error(
                    'Get farmer offers error:',
                    err
                );

                return res.status(500).json({
                    error: 'Failed to load offers',
                    details: err.message,
                    code: err.code
                });

            }


            res.json({
                offers: results
            });

        }
    );

});


// =====================================================
// GET OFFER STATISTICS
// GET /api/farmer/offers/:farmerId/stats
// =====================================================
router.get('/:farmerId/stats', (req, res) => {

    const farmerId =
        Number(req.params.farmerId);


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
                    WHEN o.status = 'pending'
                    THEN 1
                    ELSE 0
                END
            ) AS pending,

            SUM(
                CASE
                    WHEN o.status = 'accepted'
                    THEN 1
                    ELSE 0
                END
            ) AS accepted,

            SUM(
                CASE
                    WHEN o.status = 'rejected'
                    THEN 1
                    ELSE 0
                END
            ) AS rejected

        FROM offers o

        INNER JOIN produce_listings p
            ON o.produce_id = p.id

        WHERE p.farmer_id = ?
    `;


    db.query(
        sql,
        [farmerId],
        (err, results) => {

            if (err) {

                console.error(
                    'Offer statistics error:',
                    err
                );

                return res.status(500).json({
                    error:
                        'Failed to load offer statistics',
                    details:
                        err.message
                });

            }


            const stats =
                results[0] || {};


            res.json({

                total:
                    Number(stats.total || 0),

                pending:
                    Number(stats.pending || 0),

                accepted:
                    Number(stats.accepted || 0),

                rejected:
                    Number(stats.rejected || 0)

            });

        }
    );

});


// =====================================================
// ACCEPT OFFER
// POST /api/farmer/offers/:offerId/accept
//
// FINAL SALE PRICE:
// Uses final_price if available.
// Otherwise uses buyer_offer_price.
// Finally falls back to offered_price.
// =====================================================
router.post('/:offerId/accept', (req, res) => {

    const offerId =
        Number(req.params.offerId);

    const farmerId =
        Number(req.body.farmerId);


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


    db.beginTransaction(err => {

        if (err) {

            console.error(
                'Transaction start error:',
                err
            );

            return res.status(500).json({
                error:
                    'Failed to start database transaction'
            });

        }


        // =================================================
        // GET OFFER
        // =================================================

        const getOfferSql = `

            SELECT

                o.id,
                o.produce_id,
                o.buyer_id,

                o.offered_price,
                o.buyer_offer_price,
                o.counter_price,
                o.final_price,

                o.quantity,

                o.status AS offer_status,

                p.farmer_id,
                p.crop_name,
                p.quantity AS available_quantity,
                p.unit,
                p.status AS produce_status

            FROM offers o

            INNER JOIN produce_listings p
                ON o.produce_id = p.id

            WHERE o.id = ?
              AND p.farmer_id = ?

            LIMIT 1

        `;


        db.query(
            getOfferSql,
            [
                offerId,
                farmerId
            ],
            (err, results) => {

                if (err) {

                    return db.rollback(() => {

                        console.error(
                            'Get offer error:',
                            err
                        );

                        res.status(500).json({
                            error:
                                'Failed to get offer',
                            details:
                                err.message
                        });

                    });

                }


                if (
                    results.length === 0
                ) {

                    return db.rollback(() => {

                        res.status(404).json({
                            error:
                                'Offer not found or does not belong to this farmer'
                        });

                    });

                }


                const offer =
                    results[0];


                // =================================================
                // CHECK OFFER STATUS
                // =================================================

                if (
                    offer.offer_status !==
                    'pending'
                ) {

                    return db.rollback(() => {

                        res.status(400).json({
                            error:
                                `Offer is already ${offer.offer_status}`
                        });

                    });

                }


                // =================================================
                // CHECK PRODUCE STATUS
                // =================================================

                if (
                    offer.produce_status ===
                    'sold'
                ) {

                    return db.rollback(() => {

                        res.status(400).json({
                            error:
                                'This produce has already been sold'
                        });

                    });

                }


                // =================================================
                // CHECK QUANTITY
                // =================================================

                const availableQuantity =
                    Number(
                        offer.available_quantity
                    );


                const offerQuantity =
                    Number(
                        offer.quantity
                    );


                if (
                    offerQuantity <= 0
                ) {

                    return db.rollback(() => {

                        res.status(400).json({
                            error:
                                'Offer quantity must be greater than zero'
                        });

                    });

                }


                if (
                    offerQuantity >
                    availableQuantity
                ) {

                    return db.rollback(() => {

                        res.status(400).json({

                            error:
                                'Offer quantity is greater than available produce quantity',

                            availableQuantity,

                            requestedQuantity:
                                offerQuantity

                        });

                    });

                }


                // =================================================
                // DETERMINE FINAL SALE PRICE
                // =================================================

                let finalPrice;


                if (
                    offer.final_price !== null &&
                    offer.final_price !== undefined
                ) {

                    finalPrice =
                        Number(
                            offer.final_price
                        );

                }

                else if (
                    offer.buyer_offer_price !== null &&
                    offer.buyer_offer_price !== undefined
                ) {

                    finalPrice =
                        Number(
                            offer.buyer_offer_price
                        );

                }

                else {

                    finalPrice =
                        Number(
                            offer.offered_price
                        );

                }


                if (
                    !Number.isFinite(finalPrice) ||
                    finalPrice <= 0
                ) {

                    return db.rollback(() => {

                        res.status(400).json({
                            error:
                                'Final sale price is invalid'
                        });

                    });

                }


                const transactionAmount =
                    finalPrice *
                    offerQuantity;


                // =================================================
                // CHECK EXISTING TRANSACTION
                // =================================================

                const checkTransactionSql = `

                    SELECT id

                    FROM transactions

                    WHERE offer_id = ?

                    LIMIT 1

                `;


                db.query(
                    checkTransactionSql,
                    [offerId],
                    (err, transactionResults) => {

                        if (err) {

                            return db.rollback(() => {

                                console.error(
                                    'Check transaction error:',
                                    err
                                );

                                res.status(500).json({
                                    error:
                                        'Failed to check existing transaction',
                                    details:
                                        err.message
                                });

                            });

                        }


                        if (
                            transactionResults.length >
                            0
                        ) {

                            return db.rollback(() => {

                                res.status(400).json({
                                    error:
                                        'A transaction already exists for this offer'
                                });

                            });

                        }


                        // =================================================
                        // ACCEPT OFFER
                        // =================================================

                        const acceptOfferSql = `

                            UPDATE offers

                            SET
                                status = 'accepted',
                                final_price = ?

                            WHERE id = ?
                              AND status = 'pending'

                        `;


                        db.query(
                            acceptOfferSql,
                            [
                                finalPrice,
                                offerId
                            ],
                            (err, acceptResult) => {

                                if (err) {

                                    return db.rollback(() => {

                                        console.error(
                                            'Accept offer error:',
                                            err
                                        );

                                        res.status(500).json({
                                            error:
                                                'Failed to accept offer',
                                            details:
                                                err.message
                                        });

                                    });

                                }


                                if (
                                    acceptResult.affectedRows ===
                                    0
                                ) {

                                    return db.rollback(() => {

                                        res.status(400).json({
                                            error:
                                                'Offer could not be accepted'
                                        });

                                    });

                                }


                                // =================================================
                                // UPDATE PRODUCE QUANTITY
                                // =================================================

                                const remainingQuantity =
                                    availableQuantity -
                                    offerQuantity;


                                let newProduceStatus;


                                if (
                                    remainingQuantity <=
                                    0
                                ) {

                                    newProduceStatus =
                                        'sold';

                                }

                                else {

                                    newProduceStatus =
                                        'available';

                                }


                                const updateProduceSql = `

                                    UPDATE produce_listings

                                    SET

                                        quantity = ?,

                                        status = ?

                                    WHERE id = ?

                                      AND farmer_id = ?

                                `;


                                db.query(
                                    updateProduceSql,
                                    [
                                        remainingQuantity,
                                        newProduceStatus,
                                        offer.produce_id,
                                        farmerId
                                    ],
                                    (err, produceResult) => {

                                        if (err) {

                                            return db.rollback(() => {

                                                console.error(
                                                    'Update produce error:',
                                                    err
                                                );

                                                res.status(500).json({
                                                    error:
                                                        'Failed to update produce',
                                                    details:
                                                        err.message
                                                });

                                            });

                                        }


                                        if (
                                            produceResult.affectedRows ===
                                            0
                                        ) {

                                            return db.rollback(() => {

                                                res.status(400).json({
                                                    error:
                                                        'Produce could not be updated'
                                                });

                                            });

                                        }


                                        // =================================================
                                        // CREATE TRANSACTION
                                        // =================================================

                                        const createTransactionSql = `

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
                                            (
                                                ?,
                                                ?,
                                                ?,
                                                ?,
                                                ?,
                                                'pending'
                                            )

                                        `;


                                        db.query(
                                            createTransactionSql,
                                            [
                                                offerId,
                                                farmerId,
                                                offer.buyer_id,
                                                transactionAmount,
                                                offerQuantity
                                            ],
                                            (err, transactionResult) => {

                                                if (err) {

                                                    return db.rollback(() => {

                                                        console.error(
                                                            'Create transaction error:',
                                                            err
                                                        );

                                                        res.status(500).json({
                                                            error:
                                                                'Offer accepted but transaction creation failed',
                                                            details:
                                                                err.message
                                                        });

                                                    });

                                                }


                                                // =================================================
                                                // COMMIT
                                                // =================================================

                                                db.commit(err => {

                                                    if (err) {

                                                        return db.rollback(
                                                            () => {

                                                                console.error(
                                                                    'Commit error:',
                                                                    err
                                                                );

                                                                res.status(500).json({
                                                                    error:
                                                                        'Failed to complete offer acceptance',
                                                                    details:
                                                                        err.message
                                                                });

                                                            }
                                                        );

                                                    }


                                                    res.json({

                                                        success:
                                                            true,

                                                        message:
                                                            'Offer accepted and transaction created successfully',

                                                        offer: {

                                                            id:
                                                                offerId,

                                                            status:
                                                                'accepted',

                                                            buyerOfferPrice:
                                                                Number(
                                                                    offer.buyer_offer_price ||
                                                                    offer.offered_price
                                                                ),

                                                            counterPrice:
                                                                offer.counter_price !== null
                                                                    ? Number(
                                                                        offer.counter_price
                                                                    )
                                                                    : null,

                                                            finalPrice:
                                                                finalPrice

                                                        },

                                                        produce: {

                                                            id:
                                                                offer.produce_id,

                                                            crop_name:
                                                                offer.crop_name,

                                                            sold_quantity:
                                                                offerQuantity,

                                                            remaining_quantity:
                                                                remainingQuantity,

                                                            unit:
                                                                offer.unit,

                                                            status:
                                                                newProduceStatus

                                                        },

                                                        transaction: {

                                                            id:
                                                                transactionResult.insertId,

                                                            offer_id:
                                                                offerId,

                                                            farmer_id:
                                                                farmerId,

                                                            buyer_id:
                                                                offer.buyer_id,

                                                            quantity:
                                                                offerQuantity,

                                                            price_per_unit:
                                                                finalPrice,

                                                            amount:
                                                                transactionAmount,

                                                            status:
                                                                'pending'

                                                        }

                                                    });

                                                });

                                            }
                                        );

                                    }
                                );

                            }
                        );

                    }
                );

            }

        );

    });

});


// =====================================================
// REJECT OFFER
// POST /api/farmer/offers/:offerId/reject
// =====================================================
router.post('/:offerId/reject', (req, res) => {

    const offerId =
        Number(req.params.offerId);

    const farmerId =
        Number(req.body.farmerId);


    if (
        !Number.isInteger(offerId) ||
        offerId <= 0
    ) {

        return res.status(400).json({
            error:
                'Invalid offer ID'
        });

    }


    if (
        !Number.isInteger(farmerId) ||
        farmerId <= 0
    ) {

        return res.status(400).json({
            error:
                'Invalid farmer ID'
        });

    }


    const sql = `

        UPDATE offers o

        INNER JOIN produce_listings p
            ON o.produce_id = p.id

        SET
            o.status = 'rejected'

        WHERE o.id = ?
          AND p.farmer_id = ?
          AND o.status = 'pending'

    `;


    db.query(
        sql,
        [
            offerId,
            farmerId
        ],
        (err, result) => {

            if (err) {

                console.error(
                    'Reject offer error:',
                    err
                );

                return res.status(500).json({
                    error:
                        'Failed to reject offer',
                    details:
                        err.message
                });

            }


            if (
                result.affectedRows === 0
            ) {

                return res.status(400).json({
                    error:
                        'Offer not found, does not belong to this farmer, or is already processed'
                });

            }


            res.json({

                success:
                    true,

                message:
                    'Offer rejected successfully'

            });

        }
    );

});


// =====================================================
// COUNTER OFFER
// POST /api/farmer/offers/:offerId/counter
//
// IMPORTANT:
// Does NOT overwrite buyer_offer_price.
// Stores farmer counter separately.
// =====================================================
router.post('/:offerId/counter', (req, res) => {

    const offerId =
        Number(req.params.offerId);

    const farmerId =
        Number(req.body.farmerId);

    const counterPrice =
        Number(req.body.counterPrice);


    if (
        !Number.isInteger(offerId) ||
        offerId <= 0
    ) {

        return res.status(400).json({
            error:
                'Invalid offer ID'
        });

    }


    if (
        !Number.isInteger(farmerId) ||
        farmerId <= 0
    ) {

        return res.status(400).json({
            error:
                'Invalid farmer ID'
        });

    }


    if (
        !Number.isFinite(counterPrice) ||
        counterPrice <= 0
    ) {

        return res.status(400).json({
            error:
                'Counter price must be greater than zero'
        });

    }


    // -------------------------------------------------
    // First preserve the original buyer price
    // -------------------------------------------------

    const getOfferSql = `

        SELECT
            o.id,
            o.offered_price,
            o.buyer_offer_price,
            o.counter_price,
            o.final_price,
            o.status

        FROM offers o

        INNER JOIN produce_listings p
            ON o.produce_id = p.id

        WHERE o.id = ?
          AND p.farmer_id = ?

        LIMIT 1

    `;


    db.query(
        getOfferSql,
        [
            offerId,
            farmerId
        ],
        (err, results) => {

            if (err) {

                console.error(
                    'Get offer before counter error:',
                    err
                );

                return res.status(500).json({
                    error:
                        'Failed to get offer',
                    details:
                        err.message
                });

            }


            if (
                results.length === 0
            ) {

                return res.status(404).json({
                    error:
                        'Offer not found or does not belong to this farmer'
                });

            }


            const offer =
                results[0];


            if (
                offer.status !==
                'pending'
            ) {

                return res.status(400).json({
                    error:
                        `Offer is already ${offer.status}`
                });

            }


            const buyerOriginalPrice =
                offer.buyer_offer_price !== null
                    ? Number(
                        offer.buyer_offer_price
                    )
                    : Number(
                        offer.offered_price
                    );


            // -------------------------------------------------
            // Store counter separately.
            // Keep offered_price for compatibility.
            // -------------------------------------------------

            const updateSql = `

                UPDATE offers o

                INNER JOIN produce_listings p
                    ON o.produce_id = p.id

                SET

                    o.buyer_offer_price = ?,

                    o.counter_price = ?,

                    o.offered_price = ?

                WHERE o.id = ?

                  AND p.farmer_id = ?

                  AND o.status = 'pending'

            `;


            db.query(
                updateSql,
                [
                    buyerOriginalPrice,
                    counterPrice,
                    counterPrice,
                    offerId,
                    farmerId
                ],
                (err, result) => {

                    if (err) {

                        console.error(
                            'Counter offer error:',
                            err
                        );

                        return res.status(500).json({
                            error:
                                'Failed to send counter offer',
                            details:
                                err.message
                        });

                    }


                    if (
                        result.affectedRows ===
                        0
                    ) {

                        return res.status(400).json({
                            error:
                                'Offer could not be updated'
                        });

                    }


                    res.json({

                        success:
                            true,

                        message:
                            'Counter offer sent successfully',

                        buyerOfferPrice:
                            buyerOriginalPrice,

                        counterPrice:
                            counterPrice,

                        finalPrice:
                            null

                    });

                }
            );

        }
    );

});


module.exports = router;