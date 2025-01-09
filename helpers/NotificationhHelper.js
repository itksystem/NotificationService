const amqp = require('amqplib');
const db = require('openfsm-database-connection-producer');
const { v4: uuidv4 } = require('uuid'); // Убедитесь, что установлен uuid версии 8
const authMiddleware = require('openfsm-middlewares-auth-service');
const logger = require('openfsm-logger-handler');
require('dotenv').config();

  exports.getProductMail = (productId, userId, ownerId) => {
    console.log('getProductMail',productId);
    return new Promise((resolve, reject) => {      
      let result = db.query(`
	SELECT prw.* FROM product_mails prw WHERE 1=1  
	and prw.product_id=? 
	and to_user_id<>0
	and prw.blocked is null and prw.deleted is null 
	order by created asc`, [productId], (err, result) => {
       if(err) logger.error(err);      
        (err)
        ? reject(err)
        : resolve(result ? result : null)
      });
    });
  };

  exports.getProductMailPersonal = (productId, userId, ownerId) => {
    console.log('getProductMailPersonal',productId, userId, ownerId);
    return new Promise((resolve, reject) => {      
      let result = db.query(`
	SELECT prw.* FROM product_mails prw WHERE 1=1  
	and prw.product_id=? 
	and (
	(user_id=? and to_user_id=?) OR (user_id=? and to_user_id=?))
	and to_user_id<>0
	and prw.blocked is null and prw.deleted is null 
	order by created asc`, [productId, userId, ownerId, ownerId, userId], (err, result) => {
       if(err) logger.error(err);      
        (err)
        ? reject(err)
        : resolve(result ? result : null)
      });
    });
  };



  exports.getMailImages = (mailId) => {
    return new Promise((resolve, reject) => {      
      let result = db.query('SELECT * FROM product_mails_media_storage WHERE mail_id=? and blocked is null and deleted is null', [mailId], (err, result) => {
        if(err) logger.error(err);      
        (err)
        ? reject(err)
        : resolve(result ? result : null)
      });
    });
  };



  exports.setProductMail = (productId, userId, message, toUserId) => {
    return new Promise((resolve, reject) => {      
      let result = db.query('INSERT INTO product_mails (product_id, user_id, comment, to_user_id) values (?,?,?,?) ON DUPLICATE KEY UPDATE comment=?', 
        [productId, userId, message, toUserId, message], (err, result) => {
        if(err) logger.error(err);      
        (err)
        ? reject(false)
        : resolve(result.insertId)
      });
    });
  };


  exports.setMailImage = (mailId, mediaId, mediaKey, productId, userId, storage, bucket) => {
    return new Promise((resolve, reject) => {      
      let result  = db.query(`INSERT INTO product_mails_media_storage (mail_id, media_id, media_key, product_id, user_id, storage, bucket) VALUES (?,?,?,?,?,?,?)`, 
	    [mailId, mediaId, mediaKey, productId, userId, storage, bucket ], (err, result) => {
      if(err) logger.error(err);      
        (err)
        ? reject(err)
        : resolve(true)
      });
    });
  };

