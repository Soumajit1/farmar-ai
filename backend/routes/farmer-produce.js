const express = require('express');
const db = require('../db');

const router = express.Router();

const VALID_STATUSES = ['available', 'sold', 'pending'];

function validateFarmerId(farmerId) {
    const id = Number(farmerId);
    return Number.isInteger(id) && id > 0 ? id : null;
}

function validateProduce(data) {
    const {
        cropName,
        quantity,
        unit,
        pricePerUnit,
        quality,
        description,
        status
    } = data;

    if (!cropName || !String(cropName).trim()) {
        return 'Crop name is required';
    }

    const parsedQuantity = Number(quantity);

    if (!Number.isFinite(parsedQuantity) || parsedQuantity <= 0) {
        return 'Quantity must be greater than 0';
    }

    if (String(cropName).length > 100) {
        return 'Crop name cannot exceed 100 characters';
    }

    if (unit && String(unit).length > 20) {
        return 'Unit cannot exceed 20 characters';
    }

    if (
        pricePerUnit !== undefined &&
        pricePerUnit !== null &&
        pricePerUnit !== ''
    ) {
        const parsedPrice = Number(pricePerUnit);

        if (!Number.isFinite(parsedPrice) || parsedPrice < 0) {
            return 'Price per unit must be a valid positive number';
        }
    }

    if (quality && String(quality).length > 50) {
        return 'Quality cannot exceed 50 characters';
    }

    if (status && !VALID_STATUSES.includes(status)) {
        return 'Invalid produce status';
    }

    return null;
}


// GET FARMER PRODUCE
// GET /api/farmer/produce/:farmerId
router.get('/:farmerId', (req, res) => {
    const farmerId = validateFarmerId(req.params.farmerId);

    if (!farmerId) {
        return res.status(400).json({
            message: 'Invalid farmer ID'
        });
    }

    const sql = `
        SELECT
            id,
            farmer_id,
            crop_name,
            quantity,
            unit,
            price_per_unit,
            quality,
            description,
            status,
            created_at
        FROM produce_listings
        WHERE farmer_id = ?
        ORDER BY created_at DESC
    `;

    db.query(sql, [farmerId], (err, results) => {
        if (err) {
            console.error('Fetch farmer produce error:', err);

            return res.status(500).json({
                message: 'Failed to fetch produce listings'
            });
        }

        res.json({
            produce: results
        });
    });
});


// ADD PRODUCE
// POST /api/farmer/produce
router.post('/', (req, res) => {
    const {
        farmerId,
        cropName,
        quantity,
        unit = 'kg',
        pricePerUnit,
        quality,
        description,
        status = 'available'
    } = req.body;

    const validFarmerId = validateFarmerId(farmerId);

    if (!validFarmerId) {
        return res.status(400).json({
            message: 'Invalid farmer ID'
        });
    }

    const validationError = validateProduce(req.body);

    if (validationError) {
        return res.status(400).json({
            message: validationError
        });
    }

    const checkFarmerSql = `
        SELECT id
        FROM users
        WHERE id = ?
        AND role = 'farmer'
        LIMIT 1
    `;

    db.query(
        checkFarmerSql,
        [validFarmerId],
        (farmerErr, farmerResults) => {
            if (farmerErr) {
                console.error('Farmer verification error:', farmerErr);

                return res.status(500).json({
                    message: 'Failed to verify farmer'
                });
            }

            if (farmerResults.length === 0) {
                return res.status(403).json({
                    message: 'User is not a valid farmer'
                });
            }

            const sql = `
                INSERT INTO produce_listings
                (
                    farmer_id,
                    crop_name,
                    quantity,
                    unit,
                    price_per_unit,
                    quality,
                    description,
                    status
                )
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `;

            const values = [
                validFarmerId,
                String(cropName).trim(),
                Number(quantity),
                unit || 'kg',
                pricePerUnit === '' || pricePerUnit === undefined
                    ? null
                    : Number(pricePerUnit),
                quality ? String(quality).trim() : null,
                description ? String(description).trim() : null,
                status
            ];

            db.query(sql, values, (err, result) => {
                if (err) {
                    console.error('Add produce error:', err);

                    return res.status(500).json({
                        message: 'Failed to add produce'
                    });
                }

                res.status(201).json({
                    message: 'Produce added successfully',
                    produceId: result.insertId
                });
            });
        }
    );
});


