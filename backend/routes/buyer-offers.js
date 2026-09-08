const express = require('express');
const router = express.Router();
const db = require('../db');


// =====================================================
// CREATE BUYER OFFER
// POST /api/buyer/offers
// =====================================================

router.post('/', (req, res) => {

    const {
        buyer_id,
        produce_id,
        offered_price,
        quantity,
        message
    } = req.body;


    const buyerId = Number(buyer_id);
    const produceId = Number(produce_id);
    const offeredPrice = Number(offered_price);
    const offerQuantity = Number(quantity);


    if (
        !Number.isInteger(buyerId) ||
        buyerId <= 0
    ) {
        return res.status(400).json({
            error: 'Invalid buyer ID'
        });
    }


    if (
        !Number.isInteger(produceId) ||
        produceId <= 0
    ) {
        return res.status(400).json({
            error: 'Invalid produce ID'
        });
    }


    if (
        !Number.isFinite(offeredPrice) ||
        offeredPrice <= 0
    ) {
        return res.status(400).json({
            error: 'Offered price must be greater than 0'
        });
    }


    if (
        !Number.isFinite(offerQuantity) ||
        offerQuantity <= 0
    ) {
        return res.status(400).json({
            error: 'Quantity must be greater than 0'
        });
    }


    // -------------------------------------------------
    // Verify buyer
    // -------------------------------------------------

    const buyerSql = `
        SELECT id, name, email, role
        FROM users
        WHERE id = ?
        AND role = 'buyer'
        LIMIT 1
    `;


    db.query(
        buyerSql,
        [buyerId],
        (buyerErr, buyerResults) => {

            if (buyerErr) {

                console.error(
                    'Buyer verification error:',
                    buyerErr
                );

                return res.status(500).json({
                    error: 'Database error',
                    details: buyerErr.message,
                    code: buyerErr.code
                });

            }


            if (!buyerResults.length) {

                return res.status(404).json({
                    error: 'Buyer not found'
                });

            }


            // -------------------------------------------------
            // Get produce
            // -------------------------------------------------

            const produceSql = `
                SELECT
                    p.*,
                    u.name AS farmer_name,
                    u.email AS farmer_email
                FROM produce_listings p
                INNER JOIN users u
                    ON p.farmer_id = u.id
                WHERE p.id = ?
                LIMIT 1
            `;


            db.query(
                produceSql,
                [produceId],
                (produceErr, produceResults) => {

                    if (produceErr) {

                        console.error(
                            'Produce lookup error:',
                            produceErr
                        );

                        return res.status(500).json({
                            error: 'Database error',
                            details: produceErr.message,
                            code: produceErr.code
                        });

                    }


                    if (!produceResults.length) {

                        return res.status(404).json({
                            error: 'Produce not found'
                        });

                    }


                    const produce =
                        produceResults[0];


                    // -------------------------------------------------
                    // Cannot buy own produce
                    // -------------------------------------------------

                    if (
                        Number(produce.farmer_id) === buyerId
                    ) {

                        return res.status(400).json({
                            error:
                                'You cannot make an offer on your own produce'
                        });

                    }


                    // -------------------------------------------------
                    // Product must be available
                    // -------------------------------------------------

                    if (
                        String(produce.status)
                            .toLowerCase() !== 'available'
                    ) {

                        return res.status(400).json({
                            error:
                                'This produce is no longer available'
                        });

                    }


                    // -------------------------------------------------
                    // Quantity check
                    // -------------------------------------------------

                    if (
                        offerQuantity >
                        Number(produce.quantity)
                    ) {

                        return res.status(400).json({
                            error:
                                `Only ${produce.quantity} ${produce.unit} is available`
                        });

                    }


                    // -------------------------------------------------
                    // Prevent duplicate pending offers
                    // -------------------------------------------------

                    const duplicateSql = `
                        SELECT id
                        FROM offers
                        WHERE produce_id = ?
                        AND buyer_id = ?
                        AND status = 'pending'
                        LIMIT 1
                    `;


                    db.query(
                        duplicateSql,
                        [
                            produceId,
                            buyerId
                        ],
                        (duplicateErr, duplicateResults) => {

                            if (duplicateErr) {

                                console.error(
                                    'Duplicate offer check error:',
                                    duplicateErr
                                );

                                return res.status(500).json({
                                    error: 'Database error',
                                    details: duplicateErr.message,
                                    code: duplicateErr.code
                                });

                            }


                            if (duplicateResults.length) {

                                return res.status(409).json({
                                    error:
                                        'You already have a pending offer for this produce'
                                });

                            }


                            // -------------------------------------------------
                            // Create offer
                            // -------------------------------------------------

                            const insertSql = `
                                INSERT INTO offers
                                (
                                    produce_id,
                                    buyer_id,
                                    offered_price,
                                    buyer_offer_price,
                                    counter_price,
                                    final_price,
                                    quantity,
                                    message,
                                    status
                                )
                                VALUES
                                (?, ?, ?, ?, NULL, NULL, ?, ?, 'pending')
                            `;


                            db.query(
                                insertSql,
                                [
                                    produceId,
                                    buyerId,
                                    offeredPrice,
                                    offeredPrice,
                                    offerQuantity,
                                    message || null
                                ],
                                (insertErr, result) => {

                                    if (insertErr) {

                                        console.error(
                                            'Create offer error:',
                                            insertErr
                                        );

                                        return res.status(500).json({
                                            error: 'Database error',
                                            details: insertErr.message,
                                            code: insertErr.code
                                        });

                                    }


                                    res.status(201).json({

                                        message:
                                            'Offer submitted successfully',

                                        offer: {

                                            id:
                                                result.insertId,

                                            produce_id:
                                                produceId,

                                            buyer_id:
                                                buyerId,

                                            offered_price:
                                                offeredPrice,

                                            buyer_offer_price:
                                                offeredPrice,

                                            counter_price:
                                                null,

                                            final_price:
                                                null,

                                            quantity:
                                                offerQuantity,

                                            message:
                                                message || null,

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

        }
    );

});


// =====================================================
// GET BUYER OFFERS
// GET /api/buyer/offers/:buyerId
// =====================================================

router.get('/:buyerId', (req, res) => {

    const buyerId =
        Number(req.params.buyerId);


    if (
        !Number.isInteger(buyerId) ||
        buyerId <= 0
    ) {

        return res.status(400).json({
            error: 'Invalid buyer ID'
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
            p.farmer_id,

            u.name AS farmer_name,
            u.email AS farmer_email

        FROM offers o

        INNER JOIN produce_listings p
            ON o.produce_id = p.id

        INNER JOIN users u
            ON p.farmer_id = u.id

        WHERE o.buyer_id = ?

        ORDER BY
            o.created_at DESC
    `;


    db.query(
        sql,
        [buyerId],
        (err, results) => {

            if (err) {

                console.error(
                    'Get buyer offers error:',
                    err
                );

                return res.status(500).json({
                    error: 'Database error',
                    details: err.message,
                    code: err.code
                });

            }


            res.json({

                buyer_id:
                    buyerId,

                offers:
                    results

            });

        }
    );

});


// =====================================================
// ACCEPT FARMER COUNTER OFFER
//
// POST /api/buyer/offers/:offerId/accept-counter
//
// Example:
//
// Listed Price   = ₹29
// Buyer Offer    = ₹25
// Farmer Counter = ₹27
// Buyer accepts  = ₹27
//
// Transaction = ₹27 × quantity
// Shipment     = automatically created as pending
// =====================================================

router.post(
    '/:offerId/accept-counter',
    (req, res) => {

        const offerId =
            Number(req.params.offerId);

        const buyerId =
            Number(req.body.buyer_id);


        if (
            !Number.isInteger(offerId) ||
            offerId <= 0
        ) {

            return res.status(400).json({
                error: 'Invalid offer ID'
            });

        }


        if (
            !Number.isInteger(buyerId) ||
            buyerId <= 0
        ) {

            return res.status(400).json({
                error: 'Invalid buyer ID'
            });

        }


        // -------------------------------------------------
        // Get offer + product
        // -------------------------------------------------

        const offerSql = `
            SELECT

                o.id,
                o.produce_id,
                o.buyer_id,

                o.buyer_offer_price,
                o.counter_price,
                o.final_price,

                o.quantity,
                o.status,

                p.crop_name,
                p.unit,
                p.quantity AS available_quantity,
                p.status AS produce_status,
                p.farmer_id,

                u.name AS farmer_name

            FROM offers o

            INNER JOIN produce_listings p
                ON o.produce_id = p.id

            INNER JOIN users u
                ON p.farmer_id = u.id

            WHERE o.id = ?

            LIMIT 1
        `;


        db.query(
            offerSql,
            [offerId],
            (offerErr, offerResults) => {

                if (offerErr) {

                    console.error(
                        'Accept counter lookup error:',
                        offerErr
                    );

                    return res.status(500).json({
                        error: 'Database error',
                        details: offerErr.message,
                        code: offerErr.code
                    });

                }


                if (!offerResults.length) {

                    return res.status(404).json({
                        error: 'Offer not found'
                    });

                }


                const offer =
                    offerResults[0];


                // -------------------------------------------------
                // Security: offer belongs to buyer
                // -------------------------------------------------

                if (
                    Number(offer.buyer_id) !== buyerId
                ) {

                    return res.status(403).json({
                        error:
                            'You are not allowed to accept this offer'
                    });

                }


                // -------------------------------------------------
                // Must still be pending
                // -------------------------------------------------

                if (
                    String(offer.status)
                        .toLowerCase() !== 'pending'
                ) {

                    return res.status(400).json({
                        error:
                            'This offer is no longer pending'
                    });

                }


                // -------------------------------------------------
                // Farmer must have made a counter
                // -------------------------------------------------

                const counterPrice =
                    Number(
                        offer.counter_price
                    );


                if (
                    !Number.isFinite(counterPrice) ||
                    counterPrice <= 0
                ) {

                    return res.status(400).json({
                        error:
                            'No farmer counter offer is available'
                    });

                }


                // -------------------------------------------------
                // Product must still be available
                // -------------------------------------------------

                if (
                    String(offer.produce_status)
                        .toLowerCase() !== 'available'
                ) {

                    return res.status(400).json({
                        error:
                            'This produce is no longer available'
                    });

                }


                // -------------------------------------------------
                // Quantity check
                // -------------------------------------------------

                const requestedQuantity =
                    Number(
                        offer.quantity
                    );


                const availableQuantity =
                    Number(
                        offer.available_quantity
                    );


                if (
                    requestedQuantity <= 0
                ) {

                    return res.status(400).json({
                        error:
                            'Invalid offer quantity'
                    });

                }


                if (
                    requestedQuantity >
                    availableQuantity
                ) {

                    return res.status(400).json({
                        error:
                            `Only ${availableQuantity} ${offer.unit} is available`
                    });

                }


                // -------------------------------------------------
                // FINAL SALE PRICE
                //
                // Farmer counter price is used.
                //
                // ₹29 listed
                // ₹25 buyer offer
                // ₹27 farmer counter
                // ACCEPT => ₹27
                // -------------------------------------------------

                const finalPrice =
                    counterPrice;


                const totalAmount =
                    Number(
                        (
                            finalPrice *
                            requestedQuantity
                        ).toFixed(2)
                    );


                // -------------------------------------------------
                // Start database transaction
                // -------------------------------------------------

                db.beginTransaction(
                    (transactionErr) => {

                        if (transactionErr) {

                            console.error(
                                'Transaction start error:',
                                transactionErr
                            );

                            return res.status(500).json({
                                error:
                                    'Could not start transaction'
                            });

                        }


                        // -----------------------------------------
                        // Update offer
                        // -----------------------------------------

                        const updateOfferSql = `
                            UPDATE offers

                            SET
                                final_price = ?,
                                offered_price = ?,
                                status = 'accepted'

                            WHERE id = ?
                            AND buyer_id = ?
                            AND status = 'pending'
                        `;


                        db.query(
                            updateOfferSql,
                            [
                                finalPrice,
                                finalPrice,
                                offerId,
                                buyerId
                            ],
                            (updateOfferErr, updateResult) => {

                                if (updateOfferErr) {

                                    return db.rollback(
                                        () => {

                                            console.error(
                                                'Accept counter offer update error:',
                                                updateOfferErr
                                            );

                                            res.status(500).json({
                                                error:
                                                    'Database error',
                                                details:
                                                    updateOfferErr.message,
                                                code:
                                                    updateOfferErr.code
                                            });

                                        }
                                    );

                                }


                                if (
                                    updateResult.affectedRows !== 1
                                ) {

                                    return db.rollback(
                                        () => {

                                            res.status(409).json({
                                                error:
                                                    'Offer was already processed'
                                            });

                                        }
                                    );

                                }


                                // -----------------------------------------
                                // Reduce produce quantity
                                // -----------------------------------------

                                const newQuantity =
                                    Number(
                                        (
                                            availableQuantity -
                                            requestedQuantity
                                        ).toFixed(2)
                                    );


                                const newProduceStatus =
                                    newQuantity <= 0
                                        ? 'sold'
                                        : 'available';


                                const updateProduceSql = `
                                    UPDATE produce_listings

                                    SET
                                        quantity = ?,
                                        status = ?

                                    WHERE id = ?
                                `;


                                db.query(
                                    updateProduceSql,
                                    [
                                        newQuantity,
                                        newProduceStatus,
                                        offer.produce_id
                                    ],
                                    (produceErr) => {

                                        if (produceErr) {

                                            return db.rollback(
                                                () => {

                                                    console.error(
                                                        'Produce update error:',
                                                        produceErr
                                                    );

                                                    res.status(500).json({
                                                        error:
                                                            'Database error',
                                                        details:
                                                            produceErr.message,
                                                        code:
                                                            produceErr.code
                                                    });

                                                }
                                            );

                                        }


                                        // -----------------------------------------
                                        // Create completed transaction
                                        // -----------------------------------------

                                        const insertTransactionSql = `
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
                                            (?, ?, ?, ?, ?, 'completed')
                                        `;


                                        db.query(
                                            insertTransactionSql,
                                            [
                                                offerId,
                                                offer.farmer_id,
                                                buyerId,
                                                totalAmount,
                                                requestedQuantity
                                            ],
                                            (
                                                transactionInsertErr,
                                                transactionResult
                                            ) => {

                                                if (transactionInsertErr) {

                                                    return db.rollback(
                                                        () => {

                                                            console.error(
                                                                'Transaction creation error:',
                                                                transactionInsertErr
                                                            );

                                                            res.status(500).json({
                                                                error:
                                                                    'Database error',
                                                                details:
                                                                    transactionInsertErr.message,
                                                                code:
                                                                    transactionInsertErr.code
                                                            });

                                                        }
                                                    );

                                                }


                                                // -----------------------------------------
                                                // IMPORTANT:
                                                // Automatically create shipment
                                                // after successful purchase
                                                // -----------------------------------------

                                                const transactionId =
                                                    transactionResult.insertId;


                                                const insertShipmentSql = `
                                                    INSERT INTO shipments
                                                    (
                                                        transaction_id,
                                                        status
                                                    )
                                                    VALUES
                                                    (?, 'pending')
                                                `;


                                                db.query(
                                                    insertShipmentSql,
                                                    [
                                                        transactionId
                                                    ],
                                                    (
                                                        shipmentInsertErr,
                                                        shipmentResult
                                                    ) => {

                                                        if (shipmentInsertErr) {

                                                            return db.rollback(
                                                                () => {

                                                                    console.error(
                                                                        'Shipment creation error:',
                                                                        shipmentInsertErr
                                                                    );

                                                                    res.status(500).json({
                                                                        error:
                                                                            'Could not create shipment',
                                                                        details:
                                                                            shipmentInsertErr.message,
                                                                        code:
                                                                            shipmentInsertErr.code
                                                                    });

                                                                }
                                                            );

                                                        }


                                                        // -----------------------------------------
                                                        // Commit everything
                                                        // -----------------------------------------

                                                        db.commit(
                                                            (commitErr) => {

                                                                if (commitErr) {

                                                                    return db.rollback(
                                                                        () => {

                                                                            console.error(
                                                                                'Transaction commit error:',
                                                                                commitErr
                                                                            );

                                                                            res.status(500).json({
                                                                                error:
                                                                                    'Could not complete purchase',
                                                                                details:
                                                                                    commitErr.message,
                                                                                code:
                                                                                    commitErr.code
                                                                            });

                                                                        }
                                                                    );

                                                                }


                                                                // -----------------------------------------
                                                                // SUCCESS
                                                                // -----------------------------------------

                                                                res.json({

                                                                    message:
                                                                        'Counter offer accepted successfully and shipment created',

                                                                    purchase: {

                                                                        offer_id:
                                                                            offerId,

                                                                        transaction_id:
                                                                            transactionId,

                                                                        shipment_id:
                                                                            shipmentResult.insertId,

                                                                        crop_name:
                                                                            offer.crop_name,

                                                                        quantity:
                                                                            requestedQuantity,

                                                                        unit:
                                                                            offer.unit,

                                                                        buyer_offer_price:
                                                                            Number(
                                                                                offer.buyer_offer_price
                                                                            ),

                                                                        farmer_counter_price:
                                                                            counterPrice,

                                                                        final_price:
                                                                            finalPrice,

                                                                        total_amount:
                                                                            totalAmount,

                                                                        transaction_status:
                                                                            'completed',

                                                                        shipment_status:
                                                                            'pending'

                                                                    }

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

                    }
                );

            }
        );

    }
);


module.exports = router;