const db = require('../db');

function createNotification({
    userId,
    title,
    message,
    type = 'info'
}) {
    return new Promise((resolve, reject) => {
        const id = Number(userId);

        if (
            !Number.isInteger(id) ||
            id <= 0 ||
            !title ||
            !message
        ) {
            return resolve(false);
        }

        const sql = `
            INSERT INTO notifications
            (
                user_id,
                title,
                message,
                type
            )
            VALUES (?, ?, ?, ?)
        `;

        db.query(
            sql,
            [
                id,
                String(title).trim(),
                String(message).trim(),
                type
            ],
            (err, result) => {
                if (err) {
                    console.error(
                        'Notification creation error:',
                        err
                    );

                    return reject(err);
                }

                resolve(result.insertId);
            }
        );
    });
}

module.exports = {
    createNotification
};