// UPDATE PRODUCE
// PUT /api/farmer/produce/:id
router.put('/:id', (req, res) => {
    const produceId = Number(req.params.id);
    const {
        farmerId,
        cropName,
        quantity,
        unit = 'kg',
        pricePerUnit,
        quality,
        description,
        status
    } = req.body;

    const validFarmerId = validateFarmerId(farmerId);

    if (!Number.isInteger(produceId) || produceId <= 0) {
        return res.status(400).json({
            message: 'Invalid produce ID'
        });
    }

    if (!validFarmerId) {
        return res.status(400).json({
            message: 'Invalid farmer ID'
        });
    }

    const validationError = validateProduce(req.body);

    if (validationError) {
        return res.status(400).json({
            message: validationError
        });
    }

    const checkSql = `
        SELECT id, status
        FROM produce_listings
        WHERE id = ?
        AND farmer_id = ?
        LIMIT 1
    `;

    db.query(
        checkSql,
        [produceId, validFarmerId],
        (checkErr, results) => {
            if (checkErr) {
                console.error('Check produce error:', checkErr);

                return res.status(500).json({
                    message: 'Failed to verify produce'
                });
            }

            if (results.length === 0) {
                return res.status(404).json({
                    message: 'Produce listing not found'
                });
            }

            if (results[0].status === 'sold') {
                return res.status(409).json({
                    message: 'Sold produce cannot be edited'
                });
            }

            const sql = `
                UPDATE produce_listings
                SET
                    crop_name = ?,
                    quantity = ?,
                    unit = ?,
                    price_per_unit = ?,
                    quality = ?,
                    description = ?,
                    status = ?
                WHERE id = ?
                AND farmer_id = ?
            `;

            const values = [
                String(cropName).trim(),
                Number(quantity),
                unit || 'kg',
                pricePerUnit === '' || pricePerUnit === undefined
                    ? null
                    : Number(pricePerUnit),
                quality ? String(quality).trim() : null,
                description ? String(description).trim() : null,
                status || 'available',
                produceId,
                validFarmerId
            ];

            db.query(sql, values, (err, result) => {
                if (err) {
                    console.error('Update produce error:', err);

                    return res.status(500).json({
                        message: 'Failed to update produce'
                    });
                }

                res.json({
                    message: 'Produce updated successfully'
                });
            });
        }
    );
});


// DELETE PRODUCE
// DELETE /api/farmer/produce/:id
router.delete('/:id', (req, res) => {
    const produceId = Number(req.params.id);
    const farmerId = validateFarmerId(req.body.farmerId);

    if (!Number.isInteger(produceId) || produceId <= 0) {
        return res.status(400).json({
            message: 'Invalid produce ID'
        });
    }

    if (!farmerId) {
        return res.status(400).json({
            message: 'Invalid farmer ID'
        });
    }

    const checkSql = `
        SELECT id, status
        FROM produce_listings
        WHERE id = ?
        AND farmer_id = ?
        LIMIT 1
    `;

    db.query(
        checkSql,
        [produceId, farmerId],
        (checkErr, results) => {
            if (checkErr) {
                console.error('Check delete produce error:', checkErr);

                return res.status(500).json({
                    message: 'Failed to verify produce'
                });
            }

            if (results.length === 0) {
                return res.status(404).json({
                    message: 'Produce listing not found'
                });
            }

            if (results[0].status === 'sold') {
                return res.status(409).json({
                    message: 'Sold produce cannot be deleted'
                });
            }

            const sql = `
                DELETE FROM produce_listings
                WHERE id = ?
                AND farmer_id = ?
            `;

            db.query(
                sql,
                [produceId, farmerId],
                (err, result) => {
                    if (err) {
                        console.error('Delete produce error:', err);

                        if (err.code === 'ER_ROW_IS_REFERENCED_2') {
                            return res.status(409).json({
                                message: 'This produce cannot be deleted because it is linked to another record'
                            });
                        }

                        return res.status(500).json({
                            message: 'Failed to delete produce'
                        });
                    }

                    if (result.affectedRows === 0) {
                        return res.status(404).json({
                            message: 'Produce listing not found'
                        });
                    }

                    res.json({
                        message: 'Produce deleted successfully'
                    });
                }
            );
        }
    );
});


module.exports = router;