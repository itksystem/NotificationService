const express = require('express');
const router = express.Router();
const {getProductMail, setProductMail} = require('../controllers/NotificationContoller');
const authMiddleware = require('openfsm-middlewares-auth-service');

router.get( '/api/mail/v1/product/:productId',  authMiddleware.authenticateToken, getProductMail);  // Получить почту по продукту
router.post('/api/mail/v1/product/:productId', authMiddleware.authenticateToken, setProductMail);  // Сохранить почту по продукту

module.exports = router;
