const express = require('express');
const db = require('../db');

const router = express.Router();

/*
    FARMER OVERVIEW

    GET:
    /api/farmer/overview?userId=2

    OR:

    /api/farmer/overview?name=Test%20Farmer
*/

function query(sql, params = []) {
    return new Promise((resolve, reject) => {
        db.query(sql, params, (err, results) => {
            if (err) {
                reject(err);
                return;
            }

            resolve(results);
        });
    });
}


/*
    Find a farmer using user ID or name.
*/
async function findFarmer(req) {
    const userId = Number(req.query.userId);
    const name = req.query.name;

    let sql;
    let params;

    if (Number.isInteger(userId) && userId > 0) {
        sql = `
            SELECT id, name, email, role
            FROM users
            WHERE id = ?
            AND role = 'farmer'
            LIMIT 1
        `;

        params = [userId];
    } else if (name) {
        sql = `
            SELECT id, name, email, role
            FROM users
            WHERE name = ?
            AND role = 'farmer'
            LIMIT 1
        `;

        params = [name];
    } else {
        return null;
    }

    const rows = await query(sql, params);

    return rows.length ? rows[0] : null;
}


/*
    Get table columns.

    This makes the dashboard more tolerant of the current
    database structure.
*/
async function getColumns(tableName) {
    const rows = await query(
        `
        SELECT COLUMN_NAME
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME = ?
        `,
        [tableName]
    );

    return rows.map(row => row.COLUMN_NAME);
}


/*
    Find the column used to associate a record with a farmer.
*/
function findUserColumn(columns) {
    const possibleColumns = [
        'farmer_id',
        'user_id',
        'seller_id',
        'owner_id',
        'created_by'
    ];

    return possibleColumns.find(column =>
        columns.includes(column)
    );
}


/*
    Get farmer's produce.
*/
async function getProduce(farmerId) {
    const columns = await getColumns('produce_listings');

    if (!columns.length) {
        return [];
    }

    const ownerColumn = findUserColumn(columns);

    if (!ownerColumn) {
        return [];
    }

    return query(
        `
        SELECT *
        FROM produce_listings
        WHERE ${ownerColumn} = ?
        ORDER BY id DESC
        `,
        [farmerId]
    );
}


/*
    Get farmer offers.
*/
async function getOffers(farmerId) {
    const columns = await getColumns('offers');

    if (!columns.length) {
        return [];
    }

    const ownerColumn = findUserColumn(columns);

    if (!ownerColumn) {
        return [];
    }

    return query(
        `
        SELECT *
        FROM offers
        WHERE ${ownerColumn} = ?
        ORDER BY id DESC
        `,
        [farmerId]
    );
}


/*
    Get farmer transactions.
*/
async function getTransactions(farmerId) {
    const columns = await getColumns('transactions');

    if (!columns.length) {
        return [];
    }

    const ownerColumn = findUserColumn(columns);

    if (!ownerColumn) {
        return [];
    }

    return query(
        `
        SELECT *
        FROM transactions
        WHERE ${ownerColumn} = ?
        ORDER BY id DESC
        `,
        [farmerId]
    );
}


/*
    Get farmer shipments.
*/
async function getShipments(farmerId) {
    const columns = await getColumns('shipments');

    if (!columns.length) {
        return [];
    }

    const ownerColumn = findUserColumn(columns);

    if (!ownerColumn) {
        return [];
    }

    return query(
        `
        SELECT *
        FROM shipments
        WHERE ${ownerColumn} = ?
        ORDER BY id DESC
        `,
        [farmerId]
    );
}


/*
    Find numeric value from an object.

    Used for different possible amount column names.
*/
function getNumericValue(row, possibleColumns) {
    for (const column of possibleColumns) {
        if (
            Object.prototype.hasOwnProperty.call(row, column) &&
            row[column] !== null &&
            row[column] !== undefined
        ) {
            const value = Number(row[column]);

            if (!Number.isNaN(value)) {
                return value;
            }
        }
    }

    return 0;
}


/*
    Normalize status.
*/
function getStatus(row) {
    const possibleColumns = [
        'status',
        'offer_status',
        'transaction_status',
        'payment_status'
    ];

    for (const column of possibleColumns) {
        if (
            Object.prototype.hasOwnProperty.call(row, column) &&
            row[column]
        ) {
            return String(row[column]).toLowerCase();
        }
    }

    return '';
}


/*
    GET FARMER OVERVIEW
*/
router.get('/overview', async (req, res) => {
    try {
        const farmer = await findFarmer(req);

        if (!farmer) {
            return res.status(404).json({
                message: 'Farmer not found'
            });
        }

        const [
            produce,
            offers,
            transactions,
            shipments
        ] = await Promise.all([
            getProduce(farmer.id),
            getOffers(farmer.id),
            getTransactions(farmer.id),
            getShipments(farmer.id)
        ]);


        /*
            Active offers:
            pending / negotiating / active
        */
        const activeOffers = offers.filter(row => {
            const status = getStatus(row);

            return (
                status === 'pending' ||
                status === 'negotiating' ||
                status === 'active' ||
                status === ''
            );
        });


        /*
            Pending transactions.
        */
        const pendingTransactions = transactions.filter(row => {
            const status = getStatus(row);

            return (
                status === 'pending' ||
                status === 'processing' ||
                status === 'initiated' ||
                status === 'unpaid'
            );
        });


        /*
            Calculate total earnings.

            Supports common amount column names.
        */
        const totalEarnings = transactions
            .filter(row => {
                const status = getStatus(row);

                return (
                    status === 'completed' ||
                    status === 'success' ||
                    status === 'successful' ||
                    status === 'paid' ||
                    status === ''
                );
            })
            .reduce((total, row) => {
                return total + getNumericValue(row, [
                    'amount',
                    'total_amount',
                    'total_price',
                    'price',
                    'transaction_amount',
                    'payment_amount'
                ]);
            }, 0);


        /*
            Return only the latest five produce records
            to the dashboard.
        */
        const recentProduce = produce.slice(0, 5);


        /*
            Recent transactions.
        */
        const recentTransactions = transactions.slice(0, 5);


        /*
            Recent shipments.
        */
        const recentShipments = shipments.slice(0, 5);


        res.json({
            success: true,

            farmer: {
                id: farmer.id,
                name: farmer.name,
                email: farmer.email,
                role: farmer.role
            },

            statistics: {
                totalEarnings,
                activeOffers: activeOffers.length,
                pendingTransactions: pendingTransactions.length,
                totalProduce: produce.length,
                totalOffers: offers.length,
                totalTransactions: transactions.length,
                totalShipments: shipments.length
            },

            produce: recentProduce,
            offers: offers.slice(0, 10),
            transactions: recentTransactions,
            shipments: recentShipments
        });

    } catch (error) {
        console.error(
            'Farmer overview error:',
            error
        );

        res.status(500).json({
            message: 'Failed to load farmer overview'
        });
    }
});


module.exports = router;