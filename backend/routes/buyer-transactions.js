const express = require('express');
const db = require('../db');

const router = express.Router();


// GET BUYER TRANSACTIONS
router.get('/:buyerId', (req, res) => {

    const buyerId = Number(req.params.buyerId);

    if (!Number.isInteger(buyerId) || buyerId <= 0) {
        return res.status(400).json({
            error: 'Invalid buyer ID'
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
            o.message,

            p.crop_name,
            p.unit,
            p.quality,
            p.price_per_unit,

            u.name AS farmer_name,
            u.email AS farmer_email

        FROM transactions t

        LEFT JOIN offers o
            ON t.offer_id = o.id

        LEFT JOIN produce_listings p
            ON o.produce_id = p.id

        LEFT JOIN users u
            ON t.farmer_id = u.id

        WHERE t.buyer_id = ?

        ORDER BY t.transaction_date DESC
    `;


    db.query(
        sql,
        [buyerId],
        (err, results) => {

            if (err) {

                console.error(
                    'Buyer transactions database error:',
                    err
                );

                return res.status(500).json({
                    error: 'Database error',
                    details: err.message,
                    code: err.code
                });

            }


            res.json(results);

        }
    );

});


module.exports = router;