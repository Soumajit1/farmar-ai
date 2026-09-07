const express = require('express');
const db = require('../db');

const router = express.Router();

/*
    GET ALL NOTIFICATIONS FOR A USER
    Example:
    GET /api/notifications/2
*/
router.get('/:userId', (req, res) => {
    const userId = Number(req.params.userId);

    if (!Number.isInteger(userId) || userId <= 0) {
        return res.status(400).json({
            message: 'Invalid user ID'
        });
    }

    const sql = `
        SELECT
            id,
            user_id,
            title,
            message,
            type,
            is_read,
            created_at
        FROM notifications
        WHERE user_id = ?
        ORDER BY created_at DESC
        LIMIT 50
    `;

    db.query(sql, [userId], (err, notifications) => {
        if (err) {
            console.error('Notification fetch error:', err);

            return res.status(500).json({
                message: 'Failed to fetch notifications'
            });
        }

        const unreadSql = `
            SELECT COUNT(*) AS unreadCount
            FROM notifications
            WHERE user_id = ?
            AND is_read = FALSE
        `;

        db.query(unreadSql, [userId], (countErr, countResult) => {
            if (countErr) {
                console.error('Unread count error:', countErr);

                return res.status(500).json({
                    message: 'Failed to fetch unread count'
                });
            }

            res.json({
                notifications,
                unreadCount: countResult[0].unreadCount
            });
        });
    });
});


/*
    CREATE NOTIFICATION

    POST /api/notifications

    Body:
    {
        "userId": 2,
        "title": "New Offer",
        "message": "A buyer has submitted a new offer.",
        "type": "offer"
    }
*/
router.post('/', (req, res) => {
    const {
        userId,
        title,
        message,
        type = 'info'
    } = req.body;

    if (!userId || !title || !message) {
        return res.status(400).json({
            message: 'userId, title and message are required'
        });
    }

    const sql = `
        INSERT INTO notifications
        (user_id, title, message, type)
        VALUES (?, ?, ?, ?)
    `;

    db.query(
        sql,
        [userId, title, message, type],
        (err, result) => {
            if (err) {
                console.error('Notification creation error:', err);

                return res.status(500).json({
                    message: 'Failed to create notification'
                });
            }

            res.status(201).json({
                message: 'Notification created successfully',
                notificationId: result.insertId
            });
        }
    );
});


/*
    MARK ONE NOTIFICATION AS READ

    PUT /api/notifications/:id/read
*/
router.put('/:id/read', (req, res) => {
    const notificationId = Number(req.params.id);

    if (!Number.isInteger(notificationId) || notificationId <= 0) {
        return res.status(400).json({
            message: 'Invalid notification ID'
        });
    }

    const sql = `
        UPDATE notifications
        SET is_read = TRUE
        WHERE id = ?
    `;

    db.query(sql, [notificationId], (err, result) => {
        if (err) {
            console.error('Mark notification read error:', err);

            return res.status(500).json({
                message: 'Failed to mark notification as read'
            });
        }

        if (result.affectedRows === 0) {
            return res.status(404).json({
                message: 'Notification not found'
            });
        }

        res.json({
            message: 'Notification marked as read'
        });
    });
});


/*
    MARK ALL NOTIFICATIONS AS READ

    PUT /api/notifications/user/:userId/read-all
*/
router.put('/user/:userId/read-all', (req, res) => {
    const userId = Number(req.params.userId);

    if (!Number.isInteger(userId) || userId <= 0) {
        return res.status(400).json({
            message: 'Invalid user ID'
        });
    }

    const sql = `
        UPDATE notifications
        SET is_read = TRUE
        WHERE user_id = ?
        AND is_read = FALSE
    `;

    db.query(sql, [userId], (err) => {
        if (err) {
            console.error('Mark all notifications read error:', err);

            return res.status(500).json({
                message: 'Failed to mark notifications as read'
            });
        }

        res.json({
            message: 'All notifications marked as read'
        });
    });
});


module.exports = router;